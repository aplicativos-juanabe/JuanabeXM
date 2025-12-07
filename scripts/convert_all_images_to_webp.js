#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const IMG_DIR = path.join(process.cwd(), 'public', 'img');
const CSV_FILE = path.join(process.cwd(), 'public', 'preguntas.csv');

if (!fs.existsSync(IMG_DIR)) {
  console.error('No existe public/img/ en este proyecto. Abortando.');
  process.exit(2);
}

const files = fs.readdirSync(IMG_DIR).filter(f => fs.statSync(path.join(IMG_DIR, f)).isFile());
const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));

if (!imageFiles.length) {
  console.log('No se encontraron archivos .png/.jpg/.jpeg para convertir.');
} else {
  console.log(`Encontrados ${imageFiles.length} archivos a convertir a WebP...`);
}

async function convertFile(name) {
  const inputPath = path.join(IMG_DIR, name);
  const outName = name.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  const outputPath = path.join(IMG_DIR, outName);

  // Si ya existe y es más nuevo que el origen, saltar
  try {
    if (fs.existsSync(outputPath)) {
      const outStat = fs.statSync(outputPath);
      const inStat = fs.statSync(inputPath);
      if (outStat.mtimeMs >= inStat.mtimeMs) {
        console.log(`Saltando (ya existe): ${outName}`);
        return outName;
      }
    }

    await sharp(inputPath)
      // elegir calidad balanceada (80)
      .webp({ quality: 80 })
      .toFile(outputPath);

    console.log(`Convertido: ${name} -> ${outName}`);
    return outName;
  } catch (e) {
    console.error('Error convirtiendo', name, e.message || e);
    return null;
  }
}

async function run() {
  const converted = [];

  for (const f of imageFiles) {
    const out = await convertFile(f);
    if (out) converted.push({ from: f, to: out });
  }

  console.log('\n--- Conversión completada. Archivos convertidos:', converted.length);

  // Actualizar preguntas.csv: sustituir referencias img/<file>.png/.jpg/.jpeg o img/<file> (sin extensión)
  if (!fs.existsSync(CSV_FILE)) {
    console.warn('No se encontró public/preguntas.csv — omitiendo actualización CSV.');
    return;
  }

  const csvText = fs.readFileSync(CSV_FILE, 'utf8');
  let outText = csvText;

  // Construir set de archivos .webp disponibles
  const webpFiles = new Set(fs.readdirSync(IMG_DIR).filter(f => f.toLowerCase().endsWith('.webp')));

  // Replace references that include extension or not
  // 1) replace explicit .png/.jpg/.jpeg
  outText = outText.replace(/img\/([a-zA-Z0-9_\-\.]+?)\.(png|jpg|jpeg)/gi, (m, name) => {
    const candidate = `${name}.webp`;
    if (webpFiles.has(candidate)) return `img/${candidate}`;
    return m; // leave as-is if no webp
  });

  // 2) replace references like img/fraccion3 (no extension) if webp exists for that base name
  outText = outText.replace(/img\/([a-zA-Z0-9_\-\.]+)(?=[,\r\n\"])/gi, (m, name) => {
    // If there is already an extension, skip (handled above). This regex catches no-extension tokens like img/fraccion3
    const candidate = `${name}.webp`;
    const pngCandidate = `${name}.png`;
    if (webpFiles.has(candidate)) return `img/${candidate}`;
    // If there is existing png file (and no webp), keep original as-is
    if (fs.existsSync(path.join(IMG_DIR, pngCandidate))) return `img/${pngCandidate}`;
    return m;
  });

  if (outText !== csvText) {
    const bak = CSV_FILE + '.bak-' + Date.now();
    fs.copyFileSync(CSV_FILE, bak);
    fs.writeFileSync(CSV_FILE, outText, 'utf8');
    console.log(`preguntas.csv actualizado — copia de seguridad: ${path.basename(bak)}`);
  } else {
    console.log('No se realizaron cambios en preguntas.csv (ninguna referencia actualizable a webp).');
  }
}

run().catch(e => {
  console.error('Error en conversión:', e);
  process.exit(1);
});
