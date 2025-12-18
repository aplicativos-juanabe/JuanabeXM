import db from './database.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'exam.db');

async function migrar() {
  console.log('🔄 Migrando base de datos para agregar tiempo restante al progreso...');

  try {
    // Agregar columna remaining_time_seconds a progreso_examen si no existe
    try {
      db.run(`ALTER TABLE progreso_examen ADD COLUMN remaining_time_seconds INTEGER DEFAULT NULL`);
      console.log('✅ Columna remaining_time_seconds agregada a progreso_examen');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('⚠️ La columna remaining_time_seconds ya existe');
      } else {
        throw error;
      }
    }

    // Guardar cambios
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
    console.log('✅ Base de datos guardada');

  } catch (error) {
    console.error('❌ Error en migración:', error);
  }

  process.exit(0);
}

migrar();
