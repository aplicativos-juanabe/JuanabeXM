import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import the image normalization utility
const { normalizeImagePath } = await import('../src/utils/imageUtils.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'exam.db');

let db = null;
let isInitialized = false;

// Inicializar base de datos
async function initDatabase() {
  if (isInitialized) return db;

  try {
    console.log('🔄 Inicializando base de datos...');
    const SQL = await initSqlJs();

    if (existsSync(dbPath)) {
      console.log('📂 Cargando base de datos existente...');
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      console.log('🆕 Creando nueva base de datos...');
      db = new SQL.Database();
    }

    // Activar WAL y configurar PRAGMA
    try {
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA synchronous = NORMAL;');
      console.log('SQLite: WAL mode activado');
    } catch (e) {
      console.warn('No se pudo activar WAL:', e);
    }

    // Crear tablas si no existen
    db.run(`
  CREATE TABLE IF NOT EXISTS estudiantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT NOT NULL,
    grado TEXT NOT NULL,
    fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS examenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento TEXT NOT NULL,
    grado TEXT NOT NULL,  -- ⭐ AGREGAR ESTE CAMPO
    puntaje_total INTEGER NOT NULL,
    puntaje_lenguaje INTEGER NOT NULL,
    puntaje_ingles INTEGER NOT NULL,
    puntaje_matematicas INTEGER NOT NULL,
    aprobado INTEGER NOT NULL,
    tiempo_usado INTEGER NOT NULL,
    fecha_examen TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documento) REFERENCES estudiantes(documento)
  );

  CREATE TABLE IF NOT EXISTS respuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    examen_id INTEGER NOT NULL,
    pregunta_id TEXT NOT NULL,
    pregunta TEXT NOT NULL,
    area TEXT NOT NULL,
    respuesta_usuario TEXT NOT NULL,
    respuesta_correcta TEXT NOT NULL,
    es_correcta INTEGER NOT NULL,
    FOREIGN KEY (examen_id) REFERENCES examenes(id)
  );

  CREATE TABLE IF NOT EXISTS preguntas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grado TEXT NOT NULL,
    area TEXT NOT NULL,
    pregunta TEXT NOT NULL,
    imagen_pregunta TEXT,
    opcion1_texto TEXT,
    opcion1_imagen TEXT,
    opcion2_texto TEXT,
    opcion2_imagen TEXT,
    opcion3_texto TEXT,
    opcion3_imagen TEXT,
    opcion4_texto TEXT,
    opcion4_imagen TEXT,
    respuesta_correcta TEXT NOT NULL,
    fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS progreso_examen (
    documento TEXT PRIMARY KEY NOT NULL, -- PK para que solo haya un progreso por estudiante
    exam_id INTEGER,
    current_question_index INTEGER NOT NULL DEFAULT 0,
    answers_json TEXT NOT NULL DEFAULT '{}',
    questions_json TEXT NOT NULL DEFAULT '[]', -- JSON con las preguntas asignadas
    config_json TEXT NOT NULL DEFAULT '{}', -- JSON con la configuración del examen
    start_time TEXT DEFAULT CURRENT_TIMESTAMP,
    last_saved_time TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documento) REFERENCES estudiantes(documento)
  );

  CREATE TABLE IF NOT EXISTS exam_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tiempo_limite_minutos INTEGER NOT NULL,
    preguntas_lenguaje INTEGER NOT NULL DEFAULT 0,
    preguntas_ingles INTEGER NOT NULL DEFAULT 0,
    preguntas_matematicas INTEGER NOT NULL DEFAULT 0,
    orden_aleatorio INTEGER NOT NULL DEFAULT 1, -- 1 para true, 0 para false
    fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

    saveDatabase();
    // Ejecutar migraciones necesarias
    try {
      await migrateGrades();
    } catch (e) {
      console.warn('Error ejecutando migraciones de grado:', e);
    }

    // Crear configuraciones por defecto si no existen
    try {
      const configCount = db.prepare('SELECT COUNT(*) as count FROM exam_configurations').getAsObject().count;
      if (configCount === 0) {
        console.log('🔧 Creando configuraciones de examen por defecto...');

        // Configuración estándar
        db.run(
          `INSERT INTO exam_configurations (nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['Examen Estándar', 60, 5, 5, 5, 1]
        );

        // Configuración rápida
        db.run(
          `INSERT INTO exam_configurations (nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['Examen Rápido', 30, 3, 3, 3, 1]
        );

        console.log('✅ Configuraciones por defecto creadas');
      }
    } catch (configError) {
      console.warn('⚠️ Error creando configuraciones por defecto:', configError);
    }

    // Crear preguntas por defecto si no existen
    try {
      const questionCount = db.prepare('SELECT COUNT(*) as count FROM preguntas').getAsObject().count;
      if (questionCount === 0) {
        console.log('🔧 Creando preguntas de ejemplo...');

        // Preguntas para 3° grado
        const preguntas3 = [
          { grado: '3°', area: 'lenguaje', pregunta: '¿Cuál es el plural de "niño"?', opciones: ['niños', 'niñas', 'niñes'], respuesta: 'niños' },
          { grado: '3°', area: 'lenguaje', pregunta: '¿Qué es un sustantivo?', opciones: ['Una acción', 'Un objeto', 'Una descripción'], respuesta: 'Un objeto' },
          { grado: '3°', area: 'ingles', pregunta: 'How do you say "hola" in English?', opciones: ['Hello', 'Goodbye', 'Thank you'], respuesta: 'Hello' },
          { grado: '3°', area: 'ingles', pregunta: 'What is the color of the sky?', opciones: ['Blue', 'Green', 'Red'], respuesta: 'Blue' },
          { grado: '3°', area: 'matematicas', pregunta: '¿Cuánto es 2 + 3?', opciones: ['4', '5', '6'], respuesta: '5' },
          { grado: '3°', area: 'matematicas', pregunta: '¿Cuánto es 10 - 4?', opciones: ['5', '6', '7'], respuesta: '6' },
        ];

        // Preguntas para 4° grado
        const preguntas4 = [
          { grado: '4°', area: 'lenguaje', pregunta: '¿Qué es un verbo?', opciones: ['Una cosa', 'Una acción', 'Un lugar'], respuesta: 'Una acción' },
          { grado: '4°', area: 'lenguaje', pregunta: '¿Cuál es el femenino de "rey"?', opciones: ['reina', 'reyna', 'reyes'], respuesta: 'reina' },
          { grado: '4°', area: 'ingles', pregunta: 'How do you say "adiós" in English?', opciones: ['Hello', 'Goodbye', 'Please'], respuesta: 'Goodbye' },
          { grado: '4°', area: 'ingles', pregunta: 'What number comes after 9?', opciones: ['8', '10', '11'], respuesta: '10' },
          { grado: '4°', area: 'matematicas', pregunta: '¿Cuánto es 3 × 4?', opciones: ['7', '12', '15'], respuesta: '12' },
          { grado: '4°', area: 'matematicas', pregunta: '¿Cuánto es 20 ÷ 4?', opciones: ['4', '5', '6'], respuesta: '5' },
        ];

        // Insertar preguntas
        [...preguntas3, ...preguntas4].forEach((q, index) => {
          db.run(
            `INSERT INTO preguntas (grado, area, pregunta, opcion1_texto, opcion2_texto, opcion3_texto, opcion4_texto, respuesta_correcta)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [q.grado, q.area, q.pregunta, q.opciones[0], q.opciones[1], q.opciones[2], q.opciones[3] || '', q.respuesta]
          );
        });

        console.log('✅ Preguntas de ejemplo creadas');
      }
    } catch (questionError) {
      console.warn('⚠️ Error creando preguntas por defecto:', questionError);
    }

    saveDatabase();
    isInitialized = true;
    console.log('✅ Base de datos inicializada correctamente');
    return db;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}

