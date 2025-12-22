import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'exam.db');

let db = null;

// Inicializar base de datos
function initDatabase() {
  if (db) return db;

  try {
    console.log('🔄 Inicializando base de datos con better-sqlite3...');
    db = new Database(dbPath);

    // Configurar PRAGMAs para rendimiento
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // Crear tablas si no existen
    db.exec(`
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
        grado TEXT NOT NULL,
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
        documento TEXT PRIMARY KEY NOT NULL,
        exam_id INTEGER,
        current_question_index INTEGER NOT NULL DEFAULT 0,
        answers_json TEXT NOT NULL DEFAULT '{}',
        questions_json TEXT NOT NULL DEFAULT '[]',
        config_json TEXT NOT NULL DEFAULT '{}',
        remaining_time_seconds INTEGER,
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
        orden_aleatorio INTEGER NOT NULL DEFAULT 1,
        fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear configuraciones por defecto si no existen
    const configCount = db.prepare('SELECT COUNT(*) as count FROM exam_configurations').get().count;
    if (configCount === 0) {
      console.log('🔧 Creando configuraciones de examen por defecto...');
      const insertConfig = db.prepare(`
        INSERT INTO exam_configurations (nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertConfig.run('Examen Estándar', 60, 5, 5, 5, 1);
      insertConfig.run('Examen Rápido', 30, 3, 3, 3, 1);
    }

    console.log('✅ Base de datos inicializada correctamente');
    return db;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}

// Normalizar nombre de grado
function normalizeGradeServer(raw) {
  if (raw === null || typeof raw === 'undefined') return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s.replace(/[┬░Â°Ã‚°]/g, '°').replace(/[ÂÃ]/g, '').trim();
  const m = s.match(/(\d{1,2})/);
  if (m) return `${m[1]}°`;
  return s;
}

// Funciones de utilidad para imágenes (mock o import real si es necesario)
function normalizeImagePath(path) {
  if (!path) return null;
  return path.replace(/\\/g, '/');
}

// Inicializar DB
initDatabase();

export const dbFunctions = {
  async estudianteExiste(documento) {
    return db.prepare('SELECT * FROM estudiantes WHERE documento = ?').get(documento);
  },

  async examenRealizado(documento) {
    return db.prepare('SELECT * FROM examenes WHERE documento = ? ORDER BY fecha_examen DESC LIMIT 1').get(documento);
  },

  async registrarEstudiante(datos) {
    const existente = await this.estudianteExiste(datos.documento);
    if (existente) {
      db.prepare(`
        UPDATE estudiantes SET nombre = ?, apellido = ?, email = ?, telefono = ?, grado = ? 
        WHERE documento = ?
      `).run(datos.nombre, datos.apellido, datos.email, datos.telefono, datos.grado, datos.documento);
      return { success: true, updated: true };
    }

    db.prepare(`
      INSERT INTO estudiantes (documento, nombre, apellido, email, telefono, grado)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(datos.documento, datos.nombre, datos.apellido, datos.email, datos.telefono, datos.grado);
    return { success: true, created: true };
  },

  async guardarExamen(documento, resultados, tiempoUsado) {
    console.log(`💾 Iniciando guardado de examen para documento: ${documento}`);
    const transaction = db.transaction((doc, res, time) => {
      // 1. Verificar que el estudiante existe
      const estudiante = db.prepare('SELECT grado FROM estudiantes WHERE documento = ?').get(doc);
      if (!estudiante) {
        console.error(`❌ Estudiante no encontrado: ${doc}`);
        throw new Error(`Estudiante con documento ${doc} no encontrado`);
      }
      
      const grado = estudiante.grado || 'N/A';
      const score = res?.score || 0;
      const byArea = res?.byArea || { lenguaje: 0, ingles: 0, matematicas: 0 };
      const passed = res?.passed ? 1 : 0;

      // 2. Insertar el examen
      const info = db.prepare(`
        INSERT INTO examenes (documento, grado, puntaje_total, puntaje_lenguaje, puntaje_ingles, 
                             puntaje_matematicas, aprobado, tiempo_usado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(doc, grado, score, byArea.lenguaje, byArea.ingles, byArea.matematicas, passed, time || 0);

      const examenId = info.lastInsertRowid;
      console.log(`✅ Examen insertado con ID: ${examenId}`);

      // 3. Insertar las respuestas
      const insertResp = db.prepare(`
        INSERT INTO respuestas (examen_id, pregunta_id, pregunta, area, respuesta_usuario, 
                               respuesta_correcta, es_correcta)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const detalles = Array.isArray(res?.detail) ? res.detail : [];
      console.log(`📝 Insertando ${detalles.length} respuestas...`);
      
      for (const d of detalles) {
        insertResp.run(
          examenId, 
          d.id ? String(d.id) : null, 
          d.pregunta || '', 
          d.area || '', 
          d.userAnswer || '', 
          d.respuesta || '', 
          d.isCorrect ? 1 : 0
        );
      }

      // 4. Eliminar el progreso si todo salió bien
      db.prepare('DELETE FROM progreso_examen WHERE documento = ?').run(doc);
      console.log(`🗑️ Progreso eliminado para documento: ${doc}`);

      return examenId;
    });

    try {
      const examenId = transaction(documento, resultados, tiempoUsado);
      console.log(`✨ Proceso de guardado completado exitosamente. ID: ${examenId}`);
      return examenId;
    } catch (error) {
      console.error(`❌ Error en la transacción de guardado: ${error.message}`);
      throw error;
    }
  },

  async obtenerResultado(documento) {
    const examen = db.prepare(`
      SELECT e.*, est.nombre, est.apellido, est.email, est.grado
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      WHERE e.documento = ?
      ORDER BY e.fecha_examen DESC
      LIMIT 1
    `).get(documento);

    if (!examen) return null;
    const respuestas = db.prepare('SELECT * FROM respuestas WHERE examen_id = ?').all(examen.id);
    return { ...examen, respuestas };
  },

  async obtenerResultadoPorId(examenId) {
    const examen = db.prepare(`
      SELECT e.*, est.nombre, est.apellido, est.email
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      WHERE e.id = ?
    `).get(examenId);

    if (!examen) return null;

    const respuestas = db.prepare(`
      SELECT r.*, COALESCE(p.imagen_pregunta, p2.imagen_pregunta) as imagenPregunta
      FROM respuestas r
      LEFT JOIN preguntas p ON r.pregunta_id = CAST(p.id AS TEXT)
      LEFT JOIN preguntas p2 ON r.pregunta = p2.pregunta AND r.area = p2.area
      WHERE r.examen_id = ?
      ORDER BY r.id
    `).all(examenId);

    respuestas.forEach(r => {
      if (r.imagenPregunta) r.imagenPregunta = normalizeImagePath(r.imagenPregunta);
    });

    return { ...examen, respuestas };
  },

  async obtenerTodosResultados() {
    return db.prepare(`
      SELECT e.*, est.nombre, est.apellido
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      ORDER BY e.fecha_examen DESC
    `).all();
  },

  async obtenerConteos() {
    return {
      estudiantes: db.prepare('SELECT COUNT(*) as total FROM estudiantes').get().total,
      examenes: db.prepare('SELECT COUNT(*) as total FROM examenes').get().total,
      respuestas: db.prepare('SELECT COUNT(*) as total FROM respuestas').get().total,
      preguntas: db.prepare('SELECT COUNT(*) as total FROM preguntas').get().total,
      configuraciones: db.prepare('SELECT COUNT(*) as total FROM exam_configurations').get().total
    };
  },

  async obtenerEstadisticas() {
    return db.prepare(`
      SELECT 
        COUNT(*) as total_examenes,
        SUM(aprobado) as total_aprobados,
        AVG(puntaje_total) as promedio_general,
        AVG(puntaje_lenguaje) as promedio_lenguaje,
        AVG(puntaje_ingles) as promedio_ingles,
        AVG(puntaje_matematicas) as promedio_matematicas
      FROM examenes
    `).get();
  },

  async eliminarExamen(examenId) {
    const deleteTx = db.transaction((id) => {
      db.prepare('DELETE FROM respuestas WHERE examen_id = ?').run(id);
      db.prepare('DELETE FROM examenes WHERE id = ?').run(id);
    });
    deleteTx(examenId);
    return { success: true };
  },

  async eliminarEstudiante(documento) {
    const deleteTx = db.transaction((doc) => {
      const examenes = db.prepare('SELECT id FROM examenes WHERE documento = ?').all(doc);
      const deleteResp = db.prepare('DELETE FROM respuestas WHERE examen_id = ?');
      examenes.forEach(e => deleteResp.run(e.id));
      db.prepare('DELETE FROM examenes WHERE documento = ?').run(doc);
      db.prepare('DELETE FROM estudiantes WHERE documento = ?').run(doc);
    });
    deleteTx(documento);
    return { success: true };
  },

  async obtenerTodasLasPreguntas() {
    const rows = db.prepare(`SELECT * FROM preguntas ORDER BY grado, area, id`).all();
    return rows.map(p => ({
      ...p,
      opciones: [
        { texto: p.opcion1_texto || '', imagen: normalizeImagePath(p.opcion1_imagen) },
        { texto: p.opcion2_texto || '', imagen: normalizeImagePath(p.opcion2_imagen) },
        { texto: p.opcion3_texto || '', imagen: normalizeImagePath(p.opcion3_imagen) },
        { texto: p.opcion4_texto || '', imagen: normalizeImagePath(p.opcion4_imagen) },
      ],
      imagenPregunta: normalizeImagePath(p.imagen_pregunta),
      respuesta: p.respuesta_correcta
    }));
  },

  async insertarPregunta(data) {
    const opciones = data.opciones || [];
    const info = db.prepare(`
      INSERT INTO preguntas (grado, area, pregunta, imagen_pregunta, opcion1_texto, opcion1_imagen, opcion2_texto, opcion2_imagen, opcion3_texto, opcion3_imagen, opcion4_texto, opcion4_imagen, respuesta_correcta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.grado, data.area, data.pregunta, data.imagenPregunta || null,
      opciones[0]?.texto || '', opciones[0]?.imagen || null,
      opciones[1]?.texto || '', opciones[1]?.imagen || null,
      opciones[2]?.texto || '', opciones[2]?.imagen || null,
      opciones[3]?.texto || '', opciones[3]?.imagen || null,
      data.respuestaCorrecta
    );
    return { success: true, id: info.lastInsertRowid };
  },

  async actualizarPregunta(id, data) {
    const opciones = data.opciones || [];
    db.prepare(`
      UPDATE preguntas SET grado = ?, area = ?, pregunta = ?, imagen_pregunta = ?,
      opcion1_texto = ?, opcion1_imagen = ?, opcion2_texto = ?, opcion2_imagen = ?,
      opcion3_texto = ?, opcion3_imagen = ?, opcion4_texto = ?, opcion4_imagen = ?,
      respuesta_correcta = ?, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.grado, data.area, data.pregunta, data.imagenPregunta || '',
      opciones[0]?.texto || '', opciones[0]?.imagen || '',
      opciones[1]?.texto || '', opciones[1]?.imagen || '',
      opciones[2]?.texto || '', opciones[2]?.imagen || '',
      opciones[3]?.texto || '', opciones[3]?.imagen || '',
      data.respuestaCorrecta, id
    );
    return { success: true };
  },

  async eliminarPregunta(id) {
    db.prepare('DELETE FROM preguntas WHERE id = ?').run(id);
    return { success: true };
  },

  async eliminarTodasLasPreguntas() {
    db.prepare('DELETE FROM preguntas').run();
    return { success: true };
  },

  async guardarProgresoExamen(documento, currentQuestionIndex, answersJson, questionsJson = null, configJson = null, examId = null, remainingTimeSeconds = null) {
    const questionsStr = questionsJson ? JSON.stringify(questionsJson) : '[]';
    const configStr = configJson ? JSON.stringify(configJson) : '{}';
    const answersStr = typeof answersJson === 'string' ? answersJson : JSON.stringify(answersJson);

    db.prepare(`
      INSERT INTO progreso_examen (documento, exam_id, current_question_index, answers_json, questions_json, config_json, remaining_time_seconds, last_saved_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(documento) DO UPDATE SET
        exam_id = excluded.exam_id,
        current_question_index = excluded.current_question_index,
        answers_json = excluded.answers_json,
        questions_json = excluded.questions_json,
        config_json = excluded.config_json,
        remaining_time_seconds = excluded.remaining_time_seconds,
        last_saved_time = CURRENT_TIMESTAMP
    `).run(documento, examId, currentQuestionIndex, answersStr, questionsStr, configStr, remainingTimeSeconds);
    return { success: true };
  },

  async obtenerProgresoExamen(documento) {
    const row = db.prepare(`SELECT * FROM progreso_examen WHERE documento = ?`).get(documento);
    if (row && typeof row.answers_json === 'string') {
      try { row.answersJson = JSON.parse(row.answers_json); } catch(e) { row.answersJson = {}; }
    }
    return row;
  },

  async eliminarProgresoExamen(documento) {
    db.prepare('DELETE FROM progreso_examen WHERE documento = ?').run(documento);
    return { success: true };
  },

  async obtenerTodosProgresosPendientes() {
    const rows = db.prepare(`
      SELECT p.*, e.nombre, e.apellido
      FROM progreso_examen p
      LEFT JOIN estudiantes e ON p.documento = e.documento
      ORDER BY p.last_saved_time DESC
    `).all();
    return rows.map(r => ({
      ...r,
      questions_json: JSON.parse(r.questions_json || '[]'),
      config_json: JSON.parse(r.config_json || '{}'),
      answers_json: JSON.parse(r.answers_json || '{}')
    }));
  },

  async obtenerConfiguracionesExamen() {
    return db.prepare('SELECT * FROM exam_configurations ORDER BY fecha_creacion DESC').all();
  },

  async obtenerConfiguracionExamenPorId(id) {
    return db.prepare('SELECT * FROM exam_configurations WHERE id = ?').get(id);
  },

  async crearConfiguracionExamen(data) {
    const info = db.prepare(`
      INSERT INTO exam_configurations (nombre, tiempo_limite_minutos, preguntas_lenguaje, preguntas_ingles, preguntas_matematicas, orden_aleatorio)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.nombre, 
      parseInt(data.tiempo_limite_minutos), 
      parseInt(data.preguntas_lenguaje) || 0, 
      parseInt(data.preguntas_ingles) || 0, 
      parseInt(data.preguntas_matematicas) || 0, 
      data.orden_aleatorio ? 1 : 0
    );
    return { success: true, id: info.lastInsertRowid };
  },

  async actualizarConfiguracionExamen(id, data) {
    db.prepare(`
      UPDATE exam_configurations SET
      nombre = ?, tiempo_limite_minutos = ?, preguntas_lenguaje = ?, preguntas_ingles = ?,
      preguntas_matematicas = ?, orden_aleatorio = ?, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.nombre, 
      parseInt(data.tiempo_limite_minutos), 
      parseInt(data.preguntas_lenguaje) || 0, 
      parseInt(data.preguntas_ingles) || 0, 
      parseInt(data.preguntas_matematicas) || 0, 
      data.orden_aleatorio ? 1 : 0, 
      id
    );
    return { success: true };
  },

  async eliminarConfiguracionExamen(id) {
    db.prepare('DELETE FROM exam_configurations WHERE id = ?').run(id);
    return { success: true };
  }
};

export default db;
