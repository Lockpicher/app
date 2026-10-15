import { AppAttachment } from './types';
import { db, storage } from './insforge';

export interface R2Status {
  configured: boolean;
  bucket: string;
  hasPublicUrl: boolean;
  publicUrl: string | null;
}

export interface R2ConnectionTest {
  connected: boolean;
  bucket: string;
  endpoint: string;
  error?: string;
}

export interface R2MigrationResult {
  success: boolean;
  progress: {
    totalObjects: number;
    migratedCount: number;
    skippedCount: number;
    failedCount: number;
    bytesMigrated: number;
    logs: string[];
  };
  errors: Array<{ bucket: string; key: string; error: string }>;
}

export const r2Storage = {
  /**
   * Consulta el estado de configuración de Cloudflare R2 en el backend
   */
  async getStatus(): Promise<R2Status> {
    try {
      const res = await fetch('/api/r2/status');
      if (!res.ok) {
        return { configured: false, bucket: '', hasPublicUrl: false, publicUrl: null };
      }
      return await res.json();
    } catch {
      return { configured: false, bucket: '', hasPublicUrl: false, publicUrl: null };
    }
  },

  /**
   * Ejecuta una prueba de conexión en vivo con Cloudflare R2
   */
  async testConnection(): Promise<R2ConnectionTest> {
    try {
      const res = await fetch('/api/r2/test-connection', { method: 'POST' });
      return await res.json();
    } catch (err: any) {
      return {
        connected: false,
        bucket: '',
        endpoint: '',
        error: err.message || 'Error de red contactando al servidor Vite'
      };
    }
  },

  /**
   * Inicia la sincronización y migración de archivos existentes a Cloudflare R2
   */
  async runMigration(dryRun = false): Promise<R2MigrationResult> {
    const res = await fetch('/api/r2/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al ejecutar sincronización');
    }
    return data;
  },

  /**
   * Sube un archivo a Cloudflare R2 preservando los bytes exactos originales
   * (sin recompresión ni transformaciones con pérdida)
   */
  async uploadFile(
    file: File | Blob, 
    folder = 'library',
    filenameOverride?: string
  ): Promise<{
    url: string;
    r2Key: string;
    name: string;
    size: number;
    mime: string;
    provider: 'r2' | 'insforge';
  }> {
    const rawName = filenameOverride || (file instanceof File ? file.name : `file_${Date.now()}`);
    const mime = file.type || 'application/octet-stream';
    const size = file.size;

    // 1. Verificar si R2 está activo en el backend
    const status = await this.getStatus();
    
    if (status.configured) {
      try {
        // Pedir URL firmada de PUT a nuestro backend
        const presignRes = await fetch('/api/r2/presign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalName: rawName,
            folder,
            contentType: mime
          })
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Error solicitando URL de subida R2');
        }

        const { uploadUrl, r2Key, downloadUrl, cleanName } = await presignRes.json();

        // 2. Subida directa a R2 vía HTTP PUT con los bytes exactos
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': mime
          },
          body: file
        });

        if (!uploadRes.ok) {
          throw new Error(`Error en la carga a R2 (${uploadRes.status}): ${uploadRes.statusText}`);
        }

        return {
          url: downloadUrl,
          r2Key,
          name: cleanName || rawName,
          size,
          mime,
          provider: 'r2'
        };
      } catch (r2Err: any) {
        console.warn('Subida a R2 falló o no pudo completarse, usando fallback de InsForge:', r2Err.message);
      }
    }

    // Fallback: InsForge storage
    const fallbackRes = await storage.uploadFile(file, folder, rawName);
    return {
      url: fallbackRes.url,
      r2Key: fallbackRes.path,
      name: fallbackRes.name,
      size: fallbackRes.size,
      mime: fallbackRes.mime,
      provider: 'insforge'
    };
  },

  /**
   * Obtiene una URL de visualización o descarga con permisos y expiración
   */
  async getDownloadUrl(attachment: AppAttachment, forceDownload = false): Promise<string> {
    if (attachment.storage_provider === 'r2' && attachment.r2_key) {
      try {
        const res = await fetch('/api/r2/presign-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: attachment.r2_key,
            disposition: forceDownload ? 'attachment' : 'inline',
            filename: attachment.file_name
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) return data.url;
        }
      } catch (e) {
        console.warn('Error resolviendo URL presignada R2:', e);
      }
    }

    return attachment.file_url;
  },

  /**
   * Elimina un archivo de R2 y de la base de datos
   */
  async deleteFile(attachment: AppAttachment): Promise<boolean> {
    if (attachment.storage_provider === 'r2' && attachment.r2_key) {
      try {
        await fetch('/api/r2/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: attachment.r2_key })
        });
      } catch (e) {
        console.warn('Error eliminando de R2:', e);
      }
    } else if (attachment.file_path) {
      await storage.deleteFile(attachment.file_path);
    }

    return await db.deleteAttachment(attachment.id);
  }
};
