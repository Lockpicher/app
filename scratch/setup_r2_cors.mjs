import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const lines = env.split(/\r?\n/);
const cfg = {};
lines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) cfg[k.trim()] = v.join('=').trim();
});

const client = new S3Client({
  region: 'auto',
  endpoint: cfg.R2_ENDPOINT,
  credentials: {
    accessKeyId: cfg.R2_ACCESS_KEY_ID,
    secretAccessKey: cfg.R2_SECRET_ACCESS_KEY
  }
});

async function checkCors() {
  try {
    const cors = await client.send(new GetBucketCorsCommand({ Bucket: cfg.R2_BUCKET_NAME }));
    console.log('Current CORS on bucket:', JSON.stringify(cors.CORSRules, null, 2));
  } catch (err) {
    console.log('CORS not set or error:', err.name, err.message);
    console.log('Applying standard CORS policy to Cloudflare R2 bucket for browser uploads...');
    const putRes = await client.send(new PutBucketCorsCommand({
      Bucket: cfg.R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3600
          }
        ]
      }
    }));
    console.log('PutBucketCors status code:', putRes.$metadata.httpStatusCode);
  }
}

checkCors().catch(console.error);
