import { createClient } from '@insforge/sdk';
import { 
  isR2Configured, 
  uploadBufferToR2, 
  headR2Object, 
  getR2Client 
} from '../src/lib/r2Server';
import crypto from 'crypto';

interface MigrationProgress {
  totalObjects: number;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  bytesMigrated: number;
  logs: string[];
}

export async function runStorageMigration(dryRun = false): Promise<{
  success: boolean;
  progress: MigrationProgress;
  errors: Array<{ bucket: string; key: string; error: string }>;
}> {
  const INSFORGE_BASE_URL = 'https://insforge.kora.ovh';
  const INSFORGE_ANON_KEY = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';

  const client = createClient({
    baseUrl: INSFORGE_BASE_URL,
    anonKey: INSFORGE_ANON_KEY,
  });

  const progress: MigrationProgress = {
    totalObjects: 0,
    migratedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    bytesMigrated: 0,
    logs: []
  };

  const errors: Array<{ bucket: string; key: string; error: string }> = [];

  const addLog = (msg: string) => {
    const time = new Date().toISOString().substring(11, 19);
    const line = `[${time}] ${msg}`;
    console.log(line);
    progress.logs.push(line);
  };

  addLog(`Iniciando migración de InsForge a Cloudflare R2 (DryRun: ${dryRun})...`);

  // Verify R2 is configured
  if (!isR2Configured() && !dryRun) {
    throw new Error('Cloudflare R2 no está configurado en las variables de entorno del servidor. Por favor define R2_ENDPOINT (o R2_ACCOUNT_ID), R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY.');
  }

  // 1. Get inventory from PostgreSQL storage.objects table
  const { data: objects, error: objError } = await client.database
    .from('storage.objects' as any)
    .select('bucket, key, size, mime_type, etag');

  if (objError || !objects) {
    throw new Error(`Error recuperando inventario de storage.objects: ${objError?.message || 'Sin datos'}`);
  }

  progress.totalObjects = objects.length;
  addLog(`Objetos inventariados en InsForge Storage: ${objects.length}`);

  // 2. Iterate each object safely preserving original bytes
  for (const obj of objects as any[]) {
    const bucket = obj.bucket;
    const originalKey = obj.key;
    const size = Number(obj.size || 0);
    const mimeType = obj.mime_type || 'application/octet-stream';
    const r2Key = `migrated/${bucket}/${originalKey.replace(/^\/+/, '')}`;

    addLog(`Procesando [${bucket}] ${originalKey} (${(size / 1024).toFixed(1)} KB)...`);

    try {
      // Check if already in R2 (Idempotency)
      if (!dryRun) {
        const existing = await headR2Object(r2Key);
        if (existing && existing.size === size) {
          addLog(`✓ Objeto ya existe en R2 con tamaño idéntico (${existing.size} B). Omitiendo copia.`);
          progress.skippedCount++;
          continue;
        }
      }

      if (dryRun) {
        addLog(`[DryRun] Se copiaría a R2: ${r2Key}`);
        progress.migratedCount++;
        progress.bytesMigrated += size;
        continue;
      }

      // 3. Download original bytes directly from InsForge storage
      const sourceUrl = `${INSFORGE_BASE_URL}/api/storage/buckets/${bucket}/objects/${encodeURIComponent(originalKey)}`;
      const downloadRes = await fetch(sourceUrl, {
        headers: { apikey: INSFORGE_ANON_KEY }
      });

      if (!downloadRes.ok) {
        throw new Error(`HTTP ${downloadRes.status} descargando de InsForge: ${downloadRes.statusText}`);
      }

      const arrayBuf = await downloadRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Verify exact byte integrity before upload
      if (buffer.length !== size && size > 0) {
        addLog(`⚠ Advertencia: tamaño descargado (${buffer.length}) difiere del tamaño registrado (${size}). Preservando bytes descargados.`);
      }

      // Calculate MD5 of original downloaded bytes
      const downloadedMd5 = crypto.createHash('md5').update(buffer).digest('hex');

      // 4. Upload buffer to R2 without any recompression or transformation
      const uploadRes = await uploadBufferToR2(r2Key, buffer, mimeType, {
        'original-bucket': bucket,
        'original-key': originalKey,
        'md5-checksum': downloadedMd5
      });

      // 5. Verification: Check R2 object exists and size matches exactly
      const headCheck = await headR2Object(r2Key);
      if (!headCheck || headCheck.size !== buffer.length) {
        throw new Error(`Fallo de verificación en R2: tamaño esperado ${buffer.length}, obtenido en R2 ${headCheck?.size}`);
      }

      addLog(`✓ Copiado y verificado con éxito en R2: ${r2Key} (ETag: ${headCheck.etag})`);
      progress.migratedCount++;
      progress.bytesMigrated += buffer.length;

      // 6. Record or update metadata in app_attachments table if applicable
      const { publicUrl } = getR2Client();
      const r2Url = publicUrl 
        ? `${publicUrl.replace(/\/$/, '')}/${r2Key}` 
        : `/api/r2/stream?key=${encodeURIComponent(r2Key)}`;

      const { data: existingAtt } = await client.database
        .from('app_attachments')
        .select('id')
        .eq('file_path', originalKey)
        .limit(1);

      if (existingAtt && existingAtt.length > 0) {
        await client.database
          .from('app_attachments')
          .update({
            r2_key: r2Key,
            storage_provider: 'r2',
            migration_status: 'verified',
            verified_at: new Date().toISOString(),
            etag: headCheck.etag
          })
          .eq('id', existingAtt[0].id);
      } else {
        // Register in app_attachments with verified status
        const filename = originalKey.split('/').pop() || originalKey;
        await client.database
          .from('app_attachments')
          .insert([{
            entity_id: '00000000-0000-0000-0000-000000000000',
            entity_type: `migrated_${bucket}`,
            file_name: filename,
            display_name: filename,
            file_url: r2Url,
            file_path: originalKey,
            r2_key: r2Key,
            bucket_name: 'cloudflare-r2',
            storage_provider: 'r2',
            file_size: buffer.length,
            mime_type: mimeType,
            etag: headCheck.etag,
            migration_status: 'verified',
            verified_at: new Date().toISOString()
          }]);
      }

    } catch (itemErr: any) {
      addLog(`✗ Error en objeto ${originalKey}: ${itemErr.message}`);
      progress.failedCount++;
      errors.push({ bucket, key: originalKey, error: itemErr.message });
    }
  }

  addLog(`Migración finalizada. Migrados: ${progress.migratedCount}, Omitidos (ya existían): ${progress.skippedCount}, Fallidos: ${progress.failedCount}`);

  return {
    success: errors.length === 0,
    progress,
    errors
  };
}
