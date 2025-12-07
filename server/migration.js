import db from './database.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'exam.db');

async function migrar() {
  console.log('🔄 Migrando base de datos para agregar grado a exámenes...');
  
  try {
    // Agregar columna grado a examenes si no existe
    try {
      db.run(`ALTER TABLE examenes ADD COLUMN grado TEXT DEFAULT 'N/A'`);
      console.log('✅ Columna grado agregada a examenes');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('⚠️ La columna grado ya existe');
      } else {
        throw error;
      }
    }
    
    // Actualizar grado en exámenes existentes desde estudiantes
    db.run(`
      UPDATE examenes 
      SET grado = (
        SELECT grado 
        FROM estudiantes 
        WHERE estudiantes.documento = examenes.documento
      )
      WHERE grado = 'N/A' OR grado IS NULL
    `);
    console.log('✅ Grados actualizados en exámenes existentes');
    
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