// Normalizar nombre de grado a formato '3°', '4°', etc.
function normalizeGradeServer(raw) {
  if (raw === null || typeof raw === 'undefined') return '';
  let s = String(raw).trim();
  if (!s) return '';

  // Corregir mojibake/encodings comunes que aparecen como caracteres extraños
  // Ejemplos: '6┬░' -> '6°', '6Â°' -> '6°', '6Ã‚°' -> '6°'
  try {
    s = s.replace(/┬░/g, '°');
    s = s.replace(/Â°/g, '°');
    s = s.replace(/Ã‚°/g, '°');
    // Quitar marcas residuales de codificación que puedan quedar
    s = s.replace(/[ÂÃ]/g, '');
    s = s.trim();
  } catch (e) {
    // no hacer nada si falla la limpieza
  }

  // Buscar número en la cadena
  const m = s.match(/(\d{1,2})/);
  if (m) return `${m[1]}°`;

  const normalized = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');

  const map = {
    tercero: '3°',
    terceroa: '3°',
    cuarto: '4°',
    quinto: '5°',
    sexto: '6°',
    septimo: '7°',
    septimoa: '7°',
    octavo: '8°',
    noveno: '9°',
    decimo: '10°',
    undecimo: '11°',
    once: '11°'
  };

  for (const key in map) {
    if (normalized.includes(key)) return map[key];
  }

  return s;
}

