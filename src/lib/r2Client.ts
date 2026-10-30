import { AppAttachment } from './types';
import { db, storage, insforge } from './insforge';

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  try {
    const token = (insforge as any).tokenManager?.getAccessToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

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
   * Sincroniza el token activo con la cookie httpOnly sb_session para permitir
   * que los elementos <img> y <audio> carguen archivos directamente vía /api/r2/stream
   */
  async syncSession(token?: string): Promise<boolean> {
    try {
      const activeToken = token || (insforge as any).tokenManager?.getAccessToken?.();
      if (!activeToken) return false;
      const res = await fetch('/api/r2/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken }),
        credentials: 'same-origin'
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Elimina la cookie de sesión httpOnly sb_session
   */
  async clearSession(): Promise<boolean> {
    try {
      const res = await fetch('/api/r2/session', {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Consulta el estado de configuración de Cloudflare R2 en el backend
   */
  async getStatus(): Promise<R2Status> {
    try {
      const res = await fetch('/api/r2/status', {
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      });
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
      const res = await fetch('/api/r2/test-connection', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      });
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'same-origin',
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
        // En navegadores, las llamadas directas PUT a endpoints R2 con firmas S3 pueden ser bloqueadas
        // por políticas de CORS en el bucket o restricciones del navegador.
        // Usamos el proxy de streaming del servidor local Vite como canal primario ultra fiable y rápido.
        const proxyUrl = `/api/r2/upload-proxy?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(rawName)}`;
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': mime
          }),
          credentials: 'same-origin',
          body: file
        });

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          return {
            url: proxyData.url,
            r2Key: proxyData.r2Key,
            name: proxyData.name,
            size: proxyData.size,
            mime: proxyData.mime,
            provider: 'r2'
          };
        }

        // Si el proxy falla, intentar vía URL firmada de PUT directo como fallback
        const presignRes = await fetch('/api/r2/presign-upload', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'same-origin',
          body: JSON.stringify({
            originalName: rawName,
            folder,
            contentType: mime
          })
        });

        if (presignRes.ok) {
          const { uploadUrl, r2Key, downloadUrl, cleanName } = await presignRes.json();
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mime },
            body: file
          });

          if (uploadRes.ok) {
            return {
              url: downloadUrl,
              r2Key,
              name: cleanName || rawName,
              size,
              mime,
              provider: 'r2'
            };
          }
        }

        const proxyErr = await proxyRes.json().catch(() => ({}));
        throw new Error(proxyErr.error || `Error subiendo archivo a R2 (código HTTP ${proxyRes.status})`);
      } catch (r2Err: any) {
        console.error('Error cargando archivo a Cloudflare R2:', r2Err);
        throw new Error(`Fallo al subir a Cloudflare R2: ${r2Err.message || 'Error de red'}`);
      }
    }

    // 2. Si no respondió o configured es false, diagnosticar la causa exacta
    try {
      const res = await fetch('/api/r2/status', {
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      });
      if (res.status === 404) {
        throw new Error('El backend de la aplicación no tiene desplegados los endpoints de Cloudflare R2 (/api/r2/*). Asegúrate de reconstruir y desplegar el contenedor Docker actualizado en EasyPanel.');
      }
      if (!res.ok) {
        throw new Error(`El servidor respondió con estado HTTP ${res.status} al verificar la configuración de almacenamiento.`);
      }
    } catch (netErr: any) {
      if (netErr.message && netErr.message.includes('EasyPanel')) {
        throw netErr;
      }
    }

    throw new Error('Cloudflare R2 no está activo o configurado. Comprueba que las variables R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET_NAME estén definidas en EasyPanel.');
  },

  /**
   * Obtiene la URL de visualización (stream/proxy o pública) sin expirar
   */
  getDisplayUrl(attachment: Partial<AppAttachment> & { file_url?: string; r2_key?: string; storage_provider?: string }): string {
    if (attachment.r2_key) {
      return `/api/r2/stream?key=${encodeURIComponent(attachment.r2_key)}`;
    }
    return attachment.file_url || '';
  },

  /**
   * Obtiene una URL de visualización o descarga con permisos y expiración
   */
  async getDownloadUrl(attachment: AppAttachment, forceDownload = false): Promise<string> {
    if (attachment.storage_provider === 'r2' && attachment.r2_key) {
      if (!forceDownload) {
        return `/api/r2/stream?key=${encodeURIComponent(attachment.r2_key)}`;
      }
      try {
        const res = await fetch('/api/r2/presign-download', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'same-origin',
          body: JSON.stringify({
            key: attachment.r2_key,
            disposition: 'attachment',
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
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'same-origin',
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
