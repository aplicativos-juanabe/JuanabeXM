// Utilities para normalizar rutas de imágenes usadas por el banco de preguntas
export function normalizeImagePath(raw) {
  if (raw === null || typeof raw === 'undefined') return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Quitar comillas residuales si las hubiera
  s = s.replace(/^"|"$/g, "");

  // Normalizar separadores de ruta y caracteres invisibles
  s = s.replace(/\\/g, '/').replace(/\uFEFF/g, '').trim();

  // Si es una ruta relativa hacia la carpeta 'img', asegurar barra inicial
  if (/^\.?\/?img\//i.test(s)) {
    // Convertir 'img/...' './img/...' '/img/...' a '/img/...'
    const m = s.match(/^\.?\/?img\/(.*)$/i);
    if (m) {
      const rest = m[1];
      s = `/img/${rest}`;
    }
  }

  // Si es solo un nombre de archivo (ej. 'imagen.png'), también convertir a /img/imagen.png
  if (!/^(https?:\/\/|\/|img\/)/i.test(s) && /\.[a-zA-Z]{2,5}$/.test(s)) {
    // Si es solo nombre de archivo (ej. 'imagen.png'), asumir que está en /img/
    s = '/img/' + s;
  }

  return s;
}
