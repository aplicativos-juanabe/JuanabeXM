import { useState, useEffect } from "react";
import NotificationProvider from "./components/NotificationProvider";
import UploadCSV from "./components/UploadCSV";
import StudentRegistration from "./components/StudentRegistration";
import Exam from "./components/Exam";
import AdminPanel from "./components/AdminPanel";
import { examApi } from "./api/examApi";

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

  // Función para cargar preguntas
  const loadQuestions = async () => {
      try {
      console.log("🔄 Cargando preguntas desde API...");
      const apiQuestions = await examApi.obtenerTodasLasPreguntas();
      console.log("📦 Preguntas recibidas:", apiQuestions.length);

        const questions = {};

        // helper to normalize grade keys and image paths
        const { normalizeGrade } = await import('./utils/gradeUtils.js');
        const { normalizeImagePath } = await import('./utils/imageUtils.js');

      apiQuestions.forEach((q) => {
        const gradeKey = normalizeGrade(q.grado);
        const area = q.area
            .trim()
            .toLowerCase()
            .normalize("NFD")
          .replace(/['\u0300-\u036f]/g, "")
            .replace(/[^a-z]/g, "");

          if (!questions[gradeKey]) questions[gradeKey] = {};
          if (!questions[gradeKey][area]) questions[gradeKey][area] = [];

          // The API already returns questions with properly formatted opciones
          // Just normalize the image paths
          const questionWithNormalizedImages = {
            ...q,
            imagenPregunta: normalizeImagePath(q.imagenPregunta),
            opciones: q.opciones.map(op => ({
              ...op,
              imagen: normalizeImagePath(op.imagen)
            }))
          };

          questions[gradeKey][area].push(questionWithNormalizedImages);
        });

        setQuestionBank(questions);
        console.log(
          "✅ Preguntas procesadas. Grados disponibles:",
          Object.keys(questions)
        );
        console.log("📊 Detalles por grado:", Object.entries(questions).map(([grado, areas]) => ({
          grado,
          areas: Object.keys(areas),
          total: Object.values(areas).reduce((sum, arr) => sum + arr.length, 0)
        })));
      } catch (error) {
      console.error("❌ Error cargando preguntas desde la API:", error);
      console.error("Detalles del error:", error.message);
      } finally {
        setLoading(false);
      }
    };

  // useEffect para cargar preguntas al inicio
  useEffect(() => {
    loadQuestions();
  }, []);

  // Detectar atajo de teclado para admin (Ctrl + Alt + A)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.altKey && e.key === "a") {
        console.log("🎯 Combinación Ctrl+Alt+A detectada");
        e.preventDefault();
        setShowAdmin(prev => {
          const newValue = !prev;
          console.log("🔄 showAdmin cambiado a:", newValue);
          return newValue;
        });
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []); // Sin dependencias para evitar re-registro

  console.log("🔍 Estado actual - showAdmin:", showAdmin, "loading:", loading);

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
          <header className="bg-juanabe-rojo text-white px-6 py-4 flex justify-between items-center">
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
  // establecer imagen de fondo bg-[url('/background.jpg')]
  return (
    <NotificationProvider>
      <div className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-gradient-to-br from-green-100 via-white to-red-100">
        <header className="bg-white header-shadow px-4 sm:px-6 py-3 sm:py-5 flex justify-between items-center">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Espacio para el logo */}
            <div className="flex-shrink-0">
              <img
                src="/logo.png"
                alt="Logo de la Institución"
                className="h-12 sm:h-20 w-12 sm:w-20 object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-semibold text-gray-600">
                Institución Educativa Técnica Departamental
              </h2>
              <h1 className="text-xl sm:text-3xl font-bold text-red-700">
                JUANA ARIAS DE BENAVIDES
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Examen de Admisión para el año lectivo 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {Object.keys(questionBank).length > 0 && (
              <div className="text-xs sm:text-sm text-gray-600 bg-green-50 px-2 sm:px-3 py-1 sm:py-2 rounded">
                ✅ {Object.keys(questionBank).length} grado(s) cargado(s)
              </div>
            )}
            <button
              onClick={() => setShowAdmin(true)}
              className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs sm:text-sm"
              // Ocultar el boton de admin
              disabled={true}
              style={{ display: 'none' }}
            >
              Admin
            </button>
            <UploadCSV onLoad={loadQuestions} />
          </div>
        </header>

        <main className="flex-grow w-full max-w-4xl mx-auto p-4 sm:p-6 pb-20 sm:pb-6">
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

        <footer className="mt-auto w-full text-center py-4 sm:py-6 text-gray-600 text-xs sm:text-sm bg-white/80 backdrop-blur-sm border-t border-gray-200">
          © {new Date().getFullYear()} JUANABE – Sistema de Admisión
        </footer>
      </div>
    </NotificationProvider>
  );





  
}
