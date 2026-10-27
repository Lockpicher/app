import DOMPurify from 'dompurify';
import { r2Storage } from './r2Client';

/**
 * Convierte un Data URL (Base64) en un objeto File real
 */
export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Limpia y normaliza el HTML copiado desde navegadores, Microsoft Word y Google Docs
 */
export function cleanPastedHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  let html = rawHtml;

  // 1. Limpieza de artefactos específicos de Microsoft Word
  // Eliminar comentarios condicionales de Office: <!--[if !mso]> ... <![endif]-->
  html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  // Eliminar tags de Office: <o:p> ... </o:p>
  html = html.replace(/<\/?o:[^>]*>/gi, '');
  html = html.replace(/<\/?w:[^>]*>/gi, '');
  html = html.replace(/<\/?m:[^>]*>/gi, '');
  html = html.replace(/<\/?v:[^>]*>/gi, '');
  html = html.replace(/<\/?xml[^>]*>/gi, '');
  // Eliminar directivas de estilo mso-*
  html = html.replace(/mso-[^;:"']+[;:]/gi, '');

  // 2. Limpieza de artefactos específicos de Google Docs
  // Eliminar el contenedor docs-internal-guid-...
  html = html.replace(/<b\b[^>]*id=["']docs-internal-guid-[^"']*["'][^>]*>([\s\S]*?)<\/b>/gi, '$1');
  html = html.replace(/<span\b[^>]*id=["']docs-internal-guid-[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '$1');

  // 3. Normalizar fuentes, tamaños y colores destructivos
  // Eliminar font-family, font-size, line-height, margin, color, background-color
  html = html.replace(/style=["'][^"']*["']/gi, (match) => {
    // Preservar solo text-align si existe
    const alignMatch = match.match(/text-align:\s*(left|center|right|justify)/i);
    if (alignMatch) {
      return `style="text-align: ${alignMatch[1]};"`;
    }
    return '';
  });

  // 4. Eliminar clases propietarias de Word y Docs (p. ej. MsoNormal, MsoListParagraph, etc.)
  html = html.replace(/\sclass=["'][^"']*["']/gi, '');
  html = html.replace(/\sid=["'][^"']*["']/gi, '');

  // 5. Eliminar spans vacíos o que solo envolvían estilos de fuente
  html = html.replace(/<span>(.*?)<\/span>/gi, '$1');

  // 6. Normalizar saltos de línea y párrafos vacíos redundantes
  html = html.replace(/<p>\s*&nbsp;\s*<\/p>/gi, '<p></p>');
  html = html.replace(/(<p><\/p>){2,}/gi, '<p></p>');

  // 7. Sanitización final estricta pero enriquecida con DOMPurify
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img',
      'mark'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'title', 'width', 'height',
      'colspan', 'rowspan',
      'style' // Solo para text-align retenido
    ]
  });

  return clean;
}

/**
 * Convierte texto plano con saltos de línea en párrafos HTML limpios
 */
export function plainTextToHtml(plainText: string): string {
  if (!plainText) return '';
  const paragraphs = plainText
    .split(/\r?\n\r?\n/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '';

  return paragraphs
    .map(p => `<p>${p.replace(/\r?\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Busca imágenes Base64 dentro del HTML pegado, las sube a Cloudflare R2 y reemplaza sus fuentes con URLs seguras
 */
export async function uploadBase64ImagesToR2(html: string, folder = 'pages'): Promise<string> {
  const base64Regex = /<img\b([^>]*?)src=["'](data:image\/([a-zA-Z0-9+]+);base64,[^"']+)["']([^>]*?)>/gi;
  const matches = [...html.matchAll(base64Regex)];

  if (matches.length === 0) return html;

  let processedHtml = html;

  for (let i = 0; i < matches.length; i++) {
    const fullTag = matches[i][0];
    const before = matches[i][1];
    const dataUrl = matches[i][2];
    const ext = matches[i][3] || 'png';
    const after = matches[i][4];

    try {
      const filename = `pasted_image_${Date.now()}_${i}.${ext}`;
      const file = dataURLtoFile(dataUrl, filename);
      const res = await r2Storage.uploadFile(file, folder);

      if (res?.url) {
        const replacementTag = `<img ${before}src="${res.url}"${after}>`;
        processedHtml = processedHtml.replace(fullTag, replacementTag);
      }
    } catch (err) {
      console.warn('No se pudo subir imagen Base64 a Cloudflare R2, se conserva tag:', err);
    }
  }

  return processedHtml;
}