// Migración: normalizar los valores de 'grado' en estudiantes y examenes
async function migrateGrades() {
  if (!db) return;
  try {
    console.log('🔧 Ejecutando migración: normalizar grados...');
    let changedEst = 0;
    let changedExam = 0;

    // Estudiantes
    const stmtE = db.prepare('SELECT documento, grado FROM estudiantes');
    const updatesEst = [];
    while (stmtE.step()) {
      const row = stmtE.getAsObject();
      const norm = normalizeGradeServer(row.grado);
      if (norm && norm !== String(row.grado)) {
        updatesEst.push({ documento: row.documento, grado: norm });
      }
    }
    stmtE.free();

    updatesEst.forEach(u => {
      db.run('UPDATE estudiantes SET grado = ? WHERE documento = ?', [u.grado, u.documento]);
      changedEst++;
    });

    // Examenes
    const stmtEx = db.prepare('SELECT id, grado FROM examenes');
    const updatesEx = [];
    while (stmtEx.step()) {
      const row = stmtEx.getAsObject();
      const norm = normalizeGradeServer(row.grado);
      if (norm && norm !== String(row.grado)) {
        updatesEx.push({ id: row.id, grado: norm });
      }
    }
    stmtEx.free();

    updatesEx.forEach(u => {
      db.run('UPDATE examenes SET grado = ? WHERE id = ?', [u.grado, u.id]);
      changedExam++;
    });

    if (changedEst || changedExam) saveDatabase();
    console.log(`🔧 Migración completa. Estudiantes actualizados: ${changedEst}, Exámenes actualizados: ${changedExam}`);
  } catch (e) {
    console.error('Error durante migrateGrades:', e);
    throw e;
  }
}

// Guardar base de datos en disco
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('Error guardando base de datos:', error);
  }
}

// Asegurar que DB está inicializada
async function ensureDB() {
  if (!db || !isInitialized) {
    await initDatabase();
  }
  return db;
}

