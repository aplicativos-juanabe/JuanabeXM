import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
`);

    saveDatabase();
    // Ejecutar migraciones necesarias
    try {
      await migrateGrades();
    } catch (e) {
      console.warn('Error ejecutando migraciones de grado:', e);
    }

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

    // Obtener todas las respuestas/preguntas del examen
    const stmtResp = db.prepare('SELECT * FROM respuestas WHERE examen_id = ? ORDER BY id');
    stmtResp.bind([examenId]);
    const respuestas = [];
    while (stmtResp.step()) {
      respuestas.push(stmtResp.getAsObject());
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

      return { estudiantes, examenes, respuestas };
    } catch (error) {
      console.error('Error obteniendo conteos:', error);
      throw error;
    }
  },

  // Estadísticas generales
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
  }
};

// Inicializar al cargar el módulo
await initDatabase();

export default db;