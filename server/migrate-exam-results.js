import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentDbPath = join(__dirname, 'exam.db');
const backupDbPath = join(__dirname, 'exam_bak.db');

async function migrateExamResults() {
  console.log('🔄 Iniciando migración de resultados de exámenes...');

  try {
    const SQL = await initSqlJs();

    // Verificar que existe la base de datos de respaldo
    if (!existsSync(backupDbPath)) {
      console.error('❌ No se encontró la base de datos de respaldo exam_bak.db');
      process.exit(1);
    }

    console.log('📂 Cargando base de datos de respaldo...');
    const backupBuffer = readFileSync(backupDbPath);
    const backupDb = new SQL.Database(backupBuffer);

    console.log('📂 Cargando base de datos actual...');
    const currentBuffer = readFileSync(currentDbPath);
    const currentDb = new SQL.Database(currentBuffer);

    // Obtener todos los estudiantes de la base de respaldo
    console.log('👥 Obteniendo estudiantes de la base de respaldo...');
    const estudiantesStmt = backupDb.prepare('SELECT * FROM estudiantes ORDER BY id');
    const estudiantes = [];
    while (estudiantesStmt.step()) {
      estudiantes.push(estudiantesStmt.getAsObject());
    }
    estudiantesStmt.free();

    console.log(`📊 Encontrados ${estudiantes.length} estudiantes en la base de respaldo`);

    // Obtener todos los exámenes de la base de respaldo
    console.log('📝 Obteniendo exámenes de la base de respaldo...');
    const examenesStmt = backupDb.prepare('SELECT * FROM examenes ORDER BY id');
    const examenes = [];
    while (examenesStmt.step()) {
      examenes.push(examenesStmt.getAsObject());
    }
    examenesStmt.free();

    console.log(`📊 Encontrados ${examenes.length} exámenes en la base de respaldo`);

    // Obtener todas las respuestas de la base de respaldo
    console.log('💬 Obteniendo respuestas de la base de respaldo...');
    const respuestasStmt = backupDb.prepare('SELECT * FROM respuestas ORDER BY id');
    const respuestas = [];
    while (respuestasStmt.step()) {
      respuestas.push(respuestasStmt.getAsObject());
    }
    respuestasStmt.free();

    console.log(`📊 Encontradas ${respuestas.length} respuestas en la base de respaldo`);

    // Insertar estudiantes en la base actual (evitando duplicados)
    console.log('👥 Insertando estudiantes en la base actual...');
    let estudiantesInsertados = 0;
    let estudiantesActualizados = 0;

    for (const estudiante of estudiantes) {
      try {
        // Verificar si el estudiante ya existe
        const existingStmt = currentDb.prepare('SELECT id FROM estudiantes WHERE documento = ?');
        existingStmt.bind([estudiante.documento]);
        const exists = existingStmt.step();
        existingStmt.free();

        if (exists) {
          // Actualizar estudiante existente
          currentDb.run(
            `UPDATE estudiantes SET
             nombre = ?, apellido = ?, email = ?, telefono = ?, grado = ?,
             fecha_registro = ?
             WHERE documento = ?`,
            [
              estudiante.nombre,
              estudiante.apellido,
              estudiante.email,
              estudiante.telefono,
              estudiante.grado,
              estudiante.fecha_registro,
              estudiante.documento
            ]
          );
          estudiantesActualizados++;
        } else {
          // Insertar nuevo estudiante
          currentDb.run(
            `INSERT INTO estudiantes (documento, nombre, apellido, email, telefono, grado, fecha_registro)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              estudiante.documento,
              estudiante.nombre,
              estudiante.apellido,
              estudiante.email,
              estudiante.telefono,
              estudiante.grado,
              estudiante.fecha_registro
            ]
          );
          estudiantesInsertados++;
        }
      } catch (error) {
        console.warn(`⚠️ Error procesando estudiante ${estudiante.documento}:`, error.message);
      }
    }

    console.log(`✅ Estudiantes: ${estudiantesInsertados} insertados, ${estudiantesActualizados} actualizados`);

    // Insertar exámenes en la base actual (evitando duplicados por documento y fecha)
    console.log('📝 Insertando exámenes en la base actual...');
    let examenesInsertados = 0;
    let examenesSaltados = 0;

    for (const examen of examenes) {
      try {
        // Verificar si el examen ya existe (mismo documento y fecha aproximada)
        const existingStmt = currentDb.prepare(`
          SELECT id FROM examenes
          WHERE documento = ? AND fecha_examen >= datetime(? , '-1 minute') AND fecha_examen <= datetime(? , '+1 minute')
        `);
        existingStmt.bind([examen.documento, examen.fecha_examen, examen.fecha_examen]);
        const exists = existingStmt.step();
        existingStmt.free();

        if (!exists) {
          // Insertar nuevo examen
          currentDb.run(
            `INSERT INTO examenes (documento, grado, puntaje_total, puntaje_lenguaje, puntaje_ingles,
                                 puntaje_matematicas, aprobado, tiempo_usado, fecha_examen)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              examen.documento,
              examen.grado,
              examen.puntaje_total,
              examen.puntaje_lenguaje,
              examen.puntaje_ingles,
              examen.puntaje_matematicas,
              examen.aprobado,
              examen.tiempo_usado,
              examen.fecha_examen
            ]
          );

          // Obtener el ID del examen insertado para las respuestas
          const lastIdStmt = currentDb.prepare('SELECT last_insert_rowid() as id');
          lastIdStmt.step();
          const newExamenId = lastIdStmt.getAsObject().id;
          lastIdStmt.free();

          // Insertar respuestas asociadas a este examen
          const respuestasExamen = respuestas.filter(r => r.examen_id === examen.id);
          for (const respuesta of respuestasExamen) {
            try {
              currentDb.run(
                `INSERT INTO respuestas (examen_id, pregunta_id, pregunta, area, respuesta_usuario,
                                       respuesta_correcta, es_correcta)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  newExamenId,
                  respuesta.pregunta_id,
                  respuesta.pregunta,
                  respuesta.area,
                  respuesta.respuesta_usuario,
                  respuesta.respuesta_correcta,
                  respuesta.es_correcta
                ]
              );
            } catch (error) {
              console.warn(`⚠️ Error insertando respuesta para examen ${newExamenId}:`, error.message);
            }
          }

          examenesInsertados++;
        } else {
          examenesSaltados++;
        }
      } catch (error) {
        console.warn(`⚠️ Error procesando examen ${examen.id}:`, error.message);
      }
    }

    console.log(`✅ Exámenes: ${examenesInsertados} insertados, ${examenesSaltados} ya existían`);

    // Guardar cambios en la base de datos actual
    console.log('💾 Guardando cambios en la base de datos actual...');
    const updatedData = currentDb.export();
    const updatedBuffer = Buffer.from(updatedData);
    writeFileSync(currentDbPath, updatedBuffer);

    console.log('✅ Migración completada exitosamente!');
    console.log('📊 Resumen:');
    console.log(`   - Estudiantes: ${estudiantesInsertados} nuevos, ${estudiantesActualizados} actualizados`);
    console.log(`   - Exámenes: ${examenesInsertados} nuevos, ${examenesSaltados} ya existían`);
    console.log(`   - Respuestas: Migradas junto con los exámenes`);

    // Cerrar bases de datos
    backupDb.close();
    currentDb.close();

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateExamResults();
