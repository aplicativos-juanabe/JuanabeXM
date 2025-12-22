import express from "express";
import cors from "cors";
import { dbFunctions } from "./database.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatDateForDisplay, formatForFilename, getCurrentYear } from './utils/dateUtils.js';
import multer from 'multer';
import fs from 'fs';
import * as XLSX from 'xlsx';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
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

// Configuración de Multer
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Admin key middleware
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.admin_key;
  if (!key || key !== ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Acceso denegado. API key inválida o ausente.' });
  }
  next();
}

// Log de peticiones
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "exam-platform-api",
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Estudiante
app.get("/api/estudiante/:documento", async (req, res) => {
  try {
    const { documento } = req.params;
    const estudiante = await dbFunctions.estudianteExiste(documento);
    const examen = await dbFunctions.examenRealizado(documento);
    res.json({
      existe: !!estudiante,
      examenRealizado: !!examen,
      estudiante: estudiante || null,
      ultimoExamen: examen || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.post("/api/estudiante", async (req, res) => {
  try {
    const result = await dbFunctions.registrarEstudiante(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Examen
app.post("/api/examen", async (req, res) => {
  try {
    const { documento, resultados, tiempoUsado } = req.body;
    if (!documento || !resultados) {
      return res.status(400).json({ error: "Documento y resultados son requeridos" });
    }
    const examenId = await dbFunctions.guardarExamen(documento, resultados, tiempoUsado);
    res.json({ success: true, examenId });
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.get("/api/resultado/:documento", async (req, res) => {
  try {
    const { documento } = req.params;
    const resultado = await dbFunctions.obtenerResultado(documento);
    if (!resultado) return res.status(404).json({ error: "Resultado no encontrado" });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Administración (Protegidos)
app.get("/api/resultados", requireAdminKey, async (req, res) => {
  try {
    const resultados = await dbFunctions.obtenerTodosResultados();
    res.json(resultados);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.get("/api/estadisticas", requireAdminKey, async (req, res) => {
  try {
    const stats = await dbFunctions.obtenerEstadisticas();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.delete("/api/examen/:id", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.eliminarExamen(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.delete("/api/estudiante/:documento", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.eliminarEstudiante(req.params.documento);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Preguntas
app.get("/api/preguntas", requireAdminKey, async (req, res) => {
  try {
    const preguntas = await dbFunctions.obtenerTodasLasPreguntas();
    res.json(preguntas);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.post("/api/preguntas", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.insertarPregunta(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.put("/api/preguntas/:id", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.actualizarPregunta(parseInt(req.params.id), req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.delete("/api/preguntas/:id", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.eliminarPregunta(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Configuraciones
app.get("/api/examen/configuraciones", requireAdminKey, async (req, res) => {
  try {
    const configs = await dbFunctions.obtenerConfiguracionesExamen();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.post("/api/examen/configuraciones", requireAdminKey, async (req, res) => {
  try {
    const result = await dbFunctions.crearConfiguracionExamen(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Progreso
app.post("/api/examen/progreso", async (req, res) => {
  try {
    const { documento, currentQuestionIndex, answersJson, questionsJson, configJson, examId, remainingTimeSeconds } = req.body;
    await dbFunctions.guardarProgresoExamen(documento, currentQuestionIndex, answersJson, questionsJson, configJson, examId, remainingTimeSeconds);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

app.get("/api/examen/progreso/:documento", async (req, res) => {
  try {
    const progreso = await dbFunctions.obtenerProgresoExamen(req.params.documento);
    if (!progreso) return res.status(404).json({ error: "Progreso no encontrado" });
    res.json(progreso);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// PDF
app.get("/api/examen/:id/pdf", async (req, res) => {
  try {
    const resultado = await dbFunctions.obtenerResultadoPorId(parseInt(req.params.id));
    if (!resultado) return res.status(404).json({ error: "Examen no encontrado" });

    const displayGrade = resultado.grado || "N/A";
    const tablasRespuestas = (resultado.respuestas || []).map((r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${r.area}</td>
        <td>${r.pregunta}</td>
        <td>${r.respuesta_usuario}</td>
        <td>${r.respuesta_correcta}</td>
        <td style="color: ${r.es_correcta ? 'green' : 'red'}">${r.es_correcta ? '✓' : '✗'}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Examen ${resultado.nombre} ${resultado.apellido}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
          .header { text-align: center; border-bottom: 2px solid red; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>JUANA ARIAS DE BENAVIDES</h1>
          <h2>Resultado de Examen de Admisión</h2>
        </div>
        <p><strong>Estudiante:</strong> ${resultado.nombre} ${resultado.apellido}</p>
        <p><strong>Documento:</strong> ${resultado.documento}</p>
        <p><strong>Grado:</strong> ${displayGrade}</p>
        <p><strong>Puntaje:</strong> ${resultado.puntaje_total} / 15</p>
        <table>
          <thead>
            <tr><th>#</th><th>Área</th><th>Pregunta</th><th>Tu Respuesta</th><th>Correcta</th><th>Estado</th></tr>
          </thead>
          <tbody>${tablasRespuestas}</tbody>
        </table>
      </body>
      </html>
    `;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

// Servir Frontend
const DIST_PATH = path.join(__dirname, "..", "dist");
const PUBLIC_PATH = path.join(__dirname, "..", "public");

app.use(express.static(PUBLIC_PATH));
app.use(express.static(DIST_PATH));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(DIST_PATH, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
