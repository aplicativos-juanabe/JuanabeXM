import { useState, useEffect } from "react";
import { useNotification } from "../hooks/useNotification";
import { examApi } from "../api/examApi";
import ZoomableImage from "./ZoomableImage";
import { formatDateForDisplay, getCurrentYear, formatForFilename } from "../utils/dateUtils";

export default function Exam({ student, config, onDone }) {
  const notify = useNotification();
  const [i, setI] = useState(0);
  const [ans, setAns] = useState({});
  const [t, setT] = useState(config.time);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState(null);
  const [examProgressId, setExamProgressId] = useState(null); // Para guardar el ID del progreso

  // Cargar progreso guardado al inicio
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const savedProgress = await examApi.obtenerProgresoExamen(student.documento);
        if (savedProgress && savedProgress.questions_json && savedProgress.config_json) {
          // Si hay progreso completo guardado, usar los datos guardados
          const savedQuestions = JSON.parse(savedProgress.questions_json);
          const savedConfig = JSON.parse(savedProgress.config_json);

          setI(savedProgress.current_question_index);
          setAns(savedProgress.answersJson);
          // Use the saved remaining time, or fall back to full time if not available
          const remainingTime = savedProgress.remaining_time_seconds || (savedConfig.tiempo_limite_minutos * 60);
          setT(remainingTime);
          setExamProgressId(savedProgress.exam_id);

          // Override the config with saved data to ensure consistency
          config.questions = savedQuestions;
          config.config = savedConfig;
          config.time = savedConfig.tiempo_limite_minutos * 60;

          notify.push("info", "Progreso del examen cargado automáticamente.");
        } else {
          // No hay progreso guardado, guardar el estado inicial del examen
          await examApi.guardarProgresoExamen(
            student.documento,
            0, // currentQuestionIndex
            {}, // answers
            config.questions, // questions
            config.config, // config
            null // examId
          );
        }
      } catch (error) {
        console.error("Error cargando progreso guardado:", error);
        notify.push("error", "No se pudo cargar el progreso del examen.");
      }
    };
    loadProgress();

    const interval = setInterval(() => {
      setT((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [student.documento, config.time]);

  useEffect(() => {
    if (t === 0 && !finished) finish();
  }, [student.documento, config.time]);

  // Guardado automático del progreso solo cuando cambian las respuestas
  useEffect(() => {
    const saveProgress = async () => {
      if (finished) return; // No guardar si el examen ya terminó
      try {
        await examApi.guardarProgresoExamen(
          student.documento,
          i,
          ans,
          config.questions, // Guardar las preguntas asignadas
          config.config, // Guardar la configuración del examen
          examProgressId, // Pasa el examId si ya se generó
          t // Guardar el tiempo restante en segundos
        );
        console.log("Progreso guardado automáticamente.");
      } catch (error) {
        console.error("Error guardando progreso automáticamente:", error);
      }
    };

    // Guardar solo cuando cambian las respuestas (no por tiempo)
    const handler = setTimeout(saveProgress, 1000); // Delay de 1 segundo para respuestas
    return () => clearTimeout(handler);
  }, [ans, finished, student.documento, examProgressId, config.questions, config.config]); // Solo dependencias de respuestas y configuración

  // Eliminar progreso guardado al finalizar (ya sea por submit o por onDone)
  useEffect(() => {
    if (finished) {
      const clearProgress = async () => {
        try {
          await examApi.eliminarProgresoExamen(student.documento);
          console.log("Progreso del examen eliminado.");
        } catch (error) {
          console.error("Error eliminando progreso guardado:", error);
        }
      };
      clearProgress();
    }
  }, [finished, student.documento]);

  const q = config.questions?.[i];

  const handle = (o) => {
    if (!q) return;
    setAns((prev) => ({ ...prev, [q.id]: o }));
  };

  // Loading state when questions are not available
  if (!config.questions || config.questions.length === 0) {
    return (
      <div className="w-full bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
            Cargando Examen...
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Preparando las preguntas del examen.
          </p>
        </div>
      </div>
    );
  }

  const finish = async () => {
    try {
      const tiempoTotal = config.time;
      const tiempoUsado = tiempoTotal - t;

      const det = config.questions.map((q) => {
        const u = ans[q.id] || "Sin respuesta";
        return { ...q, userAnswer: u, isCorrect: u === q.respuesta };
      });

      const score = det.filter((d) => d.isCorrect).length;

      const byArea = { lenguaje: 0, ingles: 0, matematicas: 0 };
      det.forEach((d) => {
        if (d.isCorrect) byArea[d.area]++;
      });

      const resultados = {
        detail: det,
        score,
        byArea,
        passed: score >= 10,
      };

      // Guardar en la base de datos
      try {
        const newExam = await examApi.guardarExamen(student.documento, resultados, tiempoUsado);
        setExamProgressId(newExam.examenId); // Almacena el ID del examen finalizado
        notify.push("success", "Resultados guardados correctamente");
      } catch (error) {
        console.error("Error guardando en BD:", error);
        notify.push(
          "warning",
          "Examen completado pero no se guardó en la base de datos"
        );
      }

      setResults(resultados);
      setFinished(true);
      notify.push("info", "Examen finalizado");

      // Limpiar progreso guardado (se maneja en un useEffect separado ahora)
    } catch (error) {
      console.error("Error al finalizar examen:", error);
      notify.push("error", "Ocurrió un error al procesar los resultados");
    }
  };

  const generatePDF = () => {
    try {
      const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Examen ${student.nombre} ${student.apellido}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #dc2626; padding-bottom: 20px; }
    .header h1 { color: #dc2626; margin: 5px 0; font-size: 24px; }
    .header h2 { color: #666; margin: 5px 0; font-size: 18px; }
    .header p { color: #999; margin: 5px 0; font-size: 14px; }
    .student-info { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .student-info p { margin: 8px 0; font-size: 14px; }
    .result { text-align: center; padding: 20px; margin: 30px 0; border-radius: 8px; font-size: 24px; font-weight: bold; }
    .passed { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
    .failed { background: #fee2e2; color: #991b1b; border: 2px solid #dc2626; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
    .summary-card { padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #e5e7eb; }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 16px; color: #666; }
    .summary-card .score { font-size: 32px; font-weight: bold; color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th, td { padding: 12px; text-align: left; border: 1px solid #e5e7eb; }
    th { background: #dc2626; color: white; font-weight: bold; }
    tr:nth-child(even) { background: #f9fafb; }
    .correct { color: #10b981; font-weight: bold; }
    .incorrect { color: #dc2626; font-weight: bold; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #999; font-size: 12px; }
    .print-btn { display: inline-block; padding: 15px 30px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; text-align: center; margin: 30px auto; }
    .question-image, .option-image { max-width: 300px; max-height: 200px; margin: 10px 0; border-radius: 8px; border: 1px solid #e5e7eb; }
    .option-image { max-width: 100px; max-height: 100px; }
    @media print { body { padding: 20px; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
      <h2>Institución Educativa Técnica Departamental</h2>
      <h1>JUANA ARIAS DE BENAVIDES</h1>
      <p>Examen de Admisión 2026</p>
  </div>
  <div class="student-info">
    <p><strong>Aspirante:</strong> ${student.nombre} ${student.apellido}</p>
    <p><strong>Documento:</strong> ${student.documento}</p>
    <p><strong>Email:</strong> ${student.email}</p>
    <p><strong>Teléfono:</strong> ${student.telefono}</p>
    <p><strong>Grado:</strong> ${student.grado}</p>
    <p><strong>Fecha:</strong> ${formatDateForDisplay(new Date())}</p>
  </div>
  <div class="result ${results.passed ? "passed" : "failed"}">
    ${results.passed ? "✓ EXAMEN APROBADO" : "✗ EXAMEN REPROBADO"}
    <div style="font-size: 18px; margin-top: 10px;">Puntaje Total: ${results.score
        } / ${config.questions.length}</div>
  </div>
  <div class="summary">
    <div class="summary-card"><h3>Lenguaje</h3><div class="score">${results.byArea.lenguaje
        }/5</div><p>${((results.byArea.lenguaje / 5) * 100).toFixed(0)}%</p></div>
    <div class="summary-card"><h3>Inglés</h3><div class="score">${results.byArea.ingles
        }/5</div><p>${((results.byArea.ingles / 5) * 100).toFixed(0)}%</p></div>
    <div class="summary-card"><h3>Matemáticas</h3><div class="score">${results.byArea.matematicas
        }/5</div><p>${((results.byArea.matematicas / 5) * 100).toFixed(
          0
        )}%</p></div>
  </div>
  <h2 style="margin-top: 40px; color: #dc2626;">Detalle de Respuestas</h2>
  <table>
    <thead><tr><th>#</th><th>Área</th><th>Pregunta</th><th>Tu Respuesta</th><th>Respuesta Correcta</th><th>Estado</th></tr></thead>
    <tbody>
      ${results.detail
          .map((p, idx) => {
            const userAnswer =
              typeof p.userAnswer === "string" ? p.userAnswer : "";
            const correctAnswer =
              typeof p.respuesta === "string" ? p.respuesta : "";

            return `<tr>
          <td>${idx + 1}</td>
          <td>${p.area.charAt(0).toUpperCase() + p.area.slice(1)}</td>
          <td>
            ${p.pregunta.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}
            ${p.imagenPregunta
                ? `<br><small style="color: #666;">📷 Con imagen</small>`
                : ""
              }
          </td>
          <td>${userAnswer.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}</td>
          <td>${correctAnswer
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;")}</td>
          <td class="${p.isCorrect ? "correct" : "incorrect"}">${p.isCorrect ? "✓" : "✗"
              }</td>
        </tr>`;
          })
          .join("")}
    </tbody>
  </table>
  <div class="footer">
    <p>© ${getCurrentYear()} JUANABE - Sistema de Admisión</p>
    <p>Documento generado automáticamente</p>
  </div>
  <div class="no-print" style="text-align: center; margin-top: 30px;">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, "_blank");

      if (!newWindow) {
        notify.push("warning", "Por favor permite las ventanas emergentes");
        return;
      }

      notify.push(
        "success",
        "Documento generado. Presiona Ctrl+P para imprimir"
      );
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      notify.push("error", "Error al generar el documento");
      console.error("Error generando PDF:", error);
    }
  };

  if (finished && results) {
    return (
      <div className="w-full bg-white/30 backdrop-blur-sm rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
        {/* NUEVO: Mostrar información del estudiante */}
        <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-700">Aspirante:</h3>
          <p className="text-xl sm:text-2xl font-bold text-red-700">
            {student.nombre} {student.apellido}
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Documento: {student.documento} | Grado: {student.grado}
          </p>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center text-gray-800">
          Resultados del Examen
        </h2>

        <div
          className={`text-center p-4 sm:p-6 rounded-lg mb-4 sm:mb-6 ${results.passed
              ? "bg-green-100 border-2 border-green-500"
              : "bg-red-100 border-2 border-red-500"
            }`}
        >
          <p
            className={`text-xl sm:text-2xl font-bold ${results.passed ? "text-green-700" : "text-red-700"
              }`}
          >
            {results.passed ? "✓ APROBADO" : "✗ REPROBADO"}
          </p>
          <p className="text-gray-700 mt-2 text-sm sm:text-base">
            Puntaje: {results.score} / {config.questions.length}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-lg shadow text-center">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">Lenguaje</h3>
            <p className="text-2xl sm:text-3xl font-bold text-blue-900">
              {results.byArea.lenguaje}/5
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-6 rounded-lg shadow text-center">
            <h3 className="font-semibold text-green-800 mb-2 text-sm sm:text-base">Inglés</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-900">
              {results.byArea.ingles}/5
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 sm:p-6 rounded-lg shadow text-center sm:col-span-2 lg:col-span-1">
            <h3 className="font-semibold text-purple-800 mb-2 text-sm sm:text-base">Matemáticas</h3>
            <p className="text-2xl sm:text-3xl font-bold text-purple-900">
              {results.byArea.matematicas}/5
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={generatePDF}
            className="flex-1 px-4 sm:px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition font-semibold text-sm sm:text-base min-h-[44px]"
          >
            🖨️ Imprimir/Guardar PDF
          </button>
          <button
            onClick={() => {
              onDone(); // Llamar a la función de finalización original
              // El progreso se elimina automáticamente en un useEffect cuando finished es true
            }}
            className="flex-1 px-4 sm:px-6 py-3 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition font-semibold text-sm sm:text-base min-h-[44px]"
          >
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/30 backdrop-blur-sm rounded-lg shadow-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 pb-4 border-b gap-2 sm:gap-0">
        <div className="font-medium text-gray-700 text-sm sm:text-base">
          Pregunta {i + 1} de {config.questions.length}
        </div>
        <div
          className={`font-bold text-lg sm:text-xl ${t < 300 ? "text-red-600" : "text-gray-700"
            }`}
        >
          ⏱️ {Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <span className="inline-block px-2 sm:px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs sm:text-sm font-medium mb-3">
          {q.area.charAt(0).toUpperCase() + q.area.slice(1)}
        </span>

        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
          {q.pregunta}
        </h3>

        {/* Mostrar imagen de la pregunta si existe */}
        {q.imagenPregunta && (
          <div className="flex justify-center mb-4 sm:mb-6">
            <ZoomableImage
              key={`q-${q.id}-img`}
              src={q.imagenPregunta}
              alt="Imagen de la pregunta"
              className="max-w-sm sm:max-w-md max-h-48 sm:max-h-64 object-contain rounded-lg shadow-md border-2 border-gray-200"
            />
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:gap-3 mb-6 sm:mb-8">
        {q.opciones.map((opcion, k) => {
          const textoOpcion = opcion?.texto || "";
          const imagenOpcion = opcion?.imagen || null;
          const selected = ans[q.id] === textoOpcion;

          return (
            <button
              key={k}
              onClick={() => handle(textoOpcion)}
              className={`px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 text-left transition min-h-[44px] sm:min-h-[48px] ${selected
                  ? "bg-blue-600 text-white border-blue-800 shadow-lg"
                  : "bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-blue-400"
                }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-semibold text-sm sm:text-base">
                  {String.fromCharCode(65 + k)}.
                </span>

                {/* Mostrar imagen de la opción si existe */}
                {imagenOpcion && (
                  <ZoomableImage
                    key={`q-${q.id}-opt-${k}`}
                    src={imagenOpcion}
                    alt={`Opción ${k + 1}`}
                    className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded"
                  />
                )}

                <span className="flex-1 text-sm sm:text-base">{textoOpcion || `Opción ${k + 1}`}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
        <button
          className="px-4 sm:px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition disabled:opacity-50 text-sm sm:text-base min-h-[44px] w-full sm:w-auto"
          onClick={() => setI((x) => Math.max(x - 1, 0))}
          disabled={i === 0}
        >
          ← Anterior
        </button>
        <div className="text-xs sm:text-sm text-gray-600 order-first sm:order-none">
          Respondidas: {Object.keys(ans).length} / {config.questions.length}
        </div>
        {i < config.questions.length - 1 ? (
          <button
            className="px-4 sm:px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-sm sm:text-base min-h-[44px] w-full sm:w-auto"
            onClick={() => setI((x) => x + 1)}
          >
            Siguiente →
          </button>
        ) : (
          <button
            className={`px-4 sm:px-5 py-2 rounded-lg font-semibold transition text-sm sm:text-base min-h-[44px] w-full sm:w-auto ${Object.keys(ans).length === config.questions.length
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            onClick={finish}
            disabled={Object.keys(ans).length !== config.questions.length}
          >
            Terminar Examen
          </button>
        )}
      </div>
    </div>
  );
}
