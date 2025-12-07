#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const csvPath = path.join(process.cwd(), 'public', 'preguntas.csv');
const imgDir = path.join(process.cwd(), 'public', 'img');

if (!fs.existsSync(csvPath)) {
  console.error('preguntas.csv not found');
  process.exit(2);
}
if (!fs.existsSync(imgDir)) {
  console.error('public/img directory not found');
  process.exit(2);
}

const csv = fs.readFileSync(csvPath, 'utf8');

// Extract tokens that look like 'img/...' between commas or quoted fields
const regex = /img\/([^,\n\r"']+)/g;
const refs = new Set();
let m;
while ((m = regex.exec(csv)) !== null) {
  let token = m[1].trim();
  // strip trailing punctuation
  token = token.replace(/[).;]+$/g, '');
  // Keep only filename (avoid cases like 'fraccion3,45°')
  refs.add(token);
}

const referenced = Array.from(refs).sort();
const existing = fs.readdirSync(imgDir).filter(f => fs.statSync(path.join(imgDir, f)).isFile());

const existingSet = new Set(existing.map(f => f));
const existingLowerMap = new Map(existing.map(f => [f.toLowerCase(), f]));

const missing = [];
const caseDiffs = [];
const malformed = [];

referenced.forEach(r => {
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(r)) {
    malformed.push(r);
    return;
  }
  if (existingSet.has(r)) return;
  const lower = r.toLowerCase();
  if (existingLowerMap.has(lower)) {
    caseDiffs.push({ ref: r, found: existingLowerMap.get(lower) });
  } else {
    missing.push(r);
  }
});

console.log('--- IMAGENES REFERENCIADAS EN preguntas.csv (total):', referenced.length);
console.log('--- ARCHIVOS EN public/img (total):', existing.length);
console.log('');
if (malformed.length) {
  console.log('-> Entradas referenciadas SIN extensión o mal formateadas:');
  malformed.forEach(x => console.log('   -', x));
  console.log('');
}

if (caseDiffs.length) {
  console.log('-> Coincidencias por diferencia de mayúsculas/minúsculas:');
  caseDiffs.forEach(x => console.log(`   - ${x.ref}  (archivo encontrado: ${x.found})`));
  console.log('');
}

if (missing.length) {
  console.log('-> Referencias faltantes en public/img:');
  missing.forEach(x => console.log('   -', x));
  console.log('');
} else {
  console.log('No hay referencias faltantes (según parsing automático).');
}

// Optional: list top example files present
console.log('\n--- Ejemplos de archivos presentes en public/img (hasta 20):');
existing.slice(0, 20).forEach(f => console.log('   -', f));

process.exit(0);
