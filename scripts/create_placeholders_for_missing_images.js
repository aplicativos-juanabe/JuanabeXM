#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

const regex = /img\/([^,\n\r"']+)/g;
const refs = new Set();
let m;
while ((m = regex.exec(csv)) !== null) {
  let token = m[1].trim();
  token = token.replace(/[).;]+$/g, '');
  refs.add(token);
}

// List existing files
const existing = fs.readdirSync(imgDir).filter(f => fs.statSync(path.join(imgDir, f)).isFile());
const existingSet = new Set(existing.map(f => f));
const existingLowerMap = new Map(existing.map(f => [f.toLowerCase(), f]));

const missing = [];
for (const r of refs) {
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(r)) continue; // skip malformed
  if (existingSet.has(r)) continue;
  if (existingLowerMap.has(r.toLowerCase())) continue;
  missing.push(r);
}

if (!missing.length) {
  console.log('No missing referenced images found — nothing to do.');
  process.exit(0);
}

console.log('Missing referenced files detected:', missing.length);

// Create a timestamped backup of CSV
const backupPath = csvPath + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(backupPath, csv, 'utf8');
console.log('CSV backup saved to', backupPath);

const created = [];

async function createPlaceholder(name) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext);

  // We'll create a WebP placeholder with the same basename
  const outName = base + '.webp';
  const outPath = path.join(imgDir, outName);

  if (fs.existsSync(outPath)) return null; // already present

  // Create a simple SVG canvas and convert to WebP
  const svg = `
  <svg width="1200" height="900" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#eeeeee" />
    <rect x="20" y="20" width="1160" height="860" fill="#f8f8f8" stroke="#cccccc" stroke-width="2" rx="8" />
    <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#666" font-family="Arial,Helvetica,sans-serif" font-size="48">MISSING IMAGE</text>
    <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#444" font-family="Arial,Helvetica,sans-serif" font-size="32">${base}</text>
  </svg>`;

  try {
    const buffer = Buffer.from(svg);
    await sharp(buffer).webp({ quality: 80 }).toFile(outPath);
    return outName;
  } catch (err) {
    console.error('Failed to create placeholder for', name, err);
    return null;
  }
}

(async function run() {
  for (const name of missing) {
    const createdName = await createPlaceholder(name);
    if (createdName) created.push({ original: name, created: createdName });
  }

  if (!created.length) {
    console.log('No placeholders were created (maybe files already existed).');
    process.exit(0);
  }

  console.log('Created placeholders:', created.length);

  // Update the CSV: replace occurrences of img/<originalExt> with img/<basename>.webp
  let updatedCsv = csv;
  for (const item of created) {
    const orig = item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fromRegex = new RegExp('img/' + orig, 'g');
    const to = 'img/' + item.created;
    updatedCsv = updatedCsv.replace(fromRegex, to);
  }

  fs.writeFileSync(csvPath, updatedCsv, 'utf8');
  console.log('preguntas.csv updated with placeholder references.');

  console.log('Placeholders created for:');
  created.forEach(c => console.log(' -', c.original, '->', c.created));

  process.exit(0);
})();