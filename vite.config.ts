import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r2Middleware } from './src/lib/r2VitePlugin';
import { loadEnvFiles, getR2ObjectStream } from './src/lib/r2Server';
import { webScraperMiddleware } from './src/lib/webScraperServer';
import { aiMiddleware } from './src/lib/aiServer';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ai-assistant-api-server',
      configureServer(server) {
        server.middlewares.use(aiMiddleware);
      }
    },
    {
      name: 'cloudflare-r2-api-server',
      configureServer(server) {
        server.middlewares.use(r2Middleware);
      }
    },
    {
      name: 'web-scraper-api-server',
      configureServer(server) {
        server.middlewares.use(webScraperMiddleware);
      }
    },
    {
      name: 'elevenlabs-stt-server',
      configureServer(server) {
        server.middlewares.use('/api/transcribe', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
          }

          loadEnvFiles();
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'Clave ELEVENLABS_API_KEY no configurada. Por favor añade ELEVENLABS_API_KEY en tu archivo .env para habilitar la transcripción automática con ElevenLabs Scribe.'
            }));
            return;
          }

          const chunks: any[] = [];
          req.on('data', chunk => chunks.push(chunk));
          req.on('end', async () => {
            try {
              const bodyBuffer = Buffer.concat(chunks);
              let audioBuffer: Buffer;
              let filename = 'audio.webm';
              let mimeType = 'audio/webm';
              let languageCode = 'es';

              const contentType = req.headers['content-type'] || '';
              if (contentType.includes('application/json')) {
                const json = JSON.parse(bodyBuffer.toString());
                if (!json.audio_url) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'audio_url es requerido' }));
                  return;
                }

                let fetchTarget = json.audio_url;
                if (fetchTarget.startsWith('/')) {
                  const host = req.headers.host || 'localhost:3000';
                  fetchTarget = `http://${host}${fetchTarget}`;
                }

                const audioFetch = await fetch(fetchTarget);
                if (!audioFetch.ok) {
                  throw new Error(`No se pudo descargar el archivo de audio: ${audioFetch.statusText}`);
                }
                const arrayBuf = await audioFetch.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuf);
                if (json.language_code) languageCode = json.language_code;
              } else {
                audioBuffer = bodyBuffer;
              }

              const formData = new FormData();
              const audioBlob = new Blob([audioBuffer], { type: mimeType });
              formData.append('file', audioBlob, filename);
              formData.append('model_id', 'scribe_v2');
              if (languageCode) {
                formData.append('language_code', languageCode);
              }

              const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
                method: 'POST',
                headers: {
                  'xi-api-key': apiKey
                },
                body: formData
              });

              const sttData = await sttRes.json();
              if (!sttRes.ok) {
                res.statusCode = sttRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: sttData?.detail?.message || sttData?.message || 'Error en ElevenLabs Scribe API' }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                text: sttData.text,
                language_code: sttData.language_code || languageCode,
                words: sttData.words
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Error interno procesando transcripción' }));
            }
          });
        });
      }
    }
  ],
  define: {
    'process.env.IS_PREACT': JSON.stringify('false')
  },
  server: {
    port: 3000,
    open: false
  }
});
