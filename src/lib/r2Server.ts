import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Server-side R2 Client instance
let r2Client: S3Client | null = null;

export function getR2Client(): { client: S3Client; bucket: string; publicUrl?: string } {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || 'antigravity-storage';
  const publicUrl = process.env.R2_PUBLIC_URL || '';
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Configuración de Cloudflare R2 incompleta. Comprueba R2_ENDPOINT (o R2_ACCOUNT_ID), R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY.');
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
  return Boolean(
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
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
