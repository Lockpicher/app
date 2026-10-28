import http from 'http';
import net from 'net';

/**
 * Validador estricto para prevenir vulnerabilidades SSRF (Server-Side Request Forgery)
 */
export function isAllowedUrl(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(urlString);

    // Solo admitir protocolos web estándar
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, reason: 'Solo se admiten protocolos http:// o https://' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Bloquear localhost y loopback
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost')
    ) {
      return { allowed: false, reason: 'Acceso a direcciones locales o de bucle invertido bloqueado.' };
    }

    // Bloquear sufijos de red local y nombres internos
    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.arpa') ||
      (!hostname.includes('.') && !hostname.startsWith('['))
    ) {
      return { allowed: false, reason: 'Acceso a redes o nombres de host internos bloqueado.' };
    }

    // Bloquear rangos IPv4 privados
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { allowed: false, reason: 'Acceso a redes privadas (10.0.0.0/8) bloqueado.' };
    }
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { allowed: false, reason: 'Acceso a redes privadas (192.168.0.0/16) bloqueado.' };
    }
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { allowed: false, reason: 'Acceso a redes privadas (172.16.0.0/12) bloqueado.' };
    }
    // 169.254.0.0/16 (Link-local & AWS metadata)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { allowed: false, reason: 'Acceso a direcciones link-local de metadatos bloqueado.' };
    }

    // Bloquear IPv6 privados y link-local
    const rawHost = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(rawHost) === 6 || net.isIP(hostname) === 6) {
      // Loopback o sin especificar
      if (rawHost === '::1' || rawHost === '::') {
        return { allowed: false, reason: 'Acceso a direcciones locales o de bucle invertido bloqueado.' };
      }
      // fc00::/7 (Unique Local Address)
      if (/^f[cd]/i.test(rawHost)) {
        return { allowed: false, reason: 'Acceso a direcciones IPv6 privadas (fc00::/7) bloqueado.' };
      }
      // fe80::/10 (Link-local unicast)
      if (/^fe[89ab]/i.test(rawHost)) {
        return { allowed: false, reason: 'Acceso a direcciones IPv6 link-local (fe80::/10) bloqueado.' };
      }
      // ::ffff:x.x.x.x (IPv4-mapped IPv6)
      if (rawHost.startsWith('::ffff:')) {
        const rest = rawHost.slice(7);
        let mappedIpv4 = '';
        if (rest.includes('.')) {
          mappedIpv4 = rest;
        } else {
          const parts = rest.split(':');
          if (parts.length === 2) {
            const high = parseInt(parts[0], 16);
            const low = parseInt(parts[1], 16);
            const b1 = (high >> 8) & 0xff;
            const b2 = high & 0xff;
            const b3 = (low >> 8) & 0xff;
            const b4 = low & 0xff;
            mappedIpv4 = `${b1}.${b2}.${b3}.${b4}`;
          }
        }
        if (mappedIpv4) {
          if (
            mappedIpv4 === '127.0.0.1' ||
            mappedIpv4 === '0.0.0.0' ||
            mappedIpv4.startsWith('127.') ||
            /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mappedIpv4) ||
            /^192\.168\.\d{1,3}\.\d{1,3}$/.test(mappedIpv4) ||
            /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(mappedIpv4) ||
            /^169\.254\.\d{1,3}\.\d{1,3}$/.test(mappedIpv4)
          ) {
            return { allowed: false, reason: 'Acceso a direcciones IPv4 privadas mapeadas en IPv6 bloqueado.' };
          }
        }
      }
    }

    return { allowed: true };
  } catch (err: any) {
    return { allowed: false, reason: 'Formato de URL no válido.' };
  }
}

/**
 * Resuelve una URL relativa frente a una URL base absoluta
 */
function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}

/**
 * Extrae metadatos y contenido legible de un HTML público
 */
