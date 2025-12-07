import express from "express";
import cors from "cors";
import { dbFunctions } from "./database.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_API_KEY =
  process.env.ADMIN_API_KEY || "admin_key_change_me_in_production";

// Middleware
app.use(cors());
app.use(express.json());

// Middleware para validar API key en endpoints administrativos
function requireAdminKey(req, res, next) {
  const apiKey = req.headers["x-admin-key"];
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. API key inválida o ausente." });
  }
  next();
}

// Log de todas las peticiones
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Ruta de salud
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Servidor funcionando" });
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
        <td>${r.pregunta.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}</td>
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
      <p><strong>Aspirante:</strong> <p style="text-transform: uppercase;">${resultado.nombre} ${resultado.apellido
      }</p></p>
      <p><strong>Documento:</strong> <p style="text-transform: uppercase;">${resultado.documento}</p></p>
      <p><strong>Grado:</strong> <p style="text-transform: uppercase;">${displayGrade}</p></p>
      <p><strong>Fecha del Examen:</strong> ${(() => {
        // Parsear correctamente el timestamp de SQLite (formato 'YYYY-MM-DD HH:MM:SS')
        try {
          const ts = resultado.fecha_examen;
          let fechaObj;
          if (
            typeof ts === "string" &&
            /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(ts)
          ) {
            // Interpretar como UTC (SQLite CURRENT_TIMESTAMP es UTC) y convertir a objeto Date
            fechaObj = new Date(ts.replace(" ", "T") + "Z");
          } else {
            fechaObj = new Date(ts);
          }
          return fechaObj.toLocaleString("es-CO", {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch (e) {
          return String(resultado.fecha_examen || "N/A");
        }
      })()}</p>
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
    <p>© ${new Date().getFullYear()} JUANABE - Sistema de Admisión</p>
    <p>Documento generado automáticamente</p>
    <p>Regenerado el: ${new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
      })}</p>
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

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📡 Accesible desde la red local en http://[IP-LOCAL]:${PORT}`);
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
