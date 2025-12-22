import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { dbFunctions } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Esperar a que la base de datos se inicialice
async function waitForDB() {
  try {
    const conteos = await dbFunctions.obtenerConteos();
    console.log('✅ Base de datos inicializada');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Función para parsear CSV manualmente
function parseCSV(text) {
  const rows = [];
  let cur = "", row = [], inq = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    
    if (c === '"') {
      if (inq && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      inq = !inq;
    } else if (c === "," && !inq) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || (c === "\r" && n === "\n")) && !inq) {
      if (c === "\r") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }
  
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim().replace(/^"|"$/g, "")));
}

// Normalizar ruta de imagen
function normalizeImagePath(p) {
  if (!p) return null;
  let path = p.trim();
  if (!path) return null;
  path = path.replace(/^\/img\//, '').replace(/^img\//, '');
  path = path.replace(/^\//, '');
  return path;
}

// Normalizar nombre de área
function normalizeArea(area) {
  if (!area) return '';
  return area
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/['\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

// Normalizar grado
function normalizeGrade(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2})/);
  if (m) return `${m[1]}°`;
  return s;
}

async function seedQuestions() {
  try {
    console.log('🔄 Inicializando base de datos...');
    await waitForDB();
    
    console.log('🔄 Iniciando importación de preguntas desde CSV...');
    
    const csvPath = join(__dirname, '..', 'public', 'preguntas.csv');
    console.log(`📂 Leyendo archivo: ${csvPath}`);
    
    let csvContent;
    try {
      csvContent = readFileSync(csvPath, 'utf-8');
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error('El archivo CSV está vacío');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`No se encontró el archivo CSV en: ${csvPath}`);
      }
      throw error;
    }
    
    const rows = parseCSV(csvContent);
    
    if (rows.length < 2) {
      throw new Error('El archivo CSV está vacío o no tiene datos');
    }
    
    const headers = rows[0].map(h => h.trim());
    console.log('📋 Encabezados encontrados:', headers);
    
    const headerMap = {
      grado: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'grado' || lower === 'grade';
      }),
      area: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'area' || lower === 'área';
      }),
      pregunta: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'pregunta' || lower === 'question';
      }),
      imagenPregunta: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('imagenpregunta') || lower.includes('imagepregunta') || lower === 'imagenpregunta';
      }),
      opcion1: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'opcion1' || lower === 'option1' || lower === 'opción1';
      }),
      imagenOpcion1: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('imagenopcion1') || lower.includes('imageopcion1') || lower.includes('imagenopción1');
      }),
      opcion2: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'opcion2' || lower === 'option2' || lower === 'opción2';
      }),
      imagenOpcion2: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('imagenopcion2') || lower.includes('imageopcion2') || lower.includes('imagenopción2');
      }),
      opcion3: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'opcion3' || lower === 'option3' || lower === 'opción3';
      }),
      imagenOpcion3: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('imagenopcion3') || lower.includes('imageopcion3') || lower.includes('imagenopción3');
      }),
      opcion4: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'opcion4' || lower === 'option4' || lower === 'opción4';
      }),
      imagenOpcion4: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('imagenopcion4') || lower.includes('imageopcion4') || lower.includes('imagenopción4');
      }),
      respuesta: headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower === 'respuesta' || lower === 'answer' || lower === 'respuestacorrecta';
      }),
    };
    
    const requiredHeaders = ['grado', 'area', 'pregunta', 'respuesta'];
    for (const header of requiredHeaders) {
      if (headerMap[header] === -1) {
        throw new Error(`No se encontró la columna requerida: ${header}`);
      }
    }
    
    console.log('✅ Encabezados mapeados correctamente');
    
    const questionsToInsert = [];
    const errors = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => !cell || cell.trim() === '')) continue;
      
      const grado = normalizeGrade(row[headerMap.grado] || '');
      const area = normalizeArea(row[headerMap.area] || '');
      const pregunta = (row[headerMap.pregunta] || '').trim();
      const imagenPregunta = normalizeImagePath(row[headerMap.imagenPregunta]);
      const respuesta = (row[headerMap.respuesta] || '').trim();
      
      if (!grado || !area || !pregunta || !respuesta) {
        errors.push(`Fila ${i + 1}: Faltan campos obligatorios`);
        continue;
      }
      
      const opciones = [];
      for (let j = 1; j <= 4; j++) {
        const texto = (row[headerMap[`opcion${j}`]] || '').trim();
        const imagen = normalizeImagePath(row[headerMap[`imagenOpcion${j}`]]);
        opciones.push({ texto: texto || '', imagen: imagen || null });
      }
      
      const opcionesConTexto = opciones.filter(opt => opt.texto && opt.texto.trim() !== '');
      if (opcionesConTexto.length === 0) {
        errors.push(`Fila ${i + 1}: No se encontraron opciones con texto`);
        continue;
      }
      
      const opcionesTexto = opcionesConTexto.map(opt => opt.texto);
      if (!opcionesTexto.includes(respuesta)) {
        errors.push(`Fila ${i + 1}: La respuesta correcta "${respuesta}" no coincide con ninguna opción`);
        continue;
      }
      
      questionsToInsert.push({
        grado,
        area,
        pregunta,
        imagenPregunta: imagenPregunta || null,
        opciones,
        respuestaCorrecta: respuesta
      });
    }
    
    console.log(`📊 Preguntas válidas encontradas: ${questionsToInsert.length}`);
    if (errors.length > 0) {
      console.warn(`⚠️ Errores encontrados: ${errors.length}`);
      errors.slice(0, 10).forEach(err => console.warn(`  - ${err}`));
    }
    
    if (questionsToInsert.length === 0) {
      throw new Error('No se encontraron preguntas válidas para insertar');
    }
    
    console.log('🗑️ Eliminando preguntas existentes...');
    await dbFunctions.eliminarTodasLasPreguntas();
    
    console.log('💾 Insertando preguntas en la base de datos...');
    let inserted = 0;
    for (const q of questionsToInsert) {
      try {
        await dbFunctions.insertarPregunta(q);
        inserted++;
        if (inserted % 50 === 0) console.log(`  ✅ Insertadas ${inserted} preguntas...`);
      } catch (error) {
        console.error(`  ❌ Error insertando pregunta:`, error.message);
      }
    }
    
    console.log(`✅ Preguntas insertadas: ${inserted}`);
    
    console.log('⚙️ Creando configuraciones de examen...');
    const configs = await dbFunctions.obtenerConfiguracionesExamen();

    const upsertConfig = async (nombre, tiempo) => {
      const existing = configs.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      const data = {
        nombre,
        tiempo_limite_minutos: tiempo,
        preguntas_lenguaje: 5,
        preguntas_ingles: 5,
        preguntas_matematicas: 5,
        orden_aleatorio: 1
      };
      if (existing) {
        await dbFunctions.actualizarConfiguracionExamen(existing.id, data);
        console.log(`✅ Configuración "${nombre}" actualizada`);
      } else {
        await dbFunctions.crearConfiguracionExamen(data);
        console.log(`✅ Configuración "${nombre}" creada`);
      }
    };

    await upsertConfig('Examen 40 minutos', 40);
    await upsertConfig('Examen 60 minutos', 60);
    
    console.log('🎉 ¡Proceso completado exitosamente!');
  } catch (error) {
    console.error('❌ Error durante el proceso de seeding:', error);
    process.exit(1);
  }
}

seedQuestions()
  .then(() => {
    console.log('✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