// Funciones de la base de datos
export const dbFunctions = {
  // Verificar si un estudiante ya existe
  async estudianteExiste(documento) {
    await ensureDB();
    const stmt = db.prepare('SELECT * FROM estudiantes WHERE documento = ?');
    stmt.bind([documento]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  },

  // Verificar si ya realizó el examen
  async examenRealizado(documento) {
    await ensureDB();
    const stmt = db.prepare('SELECT * FROM examenes WHERE documento = ? ORDER BY fecha_examen DESC LIMIT 1');
    stmt.bind([documento]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  },

  // Registrar estudiante
  async registrarEstudiante(datos) {
    await ensureDB();
    try {
      // Si el estudiante ya existe, actualizar sus datos (incluyendo grado)
      const existente = await this.estudianteExiste(datos.documento);
      if (existente) {
        db.run(
          `UPDATE estudiantes SET nombre = ?, apellido = ?, email = ?, telefono = ?, grado = ? WHERE documento = ?`,
          [datos.nombre, datos.apellido, datos.email, datos.telefono, datos.grado, datos.documento]
        );
        saveDatabase();
        return { success: true, updated: true };
      }

      db.run(
        `INSERT INTO estudiantes (documento, nombre, apellido, email, telefono, grado)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [datos.documento, datos.nombre, datos.apellido, datos.email, datos.telefono, datos.grado]
      );
      saveDatabase();
      return { success: true, created: true };
    } catch (error) {
      console.error('Error registrando estudiante:', error);
      throw error;
    }
  },

  // Guardar examen completo
  async guardarExamen(documento, resultados, tiempoUsado) {
    await ensureDB();
    try {
      // ⭐ Primero obtener el grado del estudiante
      const estudiante = await this.estudianteExiste(documento);
      const grado = estudiante ? estudiante.grado : 'N/A';
      // Asegurar estructura mínima en 'resultados'
      const score = (resultados && typeof resultados.score === 'number') ? resultados.score : 0;
      const byArea = (resultados && resultados.byArea) ? resultados.byArea : { lenguaje: 0, ingles: 0, matematicas: 0 };
      const passed = resultados && resultados.passed ? 1 : 0;

      // Insertar examen CON grado (usar valores por defecto si faltan)
      db.run(
        `INSERT INTO examenes (documento, grado, puntaje_total, puntaje_lenguaje, puntaje_ingles, 
                             puntaje_matematicas, aprobado, tiempo_usado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          documento,
          grado,
          Number.isFinite(score) ? score : 0,
          Number.isFinite(byArea.lenguaje) ? byArea.lenguaje : 0,
          Number.isFinite(byArea.ingles) ? byArea.ingles : 0,
          Number.isFinite(byArea.matematicas) ? byArea.matematicas : 0,
          passed,
          (typeof tiempoUsado === 'number' && Number.isFinite(tiempoUsado)) ? tiempoUsado : 0
        ]
      );

      // Obtener el ID del examen insertado
      const stmt = db.prepare('SELECT last_insert_rowid() as id');
      stmt.step();
      const examenId = stmt.getAsObject().id;
      stmt.free();

      // Insertar cada respuesta (si hay detalles)
      const detalles = Array.isArray(resultados && resultados.detail) ? resultados.detail : [];
      detalles.forEach(detalle => {
        try {
          const preguntaId = (detalle && typeof detalle.id !== 'undefined') ? String(detalle.id) : null;
          const preguntaText = (detalle && typeof detalle.pregunta !== 'undefined') ? String(detalle.pregunta) : '';
          const areaText = (detalle && typeof detalle.area !== 'undefined') ? String(detalle.area) : '';
          const respuestaUsuario = (detalle && typeof detalle.userAnswer !== 'undefined') ? String(detalle.userAnswer) : '';
          const respuestaCorrecta = (detalle && typeof detalle.respuesta !== 'undefined') ? String(detalle.respuesta) : '';
          const esCorrecta = detalle && detalle.isCorrect ? 1 : 0;

          db.run(
            `INSERT INTO respuestas (examen_id, pregunta_id, pregunta, area, respuesta_usuario, 
                                   respuesta_correcta, es_correcta)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [examenId, preguntaId, preguntaText, areaText, respuestaUsuario, respuestaCorrecta, esCorrecta]
          );
        } catch (e) {
          console.warn('No se pudo insertar detalle de respuesta:', e, detalle);
        }
      });

      saveDatabase();
      return examenId;
    } catch (error) {
      console.error('Error guardando examen:', error);
      throw error;
    }
  },

  // Obtener resultado de examen por documento
  async obtenerResultado(documento) {
    await ensureDB();
    const stmt = db.prepare(`
      SELECT e.*, est.nombre, est.apellido, est.email, est.grado
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      WHERE e.documento = ?
      ORDER BY e.fecha_examen DESC
      LIMIT 1
    `);
    stmt.bind([documento]);
    const examen = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();

    if (!examen) return null;

    const stmtResp = db.prepare('SELECT * FROM respuestas WHERE examen_id = ?');
    stmtResp.bind([examen.id]);
    const respuestas = [];
    while (stmtResp.step()) {
      respuestas.push(stmtResp.getAsObject());
    }
    stmtResp.free();

    return { ...examen, respuestas };
  },

  // Obtener resultado de examen por ID
  async obtenerResultadoPorId(examenId) {
    await ensureDB();
    const stmt = db.prepare(`
      SELECT e.*, est.nombre, est.apellido, est.email
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      WHERE e.id = ?
    `);
    stmt.bind([examenId]);
    const examen = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();

    if (!examen) return null;

    // Obtener todas las respuestas/preguntas del examen con información de imagen
    // Usar una consulta más robusta que maneje casos donde pregunta_id puede no estar disponible
    const stmtResp = db.prepare(`
      SELECT
        r.*,
        COALESCE(p.imagen_pregunta, p2.imagen_pregunta) as imagenPregunta
      FROM respuestas r
      LEFT JOIN preguntas p ON r.pregunta_id = CAST(p.id AS TEXT)
      LEFT JOIN preguntas p2 ON r.pregunta = p2.pregunta AND r.area = p2.area
      WHERE r.examen_id = ?
      ORDER BY r.id
    `);
    stmtResp.bind([examenId]);
    const respuestas = [];
    while (stmtResp.step()) {
      const respuesta = stmtResp.getAsObject();
      // Normalizar la ruta de la imagen si existe
      if (respuesta.imagenPregunta) {
        respuesta.imagenPregunta = normalizeImagePath ? normalizeImagePath(respuesta.imagenPregunta) : respuesta.imagenPregunta;
      }
      respuestas.push(respuesta);
    }
    stmtResp.free();

    return { ...examen, respuestas };
  },

  // Obtener todos los resultados
  async obtenerTodosResultados() {
    await ensureDB();
    const stmt = db.prepare(`
      SELECT e.*, est.nombre, est.apellido
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      ORDER BY e.fecha_examen DESC
    `);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  // Obtener conteos rápidos para diagnóstico
  async obtenerConteos() {
    await ensureDB();
    try {
      const stmt1 = db.prepare('SELECT COUNT(*) as total FROM estudiantes');
      stmt1.step();
      const estudiantes = stmt1.getAsObject().total || 0;
      stmt1.free();

      const stmt2 = db.prepare('SELECT COUNT(*) as total FROM examenes');
      stmt2.step();
      const examenes = stmt2.getAsObject().total || 0;
      stmt2.free();

      const stmt3 = db.prepare('SELECT COUNT(*) as total FROM respuestas');
      stmt3.step();
      const respuestas = stmt3.getAsObject().total || 0;
      stmt3.free();

      const stmt4 = db.prepare('SELECT COUNT(*) as total FROM preguntas');
      stmt4.step();
      const preguntas = stmt4.getAsObject().total || 0;
      stmt4.free();

      const stmt5 = db.prepare('SELECT COUNT(*) as total FROM exam_configurations');
      stmt5.step();
      const configuraciones = stmt5.getAsObject().total || 0;
      stmt5.free();

      return { estudiantes, examenes, respuestas, preguntas, configuraciones };
    } catch (error) {
      console.error('Error obteniendo conteos:', error);
      throw error;
    }
  },

  async obtenerEstadisticas() {
    await ensureDB();
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_examenes,
        SUM(aprobado) as total_aprobados,
        AVG(puntaje_total) as promedio_general,
        AVG(puntaje_lenguaje) as promedio_lenguaje,
        AVG(puntaje_ingles) as promedio_ingles,
        AVG(puntaje_matematicas) as promedio_matematicas
      FROM examenes
    `);
    stmt.step();
    const stats = stmt.getAsObject();
    stmt.free();
    return stats;
  },

  // Eliminar examen y sus respuestas
  async eliminarExamen(examenId) {
    await ensureDB();
    try {
      // Eliminar respuestas primero (por la foreign key)
      db.run('DELETE FROM respuestas WHERE examen_id = ?', [examenId]);

      // Eliminar examen
      db.run('DELETE FROM examenes WHERE id = ?', [examenId]);

      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando examen:', error);
      throw error;
    }
  },

  // Eliminar estudiante y todos sus exámenes
  async eliminarEstudiante(documento) {
    await ensureDB();
    try {
      // Obtener IDs de exámenes del estudiante
      const stmtExamenes = db.prepare('SELECT id FROM examenes WHERE documento = ?');
      stmtExamenes.bind([documento]);
      const examenesIds = [];
      while (stmtExamenes.step()) {
        examenesIds.push(stmtExamenes.getAsObject().id);
      }
      stmtExamenes.free();

      // Eliminar respuestas de todos los exámenes
      examenesIds.forEach(id => {
        db.run('DELETE FROM respuestas WHERE examen_id = ?', [id]);
      });

      // Eliminar exámenes
      db.run('DELETE FROM examenes WHERE documento = ?', [documento]);

      // Eliminar estudiante
      db.run('DELETE FROM estudiantes WHERE documento = ?', [documento]);

      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando estudiante:', error);
      throw error;
    }
  },

  // Funciones para la tabla de preguntas
  async obtenerTodasLasPreguntas() {
    await ensureDB();
    const stmt = db.prepare(`SELECT * FROM preguntas ORDER BY grado, area, id`);
    const preguntas = [];
    while (stmt.step()) {
      const pregunta = stmt.getAsObject();
      // Transformar el formato de base de datos al formato esperado por el frontend
      pregunta.opciones = [
        { texto: pregunta.opcion1_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion1_imagen) : pregunta.opcion1_imagen || '' },
        { texto: pregunta.opcion2_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion2_imagen) : pregunta.opcion2_imagen || '' },
        { texto: pregunta.opcion3_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion3_imagen) : pregunta.opcion3_imagen || '' },
        { texto: pregunta.opcion4_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion4_imagen) : pregunta.opcion4_imagen || '' },
      ];
      // Normalize the question image path
      pregunta.imagenPregunta = normalizeImagePath ? normalizeImagePath(pregunta.imagen_pregunta) : pregunta.imagen_pregunta;
      // Set the respuesta property for the frontend
      pregunta.respuesta = pregunta.respuesta_correcta;
      // Limpiar las propiedades individuales
      delete pregunta.opcion1_texto;
      delete pregunta.opcion1_imagen;
      delete pregunta.opcion2_texto;
      delete pregunta.opcion2_imagen;
      delete pregunta.opcion3_texto;
      delete pregunta.opcion3_imagen;
      delete pregunta.opcion4_texto;
      delete pregunta.opcion4_imagen;
      delete pregunta.imagen_pregunta;
      delete pregunta.respuesta_correcta;
      preguntas.push(pregunta);
    }
    stmt.free();
    return preguntas;
  },

  async obtenerPreguntasPorGrado(grado) {
    await ensureDB();
    const stmt = db.prepare(`SELECT * FROM preguntas WHERE grado = ? ORDER BY area, id`);
    stmt.bind([grado]);
    const preguntas = [];
    while (stmt.step()) {
      preguntas.push(stmt.getAsObject());
    }
    stmt.free();
    return preguntas;
  },

  async obtenerPreguntaPorId(id) {
    await ensureDB();
    const stmt = db.prepare(`SELECT * FROM preguntas WHERE id = ?`);
    stmt.bind([id]);
    const pregunta = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();

    if (pregunta) {
      // Transformar el formato de base de datos al formato esperado por el frontend
      pregunta.opciones = [
        { texto: pregunta.opcion1_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion1_imagen) : pregunta.opcion1_imagen || '' },
        { texto: pregunta.opcion2_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion2_imagen) : pregunta.opcion2_imagen || '' },
        { texto: pregunta.opcion3_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion3_imagen) : pregunta.opcion3_imagen || '' },
        { texto: pregunta.opcion4_texto || '', imagen: normalizeImagePath ? normalizeImagePath(pregunta.opcion4_imagen) : pregunta.opcion4_imagen || '' },
      ];
      // Normalize the question image path
      pregunta.imagenPregunta = normalizeImagePath ? normalizeImagePath(pregunta.imagen_pregunta) : pregunta.imagen_pregunta;
      // Set the respuesta property for the frontend
      pregunta.respuesta = pregunta.respuesta_correcta;
      // Limpiar las propiedades individuales
      delete pregunta.opcion1_texto;
      delete pregunta.opcion1_imagen;
      delete pregunta.opcion2_texto;
      delete pregunta.opcion2_imagen;
      delete pregunta.opcion3_texto;
      delete pregunta.opcion3_imagen;
      delete pregunta.opcion4_texto;
      delete pregunta.opcion4_imagen;
      delete pregunta.imagen_pregunta;
      delete pregunta.respuesta_correcta;
    }

    return pregunta;
  },

  async insertarPregunta(data) {
    await ensureDB();
    try {
      // Asegurar que siempre haya 4 opciones (rellenar con vacíos si faltan)
      const opciones = data.opciones || [];
      while (opciones.length < 4) {
        opciones.push({ texto: '', imagen: null });
      }
      
      db.run(
        `INSERT INTO preguntas (grado, area, pregunta, imagen_pregunta, opcion1_texto, opcion1_imagen, opcion2_texto, opcion2_imagen, opcion3_texto, opcion3_imagen, opcion4_texto, opcion4_imagen, respuesta_correcta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.grado, data.area, data.pregunta, data.imagenPregunta || null,
          opciones[0]?.texto || '', opciones[0]?.imagen || null,
          opciones[1]?.texto || '', opciones[1]?.imagen || null,
          opciones[2]?.texto || '', opciones[2]?.imagen || null,
          opciones[3]?.texto || '', opciones[3]?.imagen || null,
          data.respuestaCorrecta
        ]
      );
      saveDatabase();
      
      // Obtener el ID del registro insertado usando prepare (más confiable)
      const stmt = db.prepare('SELECT last_insert_rowid() as id');
      stmt.step();
      const id = stmt.getAsObject().id;
      stmt.free();
      
      return { success: true, id };
    } catch (error) {
      console.error('Error insertando pregunta:', error);
      throw error;
    }
  },

  async actualizarPregunta(id, data) {
    await ensureDB();
    try {
      // Asegurar que siempre haya 4 opciones (rellenar con vacíos si faltan)
      const opciones = data.opciones || [];
      while (opciones.length < 4) {
        opciones.push({ texto: '', imagen: '' });
      }

      db.run(
        `UPDATE preguntas SET grado = ?, area = ?, pregunta = ?, imagen_pregunta = ?,
         opcion1_texto = ?, opcion1_imagen = ?, opcion2_texto = ?, opcion2_imagen = ?,
         opcion3_texto = ?, opcion3_imagen = ?, opcion4_texto = ?, opcion4_imagen = ?,
         respuesta_correcta = ?, fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.grado, data.area, data.pregunta, data.imagenPregunta || '',
          opciones[0]?.texto || '', opciones[0]?.imagen || '',
          opciones[1]?.texto || '', opciones[1]?.imagen || '',
          opciones[2]?.texto || '', opciones[2]?.imagen || '',
          opciones[3]?.texto || '', opciones[3]?.imagen || '',
          data.respuestaCorrecta,
          id
        ]
      );
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error actualizando pregunta:', error);
      throw error;
    }
  },

  async eliminarPregunta(id) {
    await ensureDB();
    try {
      db.run('DELETE FROM preguntas WHERE id = ?', [id]);
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando pregunta:', error);
      throw error;
    }
  },

  async eliminarTodasLasPreguntas() {
    await ensureDB();
    try {
      db.run('DELETE FROM preguntas');
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando todas las preguntas:', error);
      throw error;
    }
  },

  // Funciones para guardar y recuperar el progreso del examen
  async guardarProgresoExamen(documento, currentQuestionIndex, answersJson, questionsJson = null, configJson = null, examId = null, remainingTimeSeconds = null) {
    await ensureDB();
    try {
      // Ensure we have valid JSON strings or use defaults
      const questionsJsonStr = questionsJson ? JSON.stringify(questionsJson) : '[]';
      const configJsonStr = configJson ? JSON.stringify(configJson) : '{}';
      const answersJsonStr = answersJson ? JSON.stringify(answersJson) : '{}';

      // UPSERT: Si existe, actualiza; si no, inserta
      db.run(
        `INSERT INTO progreso_examen (documento, exam_id, current_question_index, answers_json, questions_json, config_json, remaining_time_seconds, last_saved_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(documento) DO UPDATE SET
           exam_id = excluded.exam_id,
           current_question_index = excluded.current_question_index,
           answers_json = excluded.answers_json,
           questions_json = excluded.questions_json,
           config_json = excluded.config_json,
           remaining_time_seconds = excluded.remaining_time_seconds,
           last_saved_time = CURRENT_TIMESTAMP;`,
        [documento, examId, currentQuestionIndex, answersJsonStr, questionsJsonStr, configJsonStr, remainingTimeSeconds]
      );
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error guardando progreso del examen:', error);
      throw error;
    }
  },

  async obtenerProgresoExamen(documento) {
    await ensureDB();
    const stmt = db.prepare(`SELECT * FROM progreso_examen WHERE documento = ?`);
    stmt.bind([documento]);
    const progreso = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return progreso;
  },

  async eliminarProgresoExamen(documento) {
    await ensureDB();
    try {
      db.run('DELETE FROM progreso_examen WHERE documento = ?', [documento]);
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando progreso del examen:', error);
      throw error;
    }
  },

  async obtenerTodosProgresosPendientes() {
    await ensureDB();
    const stmt = db.prepare(`
      SELECT p.*, e.nombre, e.apellido
      FROM progreso_examen p
      LEFT JOIN estudiantes e ON p.documento = e.documento
      ORDER BY p.last_saved_time DESC
    `);
    const progressList = [];
    while (stmt.step()) {
      const progress = stmt.getAsObject();
      // Parse JSON fields
      try {
        progress.questions_json = JSON.parse(progress.questions_json || '[]');
        progress.config_json = JSON.parse(progress.config_json || '{}');
        progress.answers_json = JSON.parse(progress.answers_json || '{}');
      } catch (e) {
        console.warn('Error parsing JSON for progress:', progress.documento, e);
      }
      progressList.push(progress);
    }
    stmt.free();
    return progressList;
  },

  // Funciones para configuraciones de examen
  async obtenerConfiguracionesExamen() {
    await ensureDB();
    const stmt = db.prepare('SELECT * FROM exam_configurations ORDER BY fecha_creacion DESC');
    const configs = [];
    while (stmt.step()) {
      configs.push(stmt.getAsObject());
    }
    stmt.free();
    return configs;
  },

  async obtenerConfiguracionExamenPorId(id) {
    await ensureDB();
    const stmt = db.prepare('SELECT * FROM exam_configurations WHERE id = ?');
    stmt.bind([id]);
    const config = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return config;
  },

  async crearConfiguracionExamen(data) {
    await ensureDB();
    try {
      // Validar y convertir tipos de datos
      const nombre = String(data.nombre || '').trim();
      if (!nombre) {
        throw new Error('El nombre de la configuración es obligatorio');
      }
      
      const tiempo_limite_minutos = parseInt(data.tiempo_limite_minutos, 10);
      const preguntas_lenguaje = parseInt(data.preguntas_lenguaje, 10) || 0;
      const preguntas_ingles = parseInt(data.preguntas_ingles, 10) || 0;
      const preguntas_matematicas = parseInt(data.preguntas_matematicas, 10) || 0;
      const orden_aleatorio = data.orden_aleatorio === 1 || data.orden_aleatorio === true ? 1 : 0;

      if (isNaN(tiempo_limite_minutos) || tiempo_limite_minutos <= 0) {
        throw new Error('El tiempo límite debe ser un número positivo');
      }

      db.run(
        `INSERT INTO exam_configurations (nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio]
      );
      saveDatabase();

      // Obtener el ID del registro insertado usando prepare (más confiable)
      const stmt = db.prepare('SELECT last_insert_rowid() as id');
      stmt.step();
      const id = stmt.getAsObject().id;
      stmt.free();

      return { success: true, id };
    } catch (error) {
      console.error('Error creando configuración de examen:', error);
      throw error;
    }
  },

  async actualizarConfiguracionExamen(id, data) {
    await ensureDB();
    try {
      // Validar y convertir tipos de datos
      const nombre = String(data.nombre || '').trim();
      if (!nombre) {
        throw new Error('El nombre de la configuración es obligatorio');
      }
      
      const tiempo_limite_minutos = parseInt(data.tiempo_limite_minutos, 10);
      const preguntas_lenguaje = parseInt(data.preguntas_lenguaje, 10) || 0;
      const preguntas_ingles = parseInt(data.preguntas_ingles, 10) || 0;
      const preguntas_matematicas = parseInt(data.preguntas_matematicas, 10) || 0;
      const orden_aleatorio = data.orden_aleatorio === 1 || data.orden_aleatorio === true ? 1 : 0;

      if (isNaN(tiempo_limite_minutos) || tiempo_limite_minutos <= 0) {
        throw new Error('El tiempo límite debe ser un número positivo');
      }

      db.run(
        `UPDATE exam_configurations SET
         nombre = ?, tiempo_limite_minutos = ?, preguntas_lenguaje = ?, preguntas_ingles = ?,
         preguntas_matematicas = ?, orden_aleatorio = ?, fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio, id]
      );
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error actualizando configuración de examen:', error);
      throw error;
    }
  },

  async eliminarConfiguracionExamen(id) {
    await ensureDB();
    try {
      db.run('DELETE FROM exam_configurations WHERE id = ?', [id]);
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando configuración de examen:', error);
      throw error;
    }
  }
};

// Inicializar al cargar el módulo
await initDatabase();

export default db;
