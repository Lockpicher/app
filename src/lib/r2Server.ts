import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import fs from 'fs';
import path from 'path';

// Server-side R2 Client instance
let r2Client: S3Client | null = null;

/**
 * Carga variables desde archivos .env si no están presentes en process.env
 */
export function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env.production')
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            // Remove quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn('Error leyendo archivo env:', envPath, err);
      }
    }
  }
}

// Ejecutar carga inicial
loadEnvFiles();

export function getR2Client(): { client: S3Client; bucket: string; publicUrl?: string } {
  loadEnvFiles();
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || 'antigravity-storage';
  const publicUrl = process.env.R2_PUBLIC_URL || '';
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Configuración de Cloudflare R2 incompleta. Faltan variables: ' + [
      !endpoint ? 'R2_ENDPOINT/R2_ACCOUNT_ID' : null,
      !accessKeyId ? 'R2_ACCESS_KEY_ID' : null,
      !secretAccessKey ? 'R2_SECRET_ACCESS_KEY' : null
    ].filter(Boolean).join(', '));
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  return { client: r2Client, bucket, publicUrl };
}

export function isR2Configured(): boolean {
  loadEnvFiles();
  return Boolean(
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

/**
 * Prueba la conexión activa con Cloudflare R2 listando el bucket o haciendo Head
 */
export async function testR2Connection(): Promise<{
  connected: boolean;
  bucket: string;
  endpoint: string;
  error?: string;
}> {
  try {
    loadEnvFiles();
    if (!isR2Configured()) {
      const missing = [
        (!process.env.R2_ENDPOINT && !process.env.R2_ACCOUNT_ID) ? 'R2_ENDPOINT o R2_ACCOUNT_ID' : null,
        !process.env.R2_ACCESS_KEY_ID ? 'R2_ACCESS_KEY_ID' : null,
        !process.env.R2_SECRET_ACCESS_KEY ? 'R2_SECRET_ACCESS_KEY' : null
      ].filter(Boolean);

      return {
        connected: false,
        bucket: process.env.R2_BUCKET_NAME || '',
        endpoint: process.env.R2_ENDPOINT || '',
        error: `Variables no encontradas en el servidor ni en archivo .env (${missing.join(', ')}). Asegúrate de crear el archivo .env en C:\\Antigravity.`
      };
    }

    const { client, bucket } = getR2Client();
    const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

    // Intentamos probar enviando un HeadObject o probando el cliente
    try {
      await client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: '__antigravity_ping_test__'
      }));
    } catch (headErr: any) {
      // 404 o NotFound significa que las credenciales S3 y el bucket son válidos y respondieron correctamente
      if (headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404) {
        return { connected: true, bucket, endpoint };
      }
      throw headErr;
    }

    return { connected: true, bucket, endpoint };
  } catch (err: any) {
    return {
      connected: false,
      bucket: process.env.R2_BUCKET_NAME || '',
      endpoint: process.env.R2_ENDPOINT || '',
      error: err.message || 'Error de conexión con Cloudflare R2'
    };
  }
}

/**
 * Genera una URL firmada de PUT para subida directa segura desde el navegador
 */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<{ uploadUrl: string; key: string }> {
  const { client, bucket } = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { uploadUrl, key };
}

/**
 * Genera una URL firmada de GET para descarga o visualización privada segura
 */
export async function createPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
  responseContentDisposition?: string
): Promise<string> {
  const { client, bucket } = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: responseContentDisposition
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Sube un buffer directamente a R2 (útil para migraciones en servidor)
 */
export async function uploadBufferToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ etag?: string; size: number }> {
  const { client, bucket } = getR2Client();
  const res = await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata
    })
  );

  return { etag: res.ETag?.replace(/"/g, ''), size: body.length };
}

/**
 * Verifica y obtiene metadatos de un objeto en R2
 */
export async function headR2Object(key: string): Promise<{ size?: number; contentType?: string; etag?: string } | null> {
  const { client, bucket } = getR2Client();
  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );
    return {
      size: res.ContentLength,
      contentType: res.ContentType,
      etag: res.ETag?.replace(/"/g, '')
    };
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Elimina un objeto de R2
 */
export async function deleteR2Object(key: string): Promise<boolean> {
  const { client, bucket } = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );
  return true;
}

/**
 * Obtiene el stream directo y metadatos de un objeto en R2 (soporta Range requests)
 */
export async function getR2ObjectStream(key: string, range?: string) {
  const { client, bucket } = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: range
  });
  return await client.send(command);
}
