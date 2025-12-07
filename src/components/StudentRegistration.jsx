import { useState } from "react";
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
      } else if (resultado.existe) {
        // Autocompletar datos
        // Normalizar grado al autocompletar
        const { normalizeGrade } = await import('../utils/gradeUtils');
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
    } catch (error) {
      console.error(error);
      notify.push("error", "Error verificando documento");
    } finally {
      setVerificando(false);
    }
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!studentData.documento || !studentData.nombre || !studentData.apellido) {
      notify.push("warning", "Completa todos los campos obligatorios");
      return;
    }

    if (!studentData.grado) {
      notify.push("warning", "Seleccione un grado");
      return;
    }

    if (!questionBank[studentData.grado]) {
      notify.push("error", "No hay preguntas para este grado");
      return;
    }

    const gq = questionBank[studentData.grado];
    const areas = ["lenguaje", "ingles", "matematicas"];

    const missing = areas.filter((a) => !gq[a] || gq[a].length < 5);
    if (missing.length) {
      notify.push("error", "Faltan preguntas en: " + missing.join(", "));
      return;
    }

    // Registrar estudiante en la base de datos
    try {
      await examApi.registrarEstudiante(studentData);
    } catch (error) {
      // Si ya existe, continuar igual
      console.log("Estudiante ya registrado, continuando...");
    }

    // Seleccionar preguntas
    const selected = [];
    areas.forEach((a) => {
      const pool = [...gq[a]];
      pool.sort(() => Math.random() - 0.5);
      selected.push(...pool.slice(0, 5).map((q) => ({ ...q, area: a })));
    });

    selected.sort(() => Math.random() - 0.5);

    setExamConfig({ questions: selected, time: 2700 });
    notify.push("success", "¡Examen iniciado! Buena suerte.");
  };

  if (examenPrevio) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
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
              <span className={`font-bold ml-2 ${examenPrevio.aprobado ? 'text-green-600' : 'text-red-600'}`}>
                {examenPrevio.aprobado ? 'APROBADO' : 'REPROBADO'}
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
                    if (typeof ts === 'string' && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(ts)) {
                      return new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO');
                    }
                    return new Date(ts).toLocaleDateString('es-CO');
                  } catch (e) {
                    return String(examenPrevio.fecha_examen || 'N/A');
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
              grado: "",
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
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-red-700 mb-6">
        Registro del Estudiante
      </h2>

      <div className="space-y-5">
        {/* Documento con verificación */}
        <div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
              placeholder="Documento de identidad *"
              value={studentData.documento}
              onChange={(e) =>
                setStudentData({ ...studentData, documento: e.target.value })
              }
              onBlur={verificarDocumento}
            />
            <button
              onClick={verificarDocumento}
              disabled={verificando}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
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
            onChange={(e) =>
              setStudentData({ ...studentData, nombre: e.target.value })
            }
          />
          <input
            className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
            placeholder="Apellido *"
            value={studentData.apellido}
            onChange={(e) =>
              setStudentData({ ...studentData, apellido: e.target.value })
            }
          />
        </div>

        <input
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
          placeholder="Email"
          type="email"
          value={studentData.email}
          onChange={(e) =>
            setStudentData({ ...studentData, email: e.target.value })
          }
        />

        <input
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
          placeholder="Teléfono"
          value={studentData.telefono}
          onChange={(e) =>
            setStudentData({ ...studentData, telefono: e.target.value })
          }
        />

        <select
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
          value={studentData.grado}
          onChange={(e) =>
            setStudentData({ ...studentData, grado: e.target.value })
          }
        >
          <option value="">Seleccione un grado *</option>
          {Object.keys(questionBank).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <button
          onClick={handleSubmit}
          className="w-full px-6 py-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-lg"
        >
          Comenzar Examen
        </button>
      </div>
    </div>
  );
}