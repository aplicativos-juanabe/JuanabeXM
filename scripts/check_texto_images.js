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
const regex = /img\/(texto\d+\.png)/g;
const refs = new Set();
let m;
while ((m = regex.exec(csv)) !== null) refs.add(m[1]);

if (!refs.size) {
  console.log('No se encontraron referencias tipo texto##.png en preguntas.csv');
  process.exit(0);
}

const results = [];
for (const name of Array.from(refs).sort()) {
  const p = path.join(imgDir, name);
  if (!fs.existsSync(p)) {
    results.push({ name, exists: false });
    continue;
  }
  const stat = fs.statSync(p);
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  const sig = buf.toString('hex');
  results.push({ name, exists: true, size: stat.size, sig });
}

console.log('Revisando imágenes texto##.png referenciadas en preguntas.csv');
console.log('Total referencias distintas:', refs.size);
console.log('----\n');
const missing = results.filter(r => !r.exists);
const present = results.filter(r => r.exists);

if (missing.length) {
  console.log('Faltantes en public/img:');
  missing.forEach(m => console.log(' -', m.name));
  console.log('');
}

console.log('Archivos presentes (reporte):');
present.forEach(p => {
  // PNG signature is "89504e470d0a1a0a"
  const okPNG = p.sig === '89504e470d0a1a0a';
  console.log(` - ${p.name}  size=${p.size} bytes  PNGsig=${p.sig}  validPNG=${okPNG}`);
});

const invalid = present.filter(p => p.sig !== '89504e470d0a1a0a');
if (invalid.length) {
  console.log('\n!! Archivos existentes con firma diferente a PNG (posible corrupción o formato distinto):');
  invalid.forEach(i => console.log(' -', i.name, 'sig=' + i.sig));
}

process.exit(0);
