import { useState, useEffect } from "react";
import NotificationProvider from "./components/NotificationProvider";
import UploadCSV from "./components/UploadCSV";
import StudentRegistration from "./components/StudentRegistration";
import Exam from "./components/Exam";
import AdminPanel from "./components/AdminPanel";
import { parseCSV } from "./utils/csvParser";

export default function App() {
  const [questionBank, setQuestionBank] = useState({});
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState({
    nombre: "",
    apellido: "",
    documento: "",
    email: "",
    telefono: "",
    grado: "",
  });
  const [examConfig, setExamConfig] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  // useEffect para cargar preguntas (sin cambios)
  useEffect(() => {
    const loadDefaultQuestions = async () => {
      try {
        const response = await fetch("/preguntas.csv");
        const text = await response.text();

        const rows = parseCSV(text);
        const questions = {};

        // helper to normalize grade keys and image paths
        const { normalizeGrade } = await import('./utils/gradeUtils.js');
        const { normalizeImagePath } = await import('./utils/imageUtils.js');

        rows.slice(1).forEach((r) => {
          if (r.length < 13) return;

          const [g, a, p, imgP, o1, imgO1, o2, imgO2, o3, imgO3, o4, imgO4, res] = r;

          const area = a
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z]/g, "");

          // Normalizar la clave del grado (ej: '3ro' -> '3°')
          const gradeKey = normalizeGrade(g);

          if (!questions[gradeKey]) questions[gradeKey] = {};
          if (!questions[gradeKey][area]) questions[gradeKey][area] = [];


          questions[gradeKey][area].push({
            id: `${gradeKey}_${area}_${questions[gradeKey][area].length + 1}`,
            pregunta: p,
            imagenPregunta: normalizeImagePath(imgP),
            opciones: [
              { texto: o1, imagen: normalizeImagePath(imgO1) },
              { texto: o2, imagen: normalizeImagePath(imgO2) },
              { texto: o3, imagen: normalizeImagePath(imgO3) },
              { texto: o4, imagen: normalizeImagePath(imgO4) },
            ],
            respuesta: res,
          });
        });

        setQuestionBank(questions);
        console.log(
          "✅ Preguntas cargadas automáticamente:",
          Object.keys(questions)
        );
      } catch (error) {
        console.warn("⚠️ No se encontró preguntas.csv en /public/", error);
      } finally {
        setLoading(false);
      }
    };

    loadDefaultQuestions();
  }, []);

  // Detectar atajo de teclado para admin (Ctrl + Alt + A)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.altKey && e.key === "a") {
        setShowAdmin(!showAdmin);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Cargando banco de preguntas...
          </p>
        </div>
      </div>
    );
  }

  // Mostrar panel de admin
  if (showAdmin) {
    return (
      <NotificationProvider>
        <div className="min-h-screen bg-gray-100">
          <header className="bg-red-700 text-white px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              Panel de Administración - JUANABE
            </h1>
            <button
              onClick={() => setShowAdmin(false)}
              className="px-4 py-2 bg-white text-red-700 rounded hover:bg-gray-100 transition"
            >
              Volver al Examen
            </button>
          </header>
          <AdminPanel />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-gradient-to-br from-green-100 via-white to-red-100">
        <header className="bg-white shadow-md px-6 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Espacio para el logo */}
            <div className="flex-shrink-0">
              <img
                src="/logo.png"
                alt="Logo de la Institución"
                className="h-20 w-20 object-contain"
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-600">
                Institución Educativa Técnica Departamental
              </h2>
              <h1 className="text-3xl font-bold text-red-700">
                JUANA ARIAS DE BENAVIDES
              </h1>
              <p className="text-sm text-gray-600">
                Examen de Admisión para el año lectivo 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {Object.keys(questionBank).length > 0 && (
              <div className="text-sm text-gray-600 bg-green-50 px-3 py-2 rounded">
                ✅ {Object.keys(questionBank).length} grado(s) cargado(s)
              </div>
            )}
            <UploadCSV onLoad={setQuestionBank} />
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6">
          {!examConfig ? (
            <StudentRegistration
              questionBank={questionBank}
              studentData={studentData}
              setStudentData={setStudentData}
              setExamConfig={setExamConfig}
            />
          ) : (
            <Exam
              student={studentData}
              config={examConfig}
              onDone={() => {
                setExamConfig(null);
                setStudentData({
                  nombre: "",
                  apellido: "",
                  documento: "",
                  email: "",
                  telefono: "",
                  grado: "",
                });
              }}
            />
          )}
        </main>

        <footer className="text-center py-6 text-gray-600 text-sm">
          © {new Date().getFullYear()} JUANABE – Sistema de Admisión
        </footer>
      </div>
    </NotificationProvider>
  );





  
}
