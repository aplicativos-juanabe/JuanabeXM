import { useState, useEffect } from "react";
import { useNotification } from "../hooks/useNotification";
import { examApi } from "../api/examApi";

export default function StudentRegistration({
  questionBank,
  studentData,
  setStudentData,
  setExamConfig
}) {
  const notify = useNotification();
  const [verificando, setVerificando] = useState(false);
  const [examenPrevio, setExamenPrevio] = useState(null);
  const [examConfigurations, setExamConfigurations] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState(null);
  const [savedProgress, setSavedProgress] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadConfigs = async () => {
      try {
        console.log("🔄 Cargando configuraciones de examen...");
        const configs = await examApi.obtenerConfiguracionesExamen();
        if (!isMounted) return;

        console.log("⚙️ Configuraciones recibidas:", configs.length);
        setExamConfigurations(configs);

        // Set default config
        if (configs.length > 0) {
          const firstId = Number(configs[0].id);
          setSelectedConfigId(firstId);
          console.log("✅ Configuración seleccionada por defecto:", firstId);
        } else {
          console.log("⚠️ No hay configuraciones disponibles");
          setSelectedConfigId(null);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("❌ Error cargando configuraciones:", error);
        console.error("Detalles del error:", error.message);
        notify.push("error", "Error cargando configuraciones de examen.");
      }
    };

    loadConfigs();

    return () => {
      isMounted = false;
    };
  }, []); // Sin dependencia en documento para evitar llamadas automáticas

  const verificarDocumento = async () => {
    if (!studentData.documento) {
      notify.push("warning", "Ingresa el documento primero");
      return;
    }

    setVerificando(true);
    try {
      const resultado = await examApi.verificarEstudiante(studentData.documento);

      if (resultado.examenRealizado) {
        setExamenPrevio(resultado.ultimoExamen);
        notify.push("warning", "Este documento ya realizó el examen");
      } else {
        // Verificar si hay progreso pendiente
        try {
          const progreso = await examApi.obtenerProgresoExamen(studentData.documento);
          if (progreso && progreso.questions_json && progreso.config_json) {
            // Hay progreso pendiente, mostrar la pantalla de recuperación
            setSavedProgress(progreso);
            notify.push("info", "Se encontró un examen sin completar");
          } else if (resultado.existe) {
            // No hay progreso pendiente, pero el estudiante existe
            const { normalizeGrade } = await import("../utils/gradeUtils");
            setStudentData({
              ...studentData,
              nombre: resultado.estudiante.nombre,
              apellido: resultado.estudiante.apellido,
              email: resultado.estudiante.email,
              telefono: resultado.estudiante.telefono,
              grado: normalizeGrade(resultado.estudiante.grado)
            });
            notify.push("info", "Datos encontrados y completados");
          } else {
            // Estudiante no existe
            notify.push("success", "Documento disponible");
          }
        } catch (error) {
          console.log("No hay progreso guardado:", error.message);
          // Si no hay progreso, continuar con la lógica normal
          if (resultado.existe) {
            const { normalizeGrade } = await import("../utils/gradeUtils");
            setStudentData({
              ...studentData,
              nombre: resultado.estudiante.nombre,
              apellido: resultado.estudiante.apellido,
              email: resultado.estudiante.email,
              telefono: resultado.estudiante.telefono,
              grado: normalizeGrade(resultado.estudiante.grado)
            });
            notify.push("info", "Datos encontrados y completados");
          } else {
            notify.push("success", "Documento disponible");
          }
        }
      }
    } catch (error) {
      console.error(error);
      notify.push("error", "Error verificando documento");
    } finally {
      setVerificando(false);
    }
  };

  const handleSubmit = async () => {
    if (!studentData.documento || !studentData.nombre || !studentData.apellido) {
      notify.push("warning", "Completa todos los campos obligatorios");
      return;
    }

    if (!studentData.grado) {
      notify.push("warning", "Seleccione un grado");
      return;
    }

    if (selectedConfigId === null || selectedConfigId === "") {
      notify.push("warning", "Seleccione una configuración de examen");
      return;
    }

    const selectedConfig = examConfigurations.find(c => c.id === selectedConfigId);
    if (!selectedConfig) {
      notify.push("error", "Configuración de examen no encontrada");
      return;
    }

    const gq = questionBank[studentData.grado];
    const areas = ["lenguaje", "ingles", "matematicas"];

    let hasEnoughQuestions = true;
    let missingAreas = [];

    if (selectedConfig.preguntas_lenguaje > 0 && (!gq["lenguaje"] || gq["lenguaje"].length < selectedConfig.preguntas_lenguaje)) {
      missingAreas.push("Lenguaje");
      hasEnoughQuestions = false;
    }
    if (selectedConfig.preguntas_ingles > 0 && (!gq["ingles"] || gq["ingles"].length < selectedConfig.preguntas_ingles)) {
      missingAreas.push("Inglés");
      hasEnoughQuestions = false;
    }
    if (selectedConfig.preguntas_matematicas > 0 && (!gq["matematicas"] || gq["matematicas"].length < selectedConfig.preguntas_matematicas)) {
      missingAreas.push("Matemáticas");
      hasEnoughQuestions = false;
    }

    if (!hasEnoughQuestions) {
      notify.push("error", `Faltan preguntas para las áreas: ${missingAreas.join(", ")}. Ajusta la configuración o añade más preguntas.`);
      return;
    }

    try {
      await examApi.registrarEstudiante(studentData);
    } catch (error) {
      console.log("Estudiante ya registrado, continuando...");
    }

    // Verificar si hay progreso guardado para determinar si usar las mismas preguntas
    let savedProgress = null;
    try {
      savedProgress = await examApi.obtenerProgresoExamen(studentData.documento);
    } catch (error) {
      console.log("No hay progreso guardado o error obteniendo progreso:", error);
    }

    let selected = [];
    let examConfigData = {
      questions: [],
      time: selectedConfig.tiempo_limite_minutos * 60,
      config: selectedConfig
    };

    if (savedProgress && savedProgress.questions_json && savedProgress.config_json) {
      // Si hay progreso completo guardado, usar las preguntas y configuración guardadas
      console.log("Recuperando preguntas y configuración del progreso guardado...");
      try {
        const savedQuestions = JSON.parse(savedProgress.questions_json);
        const savedConfig = JSON.parse(savedProgress.config_json);

        // Verificar que las preguntas guardadas aún existen en la base de datos
        const currentQuestions = await examApi.obtenerTodasLasPreguntas();
        const questionMap = new Map(currentQuestions.map(q => [q.id, q]));

        // Use the saved questions directly since they should be valid
        // The validation logic was causing issues because saved questions
        // might have different format than current database questions
        selected = savedQuestions;
        examConfigData.config = savedConfig;
        examConfigData.time = savedConfig.tiempo_limite_minutos * 60;
        console.log("✅ Preguntas y configuración recuperadas exitosamente del progreso guardado");
      } catch (error) {
        console.log("Error parseando progreso guardado, creando nuevas preguntas:", error);
        selected = [];
        areas.forEach((a) => {
          const numQuestions = selectedConfig[`preguntas_${a}`];
          if (numQuestions > 0) {
            const pool = [...gq[a]];
            if (selectedConfig.orden_aleatorio) {
              pool.sort(() => Math.random() - 0.5);
            }
            selected.push(...pool.slice(0, numQuestions).map((q) => ({ ...q, area: a })));
          }
        });
      }
    } else {
      // No hay progreso completo guardado, crear preguntas normalmente
      areas.forEach((a) => {
        const numQuestions = selectedConfig[`preguntas_${a}`];
        if (numQuestions > 0) {
          const pool = [...gq[a]];
          if (selectedConfig.orden_aleatorio) {
            pool.sort(() => Math.random() - 0.5);
          }
          selected.push(...pool.slice(0, numQuestions).map((q) => ({ ...q, area: a })));
        }
      });
    }

    if (selectedConfig.orden_aleatorio && (!savedProgress || !savedProgress.questions_json)) {
      selected.sort(() => Math.random() - 0.5);
    }

    examConfigData.questions = selected;
    setExamConfig(examConfigData);
    notify.push("success", "¡Examen iniciado! Buena suerte.");
  };

  // Mostrar progreso guardado si existe
  if (savedProgress && savedProgress.questions_json && savedProgress.config_json) {
    try {
      const savedConfig = JSON.parse(savedProgress.config_json);
      const savedQuestions = JSON.parse(savedProgress.questions_json);
      const savedAnswers = savedProgress.answersJson || {};
      const answeredCount = Object.keys(savedAnswers).length;
      const totalQuestions = savedQuestions.length;
      const currentQuestionIndex = savedProgress.current_question_index || 0;

      return (
        <div className="bg-white/30 backdrop-blur-sm rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📚</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Examen en Progreso
            </h2>
            <p className="text-gray-600">
              Se encontró un examen sin completar para el documento <strong>{studentData.documento}</strong>
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-800 mb-3">Detalles del Examen Guardado:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Configuración:</span>
                <span className="font-bold ml-2">{savedConfig.nombre}</span>
              </div>
              <div>
                <span className="text-blue-600">Tiempo:</span>
                <span className="font-bold ml-2">{savedConfig.tiempo_limite_minutos} minutos</span>
              </div>
              <div>
                <span className="text-blue-600">Preguntas Totales:</span>
                <span className="font-bold ml-2">{totalQuestions}</span>
              </div>
              <div>
                <span className="text-blue-600">Respondidas:</span>
                <span className="font-bold ml-2">{answeredCount} / {totalQuestions}</span>
              </div>
              <div>
                <span className="text-blue-600">Último Guardado:</span>
                <span className="font-bold ml-2">
                  {savedProgress.last_saved_time ?
                    new Date(savedProgress.last_saved_time).toLocaleString('es-CO') :
                    'N/A'
                  }
                </span>
              </div>
              <div>
                <span className="text-blue-600">Pregunta Actual:</span>
                <span className="font-bold ml-2">{currentQuestionIndex + 1}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>Recuperación Completa:</strong> Al continuar, verás exactamente las mismas preguntas que tenías antes,
                  con tus respuestas ya seleccionadas y el progreso exacto donde lo dejaste.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                // Recuperar el examen con las preguntas y configuración guardadas
                const examConfigData = {
                  questions: savedQuestions,
                  time: savedConfig.tiempo_limite_minutos * 60,
                  config: savedConfig
                };
                setExamConfig(examConfigData);
                notify.push("success", "¡Examen recuperado! Continuando donde lo dejaste.");
              }}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Continuar Examen
            </button>
            <button
              onClick={async () => {
                // Eliminar progreso y permitir nuevo examen
                try {
                  await examApi.eliminarProgresoExamen(studentData.documento);
                  setSavedProgress(null);
                  setSelectedConfigId(examConfigurations.length > 0 ? Number(examConfigurations[0].id) : null);
                  notify.push("info", "Progreso eliminado. Puedes iniciar un nuevo examen.");
                } catch (error) {
                  notify.push("error", "Error eliminando progreso.");
                }
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Nuevo Examen
            </button>
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error parseando progreso guardado:", error);
      // Si hay error parseando, mostrar opción de nuevo examen
      return (
        <div className="bg-white/30 backdrop-blur-sm rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Error en Progreso Guardado
            </h2>
            <p className="text-gray-600 mb-4">
              Hay un problema con el progreso guardado. Puedes iniciar un nuevo examen.
            </p>
            <button
              onClick={async () => {
                try {
                  await examApi.eliminarProgresoExamen(studentData.documento);
                  setSavedProgress(null);
                  setSelectedConfigId(examConfigurations.length > 0 ? Number(examConfigurations[0].id) : null);
                  notify.push("info", "Progreso eliminado. Puedes iniciar un nuevo examen.");
                } catch (error) {
                  notify.push("error", "Error eliminando progreso.");
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Iniciar Nuevo Examen
            </button>
          </div>
        </div>
      );
    }
  }

  if (examenPrevio) {
    return (
      <div className="bg-white/30 backdrop-blur-sm rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Examen Ya Realizado
          </h2>
          <p className="text-gray-600">
            El documento <strong>{studentData.documento}</strong> ya realizó el examen
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Resultados Anteriores:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Puntaje Total:</span>
              <span className="font-bold ml-2">{examenPrevio.puntaje_total}/15</span>
            </div>
            <div>
              <span className="text-gray-600">Estado:</span>
              <span className={`font-bold ml-2 ${examenPrevio.aprobado ? "text-green-600" : "text-red-600"}`}>
                {examenPrevio.aprobado ? "APROBADO" : "REPROBADO"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Lenguaje:</span>
              <span className="font-bold ml-2">{examenPrevio.puntaje_lenguaje}/5</span>
            </div>
            <div>
              <span className="text-gray-600">Inglés:</span>
              <span className="font-bold ml-2">{examenPrevio.puntaje_ingles}/5</span>
            </div>
            <div>
              <span className="text-gray-600">Matemáticas:</span>
              <span className="font-bold ml-2">{examenPrevio.puntaje_matematicas}/5</span>
            </div>
            <div>
              <span className="text-gray-600">Fecha:</span>
              <span className="font-bold ml-2">
                {(() => {
                  try {
                    const ts = examenPrevio.fecha_examen;
                    const formato = new RegExp("^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$");
                    if (typeof ts === "string" && formato.test(ts)) {
                      return new Date(ts.replace(" ", "T") + "Z").toLocaleDateString("es-CO");
                    }
                    return new Date(ts).toLocaleDateString("es-CO");
                  } catch (e) {
                    return String(examenPrevio.fecha_examen || "N/A");
                  }
                })()}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setExamenPrevio(null);
            setStudentData({
              nombre: "",
              apellido: "",
              documento: "",
              email: "",
              telefono: "",
              grado: ""
            });
          }}
          className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          Registrar Otro Estudiante
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/30 backdrop-blur-sm rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-red-700 mb-6">
        Registro del Estudiante
      </h2>

      <div className="space-y-5">
        <div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
              placeholder="Documento de identidad *"
              value={studentData.documento}
              onChange={(e) => setStudentData({ ...studentData, documento: e.target.value })}
              onBlur={verificarDocumento}
            />
            <button
              onClick={verificarDocumento}
              disabled={verificando}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 text-xl"
            >
              {verificando ? "..." : "✓"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Se verificará automáticamente si ya realizó el examen
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
            placeholder="Nombre *"
            value={studentData.nombre}
            onChange={(e) => setStudentData({ ...studentData, nombre: e.target.value })}
          />
          <input
            className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
            placeholder="Apellido *"
            value={studentData.apellido}
            onChange={(e) => setStudentData({ ...studentData, apellido: e.target.value })}
          />
        </div>

        <input
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
          placeholder="Email"
          type="email"
          value={studentData.email}
          onChange={(e) => setStudentData({ ...studentData, email: e.target.value })}
        />

        <input
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
          placeholder="Teléfono"
          value={studentData.telefono}
          onChange={(e) => setStudentData({ ...studentData, telefono: e.target.value })}
        />

        <select
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
          value={studentData.grado}
          onChange={(e) => setStudentData({ ...studentData, grado: e.target.value })}
        >
          <option value="">Seleccione un grado *</option>
          {Object.keys(questionBank).map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {examConfigurations.length > 0 && (
          <div>
            <select
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
              value={selectedConfigId || ""}
              onChange={(e) => setSelectedConfigId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Seleccione una configuración de examen *</option>
              {examConfigurations.map((config) => (
                <option key={config.id} value={config.id}>
                  {`${config.nombre} (T: ${config.tiempo_limite_minutos} min, L: ${config.preguntas_lenguaje}, I: ${config.preguntas_ingles}, M: ${config.preguntas_matematicas})`}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleSubmit}
          className="w-full px-6 py-4 bg-juanabe-rojo text-white font-bold rounded-lg hover:bg-red-700 transition shadow-lg"
        >
          Comenzar Examen
        </button>
      </div>
    </div>
  );
}
