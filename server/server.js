import express from "express";
import cors from "cors";
import { dbFunctions } from "./database.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import * as XLSX from 'xlsx';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'changeme';

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = FRONTEND_URL.split(',').map(url => url.trim());
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error('CORS not allowed'));
    },
    credentials: true
  })
);
app.use(express.json());

// Configuración de Multer para la subida de archivos CSV
const upload = multer({
  dest: "uploads/", // Directorio temporal para los archivos subidos
  limits: { fileSize: 2 * 1024 * 1024 }, // Límite de 5MB
});

// Admin key middleware
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.admin_key;
  if (!key || key !== ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Acceso denegado. API key inválida o ausente.' });
  }
  next();
}

// Log de todas las peticiones
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "exam-platform-api",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});


// Verificar si estudiante existe y si ya realizó el examen
app.get("/api/estudiante/:documento", async (req, res) => {
  try {
    const { documento } = req.params;
    console.log("Verificando estudiante:", documento);

    const estudiante = await dbFunctions.estudianteExiste(documento);
    const examen = await dbFunctions.examenRealizado(documento);

    res.json({
      existe: !!estudiante,
      examenRealizado: !!examen,
      estudiante: estudiante || null,
      ultimoExamen: examen || null,
    });
  } catch (error) {
    console.error("Error verificando estudiante:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Registrar estudiante
app.post("/api/estudiante", async (req, res) => {
  try {
    console.log("Registrando estudiante:", req.body);
    const result = await dbFunctions.registrarEstudiante(req.body);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error registrando estudiante:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Guardar resultado del examen
app.post("/api/examen", async (req, res) => {
  try {
    const { documento, resultados, tiempoUsado } = req.body;
    console.log("Guardando examen para:", documento);

    const examenId = await dbFunctions.guardarExamen(
      documento,
      resultados,
      tiempoUsado
    );

    res.json({ success: true, examenId });
  } catch (error) {
    console.error("Error guardando examen:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Obtener resultado específico
app.get("/api/resultado/:documento", async (req, res) => {
  try {
    const { documento } = req.params;
    const resultado = await dbFunctions.obtenerResultado(documento);

    if (!resultado) {
      return res.status(404).json({ error: "Resultado no encontrado" });
    }

    res.json(resultado);
  } catch (error) {
    console.error("Error obteniendo resultado:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Obtener todos los resultados (administración)
app.get("/api/resultados", async (req, res) => {
  try {
    const resultados = await dbFunctions.obtenerTodosResultados();
    res.json(resultados);
  } catch (error) {
    console.error("Error obteniendo resultados:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Obtener estadísticas
app.get("/api/estadisticas", async (req, res) => {
  try {
    const stats = await dbFunctions.obtenerEstadisticas();
    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Obtener resultados filtrados por grado
app.get("/api/resultados/grado/:grado", async (req, res) => {
  try {
    const { grado } = req.params;

    const stmt = db.prepare(`
      SELECT e.*, est.nombre, est.apellido
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      WHERE est.grado = ?
      ORDER BY e.fecha_examen DESC
    `);

    stmt.bind([grado]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    res.json(results);
  } catch (error) {
    console.error("Error obteniendo resultados por grado:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Estadísticas por grado
app.get("/api/estadisticas/grado/:grado", async (req, res) => {
  try {
    const { grado } = req.params;

    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_examenes,
        SUM(aprobado) as total_aprobados,
        AVG(puntaje_total) as promedio_general,
        AVG(puntaje_lenguaje) as promedio_lenguaje,
        AVG(puntaje_ingles) as promedio_ingles,
        AVG(puntaje_matematicas) as promedio_matematicas
      FROM examenes e
      JOIN estudiantes est ON e.documento = est.documento
      WHERE est.grado = ?
    `);

    stmt.bind([grado]);
    stmt.step();
    const stats = stmt.getAsObject();
    stmt.free();

    res.json(stats);
  } catch (error) {
    console.error("Error obteniendo estadísticas por grado:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  res
    .status(500)
    .json({ error: "Error interno del servidor", details: err.message });
});

// Endpoint de diagnóstico: conteos rápidos y último examen (protegido)
app.get("/api/debug/counts", requireAdminKey, async (req, res) => {
  try {
    const counts = await dbFunctions.obtenerConteos();
    // Obtener último examen para referencia rápida
    const todos = await dbFunctions.obtenerTodosResultados();
    const ultimo = Array.isArray(todos) && todos.length > 0 ? todos[0] : null;
    res.json({ counts, ultimo });
  } catch (error) {
    console.error("Error en /api/debug/counts:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Eliminar examen específico
app.delete("/api/examen/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Eliminando examen:", id);

    const result = await dbFunctions.eliminarExamen(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error("Error eliminando examen:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Endpoints para gestión de preguntas (ADMINISTRACIÓN)
app.get("/api/preguntas", async (req, res) => {
  try {
    const preguntas = await dbFunctions.obtenerTodasLasPreguntas();
    res.json(preguntas);
  } catch (error) {
    console.error("Error obteniendo todas las preguntas:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

app.get("/api/preguntas/:id", requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    const pregunta = await dbFunctions.obtenerPreguntaPorId(parseInt(id));
    if (!pregunta) {
      return res.status(404).json({ error: "Pregunta no encontrada" });
    }
    res.json(pregunta);
  } catch (error) {
    console.error("Error obteniendo pregunta por ID:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

app.post("/api/preguntas", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.insertarPregunta(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error insertando pregunta:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

app.put("/api/preguntas/:id", requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbFunctions.actualizarPregunta(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    console.error("Error actualizando pregunta:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

app.delete("/api/preguntas/:id", requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbFunctions.eliminarPregunta(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error("Error eliminando pregunta:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Endpoint para subir preguntas desde CSV (ADMINISTRACIÓN)
app.post("/api/upload-questions", requireAdminKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo CSV." });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Validar el formato del CSV (mínimo de columnas)
    if (!rows || rows.length < 2) { // Incluye encabezados y al menos una fila de datos
      return res.status(400).json({ error: "El archivo CSV está vacío o tiene un formato incorrecto." });
    }

    const headers = rows[0];
    const expectedHeaders = ["grado", "area", "pregunta", "imagenPregunta", "opcion1_texto", "opcion1_imagen", "opcion2_texto", "opcion2_imagen", "opcion3_texto", "opcion3_imagen", "opcion4_texto", "opcion4_imagen", "respuestaCorrecta"];

    // Convertir a minúsculas y comparar para ser más flexible
    const lowerCaseHeaders = headers.map(h => String(h).toLowerCase());

    // Mapear nombres de columnas del CSV a nombres esperados
    const columnMapping = {
      'grado': 'grado',
      'area': 'area',
      'pregunta': 'pregunta',
      'imagenpregunta': 'imagenPregunta',
      'opcion1': 'opcion1_texto',
      'imagenopcion1': 'opcion1_imagen',
      'opcion2': 'opcion2_texto',
      'imagenopcion2': 'opcion2_imagen',
      'opcion3': 'opcion3_texto',
      'imagenopcion3': 'opcion3_imagen',
      'opcion4': 'opcion4_texto',
      'imagenopcion4': 'opcion4_imagen',
      'respuesta': 'respuestaCorrecta'
    };

    const missingHeaders = expectedHeaders.filter(eh => {
      const csvColumn = Object.keys(columnMapping).find(key => columnMapping[key] === eh);
      return !lowerCaseHeaders.includes(csvColumn);
    });

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: "Faltan columnas obligatorias en el CSV",
        missing: missingHeaders,
        expected: expectedHeaders,
        found: headers
      });
    }

    const questionsToInsert = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const question = {};
      let isValidRow = true;

      expectedHeaders.forEach((expectedHeader) => {
        // Encontrar el índice de la columna CSV que corresponde al header esperado
        const csvColumn = Object.keys(columnMapping).find(key => columnMapping[key] === expectedHeader);
        const headerIndex = lowerCaseHeaders.indexOf(csvColumn);
        if (headerIndex !== -1) {
          question[expectedHeader] = row[headerIndex] !== undefined ? String(row[headerIndex]).trim() : "";
        } else {
          question[expectedHeader] = "";
        }
      });

      // Validación de datos individuales de la pregunta
      if (!question.grado || !question.area || !question.pregunta || !question.respuestaCorrecta) {
        errors.push(`Fila ${i + 1}: Campos obligatorios (grado, area, pregunta, respuestaCorrecta) vacíos.`);
        isValidRow = false;
      }

      // Construir opciones
      question.opciones = [];
      for (let j = 1; j <= 4; j++) {
        const opcionTexto = question[`opcion${j}_texto`];
        const opcionImagen = question[`opcion${j}_imagen`];
        if (opcionTexto || opcionImagen) {
          question.opciones.push({ texto: opcionTexto, imagen: opcionImagen });
        }
      }

      if (question.opciones.length === 0) {
        errors.push(`Fila ${i + 1}: No se encontraron opciones para la pregunta.`);
        isValidRow = false;
      } else {
          // Validar que la respuesta correcta sea una de las opciones de texto
          const opcionesTexto = question.opciones.map(opt => opt.texto);
          if (!opcionesTexto.includes(question.respuestaCorrecta)) {
              errors.push(`Fila ${i + 1}: La respuesta correcta '${question.respuestaCorrecta}' no coincide con ninguna opción de texto.`);
              isValidRow = false;
          }
      }

      // Eliminar las propiedades individuales de opción/imagen ya que se agrupan en 'opciones'
      expectedHeaders.forEach(header => {
        if (header.startsWith("opcion") || header.startsWith("respuestaCorrecta")) {
            delete question[header];
        }
      });
      // Asegurarse de que el campo de respuesta correcta vuelva a ser incluido después de la limpieza
      const respuestaIndex = lowerCaseHeaders.indexOf("respuesta");
      question.respuestaCorrecta = respuestaIndex !== -1 && row[respuestaIndex] !== undefined ? String(row[respuestaIndex]).trim() : "";

      if (isValidRow) {
        questionsToInsert.push(question);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Errores de validación en el CSV", details: errors });
    }

    if (questionsToInsert.length === 0) {
      return res.status(400).json({ error: "No se encontraron preguntas válidas para insertar." });
    }

    // Eliminar todas las preguntas existentes antes de insertar las nuevas
    await dbFunctions.eliminarTodasLasPreguntas(); // Necesitarás crear esta función en database.js

    for (const q of questionsToInsert) {
      await dbFunctions.insertarPregunta(q);
    }

    res.json({ success: true, insertedCount: questionsToInsert.length });

  } catch (error) {
    console.error("Error subiendo CSV de preguntas:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  } finally {
    // Asegurarse de eliminar el archivo temporal
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Endpoints para gestión de configuraciones de examen (ADMINISTRACIÓN)
app.get("/api/examen/configuraciones", async (req, res) => {
  try {
    const configs = await dbFunctions.obtenerConfiguracionesExamen();
    res.json(configs);
  } catch (error) {
    console.error("Error obteniendo configuraciones de examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.get("/api/examen/configuraciones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const config = await dbFunctions.obtenerConfiguracionExamenPorId(parseInt(id));
    if (!config) {
      return res.status(404).json({ error: "Configuración no encontrada" });
    }
    res.json(config);
  } catch (error) {
    console.error("Error obteniendo configuración de examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.post("/api/examen/configuraciones", requireAdminKey, async (req, res) => {
  try {
    console.log("📝 Datos recibidos para crear configuración:", req.body);
    const result = await dbFunctions.crearConfiguracionExamen(req.body);
    console.log("✅ Configuración creada exitosamente:", result);
    res.status(201).json(result);
  } catch (error) {
    console.error("❌ Error creando configuración de examen:", error);
    console.error("Stack:", error.stack);
    const errorMessage = error.message || "Error interno del servidor";
    res.status(500).json({ error: "Error creando configuración de examen", details: errorMessage });
  }
});

app.put("/api/examen/configuraciones/:id", requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbFunctions.actualizarConfiguracionExamen(parseInt(id), req.body);
    res.json(result);
  } catch (error) {
    console.error("Error actualizando configuración de examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.delete("/api/examen/configuraciones/:id", requireAdminKey, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbFunctions.eliminarConfiguracionExamen(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error("Error eliminando configuración de examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Endpoints para guardar/recuperar/eliminar progreso del examen
app.post("/api/examen/progreso", async (req, res) => {
  try {
    const { documento, currentQuestionIndex, answersJson, questionsJson, configJson, examId, remainingTimeSeconds } = req.body;
    // No protegemos este endpoint con requireAdminKey para que el estudiante pueda guardar su progreso
    await dbFunctions.guardarProgresoExamen(documento, currentQuestionIndex, answersJson, questionsJson, configJson, examId, remainingTimeSeconds);
    res.json({ success: true });
  } catch (error) {
    console.error("Error guardando progreso del examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.get("/api/examen/progreso/:documento", async (req, res) => {
  try {
    const { documento } = req.params;
    const progreso = await dbFunctions.obtenerProgresoExamen(documento);
    if (!progreso) {
      return res.status(404).json({ error: "Progreso no encontrado" });
    }
    res.json(progreso);
  } catch (error) {
    console.error("Error obteniendo progreso del examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.delete("/api/examen/progreso/:documento", requireAdminKey, async (req, res) => {
  try {
    const { documento } = req.params;
    await dbFunctions.eliminarProgresoExamen(documento);
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando progreso del examen:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Endpoint para obtener todos los progresos pendientes (ADMINISTRACIÓN)
app.get("/api/examen/progreso-pendiente", requireAdminKey, async (req, res) => {
  try {
    const progressList = await dbFunctions.obtenerTodosProgresosPendientes();
    res.json(progressList);
  } catch (error) {
    console.error("Error obteniendo progresos pendientes:", error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Eliminar estudiante y todos sus exámenes
app.delete("/api/estudiante/:documento", async (req, res) => {
  try {
    const { documento } = req.params;
    console.log("Eliminando estudiante:", documento);

    const result = await dbFunctions.eliminarEstudiante(documento);
    res.json(result);
  } catch (error) {
    console.error("Error eliminando estudiante:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// Generar PDF de examen
app.get("/api/examen/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Generando PDF para examen:", id);

    const examenId = parseInt(id);
    const resultado = await dbFunctions.obtenerResultadoPorId(examenId);
    console.log("Resultado obtenido:", !!resultado);
    // Si no existe, listar IDs disponibles para ayudar al debug
    if (!resultado) {
      try {
        const todos = await dbFunctions.obtenerTodosResultados();
        const ids = Array.isArray(todos) ? todos.map((e) => e.id) : [];
        console.error(
          `Examen ${examenId} no encontrado. IDs disponibles:`,
          ids
        );
      } catch (err) {
        console.error("Error listando exámenes disponibles:", err);
      }
      return res
        .status(404)
        .json({ error: "Examen no encontrado", requestedId: examenId });
    }

    // Determinar representación del grado
    const displayGrade = (() => {
      try {
        const g = resultado.grado;
        if (!g) return "N/A";
        const m = String(g).match(/(\d{1,2})/);
        if (m) return `${m[1]}°`;
        return String(g);
      } catch (e) {
        return resultado.grado || "N/A";
      }
    })();

    // Generar tabla de respuestas
    const tablasRespuestas = resultado.respuestas
      ? resultado.respuestas
        .map((r, idx) => {
          return `<tr>
        <td>${idx + 1}</td>
        <td>${r.area.charAt(0).toUpperCase() + r.area.slice(1)}</td>
        <td>
          ${r.pregunta.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}
          ${r.imagenPregunta
            ? `<br><small style="color: #666;">📷 Con imagen</small>`
            : ""
            }
        </td>
        <td>${r.respuesta_usuario
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;")}</td>
        <td>${r.respuesta_correcta
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;")}</td>
        <td class="${r.es_correcta ? "correct" : "incorrect"}">${r.es_correcta ? "✓" : "✗"
            }</td>
      </tr>`;
        })
        .join("")
      : "";

    // Generar HTML del PDF
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Examen ${resultado.nombre} ${resultado.apellido}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; color: #333; /* line-height: 1.6; */}
    .header { text-align: center; margin-bottom: 10px; border-bottom: 3px solid #dc2626; padding-bottom: 20px; display: flex; flex-direction: row; align-items: center;
  gap: 20px; justify-content: space-between;}
    .header h1 { color: #dc2626; margin: 5px 0; font-size: 24px; }
    .header h2 { color: #666; margin: 5px 0; font-size: 18px; }
    .header p { color: #999; margin: 5px 0; font-size: 14px; }
    .student-info { background: #f3f4f6; border-radius: 8px; margin-bottom: 10px; display: flex; flex-direction: row; gap: 8px; align-items: center;justify-content: space-between;}
    .student-info p { margin: 8px 0; font-size: 14px; }
    .result { text-align: center; padding: 15px; margin: 15px 0; border-radius: 8px; font-size: 24px; font-weight: bold; }
    .passed { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
    .failed { background: #fee2e2; color: #991b1b; border: 2px solid #dc2626; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 5px 0; }
    .summary-card { border-radius: 8px; text-align: center; border: 2px solid #e5e7eb; }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 16px; color: #666; }
    .summary-card .score { font-size: 32px; font-weight: bold; color: #dc2626; }
    table { width: 100%; border-collapse: collapse;  }
    th, td { padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-size: 13px; }
    th { background: #dc2626; color: white; font-weight: bold; }
    tr:nth-child(even) { background: #f9fafb; }
    .correct { color: #10b981; font-weight: bold; }
    .incorrect { color: #dc2626; font-weight: bold; }
    .footer { margin-top: 5px; padding-top: 5px; border-top: 2px solid #e5e7eb; text-align: center; color: #999; font-size: 12px; }
    .print-btn { display: inline-block; padding: 15px 30px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; text-align: center; margin: 30px auto; }
    h2 { color: #dc2626; margin-top: 10px; margin-bottom: 5px; font-size: 18px; }
    @media print { body { padding: 20px; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <img src="/logo.png" height="80" alt="Logo de la Institución"/>
    </div>
    <div class="institution-name" style="text-align: center;">
      <h2>Institución Educativa Técnica Departamental</h2>
      <h1>JUANA ARIAS DE BENAVIDES</h1>
      <p>Examen de Admisión 2026</p>
    </div>
    <div class="logo">
      <img src="/juanabeXM.png" height="70" alt="Logo del Sistema"/>
    </div>
</div>

  <div class="student-info">
      <p><strong>Aspirante:</strong> <span style="text-transform: uppercase;">${resultado.nombre} ${resultado.apellido
      }</span></p>
      <p><strong>Documento:</strong> ${resultado.documento}</p>
      <p><strong>Grado:</strong> ${displayGrade}</p>
      <p><strong>Fecha del Examen:</strong> ${formatDateForDisplay(resultado.fecha_examen)}</p>
    </div>
    <div class="result ${resultado.aprobado ? "passed" : "failed"}">
      ${resultado.aprobado ? "✓ EXAMEN APROBADO" : "✗ EXAMEN REPROBADO"}
      <div style="font-size: 18px; margin-top: 10px;">Puntaje Total: ${resultado.puntaje_total
      } / 15</div>
    </div>  

  <div class="summary">
    <div class="summary-card">
      <h3>Lenguaje</h3>
      <div class="score">${resultado.puntaje_lenguaje}/5</div>
      <p>${((resultado.puntaje_lenguaje / 5) * 100).toFixed(0)}%</p>
    </div>
    <div class="summary-card">
      <h3>Inglés</h3>
      <div class="score">${resultado.puntaje_ingles}/5</div>
      <p>${((resultado.puntaje_ingles / 5) * 100).toFixed(0)}%</p>
    </div>
    <div class="summary-card">
      <h3>Matemáticas</h3>
      <div class="score">${resultado.puntaje_matematicas}/5</div>
      <p>${((resultado.puntaje_matematicas / 5) * 100).toFixed(0)}%</p>
    </div>
  </div>

  ${resultado.respuestas && resultado.respuestas.length > 0
        ? `
    <h2>Detalle de Respuestas</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Área</th>
          <th>Pregunta</th>
          <th>Tu Respuesta</th>
          <th>Respuesta Correcta</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${tablasRespuestas}
      </tbody>
    </table>
  `
        : ""
      }
  
  <div class="footer">
    <p>© ${getCurrentYear()} JUANABE - Sistema de Admisión</p>
    <p>Documento generado automáticamente</p>
    <p>Regenerado el: ${formatDateForDisplay(new Date())}</p>
  </div>
  <div class="no-print" style="text-align: center; margin-top: 30px;">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(htmlContent);
  } catch (error) {
    console.error("Error generando PDF:", error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
});

// <<< SERVIR FRONTEND COMPILADO >>>

// Ruta real a la carpeta dist (está afuera de /server)
const DIST_PATH = path.join(__dirname, "..", "dist");

// Servir estáticos
app.use(express.static(DIST_PATH));

// Manejar cualquier ruta que no sea API
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(DIST_PATH, "index.html"));
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor iniciado correctamente`);
  console.log(`🌐 Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`🗄️  Base de datos: ${dbFunctions ? "Conectada" : "Error"}`);
});


server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `❌ Error: puerto ${PORT} en uso. Asegúrate de que no haya otra instancia del servidor y reinicia.`
    );
    process.exit(1);
  }
  console.error("❌ Error en el servidor:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("SIGTERM", () => {
  console.log("🛑 Cerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor cerrado");
  });
});