export function extractArticleFromHtml(html: string, pageUrl: string) {
  // 1. Extraer título
  let title = '';
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) {
    title = ogTitleMatch[1];
  } else {
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch) {
      title = titleTagMatch[1];
    }
  }

  // 2. Extraer descripción
  let description = '';
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
                      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) {
    description = ogDescMatch[1];
  }

  // 3. Extraer imagen Open Graph (Portada)
  let ogImage = '';
  const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImgMatch) {
    ogImage = resolveUrl(ogImgMatch[1], pageUrl);
  }

  // 4. Extraer nombre del sitio
  let siteName = '';
  const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  if (siteNameMatch) {
    siteName = siteNameMatch[1];
  } else {
    try {
      siteName = new URL(pageUrl).hostname.replace(/^www\./, '');
    } catch {
      siteName = '';
    }
  }

  // 5. Extraer Favicon
  let favicon = '';
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
                       html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
  if (faviconMatch) {
    favicon = resolveUrl(faviconMatch[1], pageUrl);
  } else {
    try {
      const u = new URL(pageUrl);
      favicon = `${u.protocol}//${u.host}/favicon.ico`;
    } catch {
      favicon = '';
    }
  }

  // Decodificar entidades HTML básicas en títulos y descripciones
  const decodeEntities = (str: string) => {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&nbsp;/g, ' ')
      .trim();
  };

  title = decodeEntities(title);
  description = decodeEntities(description);
  siteName = decodeEntities(siteName);

  // 6. Extracción del cuerpo del artículo
  // Remover etiquetas no deseadas antes de buscar el contenedor
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Buscar bloque principal de contenido
  let articleBlock = '';
  const articleTagMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainTagMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const roleMainMatch = cleaned.match(/<div\b[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i);
  const postContentMatch = cleaned.match(/<div\b[^>]*(?:class|id)=["'][^"']*(?:post-content|article-body|entry-content|story-body|content-article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  if (articleTagMatch) {
    articleBlock = articleTagMatch[1];
  } else if (postContentMatch) {
    articleBlock = postContentMatch[1];
  } else if (mainTagMatch) {
    articleBlock = mainTagMatch[1];
  } else if (roleMainMatch) {
    articleBlock = roleMainMatch[1];
  } else {
    // Si no se encuentra un contenedor específico, tomar el body
    const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    articleBlock = bodyMatch ? bodyMatch[1] : cleaned;
  }

  // Filtrar y resolver URLs relativas en imágenes y enlaces dentro del artículo
  let processedHtml = articleBlock
    // Resolver src en <img>
    .replace(/<img\b([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (_match, before, src, after) => {
      const fullSrc = resolveUrl(src, pageUrl);
      // Descartar imágenes diminutas o iconos de tracking
      if (src.includes('pixel') || src.includes('tracker') || src.startsWith('data:image/svg')) {
        return '';
      }
      return `<img ${before}src="${fullSrc}"${after}>`;
    })
    // Resolver href en <a>
    .replace(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (_match, before, href, after) => {
      const fullHref = resolveUrl(href, pageUrl);
      return `<a ${before}href="${fullHref}" target="_blank" rel="noopener noreferrer"${after}>`;
    })
    // Remover clases y estilos inline que deforman el diseño
    .replace(/\sclass=["'][^"']*["']/gi, '')
    .replace(/\sstyle=["'][^"']*["']/gi, '')
    .replace(/\sid=["'][^"']*["']/gi, '')
    .replace(/<div\b[^>]*>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .replace(/<section\b[^>]*>/gi, '')
    .replace(/<\/section>/gi, '')
    .replace(/<span>(.*?)<\/span>/gi, '$1')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p><br\/?><\/p>/gi, '');

  // Contar palabras estimadas
  const plainText = processedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    title,
    description,
    ogImage,
    siteName,
    favicon,
    contentHtml: processedHtml,
    wordCount,
    readingTimeMinutes
  };
}

/**
 * Middleware para Vite que gestiona la extracción e importación de páginas web de forma segura
 */
export function webScraperMiddleware(req: http.IncomingMessage, res: http.ServerResponse, next: () => void) {
  const urlPath = req.url?.split('?')[0];

  if (urlPath === '/api/web-scraper/metadata' || urlPath === '/api/web-scraper/extract') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString();
        const json = JSON.parse(bodyStr || '{}');
        const targetUrl = json.url?.trim();

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'El campo "url" es obligatorio.' }));
          return;
        }

        // 1. Verificación estricta SSRF
        const urlCheck = isAllowedUrl(targetUrl);
        if (!urlCheck.allowed) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: urlCheck.reason || 'URL no permitida por seguridad.' }));
          return;
        }

        // 2. Fetch seguro con timeout de 10 segundos y User-Agent de navegador
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        let response: Response;
        try {
          response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SegundoCerebro/1.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            }
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: fetchErr.name === 'AbortError'
              ? 'El sitio web tardó más de 10 segundos en responder (tiempo de espera agotado).'
              : `No se pudo conectar con el sitio web: ${fetchErr.message || 'Error de red'}`
          }));
          return;
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: `El servidor web respondió con código ${response.status} (${response.statusText}). Es posible que el contenido requiera suscripción o bloquee lectores automáticos.`
          }));
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          res.statusCode = 415;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: `El recurso no es un documento HTML válido (Tipo recibido: ${contentType}).`
          }));
          return;
        }

        // Limitar respuesta a 5 MB
        const text = await response.text();
        if (text.length > 5 * 1024 * 1024) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'El contenido de la página excede el límite permitido de 5 MB.' }));
          return;
        }

        const data = extractArticleFromHtml(text, targetUrl);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          url: targetUrl,
          ...data
        }));
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Error procesando la página web: ${err.message || 'Error interno'}` }));
      }
    });
    return;
  }

  next();
}
