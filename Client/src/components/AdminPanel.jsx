import { useState, useEffect } from "react";
import { examApi } from "../api/examApi";
import { Trash2, Download, RefreshCw, AlertCircle, FileText, Plus, ChevronDown, ChevronUp, Sun, Moon } from "lucide-react";
import { useNotification } from "../hooks/useNotification";
import { useTheme } from "../context/ThemeContext";
import * as XLSX from 'xlsx';
import { normalizeGrade } from "../utils/gradeUtils";
import { formatDateForDisplay, formatForFilename } from "../utils/dateUtils";
import QuestionModal from "./QuestionModal";
import ExamConfigModal from "./ExamConfigModal";

export default function AdminPanel() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [resultados, setResultados] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [gradoFiltro, setGradoFiltro] = useState('todos'); // ⭐ NUEVO
  const [documentoFiltro, setDocumentoFiltro] = useState(''); // Filtro por documento
  const [nombreFiltro, setNombreFiltro] = useState('');     // Filtro por nombre
  const [generandoPDF, setGenerandoPDF] = useState(null); // ⭐ NUEVO: Para tracking de PDF en generación
  const [questions, setQuestions] = useState([]); // Nuevo estado para preguntas
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // Pregunta siendo editada
  const [examConfigurations, setExamConfigurations] = useState([]); // Nuevo estado para configuraciones de examen
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null); // Configuración siendo editada
  const [pendingProgress, setPendingProgress] = useState([]); // Nuevo estado para exámenes con progreso pendiente
  // Filtros para preguntas
  const [questionIdFiltro, setQuestionIdFiltro] = useState('');
  const [questionGradoFiltro, setQuestionGradoFiltro] = useState('todos');
  const [questionAreaFiltro, setQuestionAreaFiltro] = useState('todos');
  const [questionTextoFiltro, setQuestionTextoFiltro] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    resultados: true,
    preguntas: true,
    configuraciones: true,
    progreso: true
  });
  const notify = useNotification();

  useEffect(() => {
    // Set admin key for API authentication
    localStorage.setItem('admin-key', 'mi_clave_super_segura_2024');
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Load all data including pending progress
      const [resData, statsData, questionsData, configData, progressData] = await Promise.all([
        examApi.obtenerTodosResultados(),
        examApi.obtenerEstadisticas(),
        examApi.obtenerTodasLasPreguntas(),
        examApi.obtenerConfiguracionesExamen(),
        loadPendingProgress(), // Load pending progress
      ]);
      setResultados(resData);
      setStats(statsData);
      setQuestions(questionsData);
      setExamConfigurations(configData);
      setPendingProgress(progressData);
      console.log("🔄 Setting pending progress:", progressData);
      notify.push("success", `Datos actualizados - ${progressData.length} exámenes pendientes`);
    } catch (error) {
      console.error(error);
      notify.push("error", "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  // Function to load pending progress from all students
  const loadPendingProgress = async () => {
    try {
      console.log("🔄 Loading pending progress...");
      const progressData = await examApi.obtenerTodosProgresosPendientes();
      console.log("📊 Pending progress data received:", progressData);
      return progressData;
    } catch (error) {
      console.error("❌ Error loading pending progress:", error);
      return [];
    }
  };

  const handleOpenQuestionModal = (question = null) => {
    setEditingQuestion(question);
    setIsQuestionModalOpen(true);
  };

  const handleCloseQuestionModal = () => {
    setIsQuestionModalOpen(false);
    setEditingQuestion(null);
  };

  const handleSaveQuestion = async (questionData) => {
    try {
      if (editingQuestion) {
        await examApi.actualizarPregunta(editingQuestion.id, questionData);
        notify.push("success", "Pregunta actualizada");
      } else {
        await examApi.crearPregunta(questionData);
        notify.push("success", "Pregunta creada");
      }
      cargarDatos();
      handleCloseQuestionModal();
    } catch (error) {
      console.error(error);
      notify.push("error", `Error guardando pregunta: ${error.message}`);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta pregunta?")) return;
    try {
      await examApi.eliminarPregunta(id);
      notify.push("success", "Pregunta eliminada");
      cargarDatos();
    } catch (error) {
      console.error(error);
      notify.push("error", `Error eliminando pregunta: ${error.message}`);
    }
  };

  const handleOpenConfigModal = (config = null) => {
    setEditingConfig(config);
    setIsConfigModalOpen(true);
  };

  const handleCloseConfigModal = () => {
    setIsConfigModalOpen(false);
    setEditingConfig(null);
  };

  const handleSaveConfig = async (configData) => {
    try {
      if (editingConfig) {
        await examApi.actualizarConfiguracionExamen(editingConfig.id, configData);
        notify.push("success", "Configuración de examen actualizada");
      } else {
        await examApi.crearConfiguracionExamen(configData);
        notify.push("success", "Configuración de examen creada");
      }
      cargarDatos();
      handleCloseConfigModal();
    } catch (error) {
      console.error(error);
      notify.push("error", `Error guardando configuración: ${error.message}`);
    }
  };

  const handleDeleteConfig = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta configuración de examen?")) return;
    try {
      await examApi.eliminarConfiguracionExamen(id);
      notify.push("success", "Configuración de examen eliminada");
      cargarDatos();
    } catch (error) {
      console.error(error);
      notify.push("error", `Error eliminando configuración: ${error.message}`);
    }
  };

  const handleEliminar = async (examenId, nombreCompleto) => {
    if (confirmDelete !== examenId) {
      setConfirmDelete(examenId);
      notify.push("warning", "Haz clic de nuevo para confirmar eliminación");
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }

    try {
      await examApi.eliminarExamen(examenId);
      notify.push("success", `Examen de ${nombreCompleto} eliminado`);
      cargarDatos();
      setConfirmDelete(null);
    } catch (error) {
      console.error(error);
      notify.push("error", "Error eliminando registro");
    }
  };

  const handleEliminarProgreso = async (documento, nombreCompleto) => {
    if (!window.confirm(`¿Estás seguro de eliminar el progreso pendiente de ${nombreCompleto}?`)) {
      return;
    }

    try {
      await examApi.eliminarProgresoExamen(documento);
      notify.push("success", `Progreso pendiente de ${nombreCompleto} eliminado`);
      cargarDatos();
    } catch (error) {
      console.error(error);
      notify.push("error", "Error eliminando progreso pendiente");
    }
  };

  const handleRegenerarPDF = async (examenId, nombreCompleto) => {
    try {
      setGenerandoPDF(examenId);
      await examApi.regenerarPDF(examenId);
      notify.push("success", `PDF de ${nombreCompleto} generado. Presiona Ctrl+P para guardar`);
    } catch (error) {
      console.error(error);
      notify.push("error", error?.message || "Error generando PDF");
    } finally {
      setGenerandoPDF(null);
    }
  };

  const exportarExcel = () => {
    try {
      // Preparar datos para Excel - ⭐ INCLUYE GRADO
      const datosExcel = resultados.map(res => ({
        'Fecha': formatDateForDisplay(res.fecha_examen),
        'Documento': res.documento,
        'Nombre': res.nombre,
        'Apellido': res.apellido,
        'Grado': normalizeGrade(res.grado) || 'N/A', // ⭐ NUEVO CAMPO
        'Puntaje Total': `${res.puntaje_total}/15`,
        'Lenguaje': `${res.puntaje_lenguaje}/5`,
        'Inglés': `${res.puntaje_ingles}/5`,
        'Matemáticas': `${res.puntaje_matematicas}/5`,
        'Estado': res.aprobado ? 'APROBADO' : 'REPROBADO',
        'Porcentaje': `${((res.puntaje_total / 15) * 100).toFixed(1)}%`
      }));

      // Crear libro de Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datosExcel);

      // Ajustar anchos de columna - ⭐ ACTUALIZADO
      const colWidths = [
        { wch: 20 }, // Fecha
        { wch: 15 }, // Documento
        { wch: 15 }, // Nombre
        { wch: 15 }, // Apellido
        { wch: 10 }, // ⭐ Grado
        { wch: 12 }, // Puntaje Total
        { wch: 10 }, // Lenguaje
        { wch: 10 }, // Inglés
        { wch: 12 }, // Matemáticas
        { wch: 12 }, // Estado
        { wch: 12 }  // Porcentaje
      ];
      ws['!cols'] = colWidths;

      // Agregar hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');

      // Agregar hoja de estadísticas
      if (stats) {
        const statsData = [
          { Métrica: 'Total Exámenes', Valor: stats.total_examenes || 0 },
          { Métrica: 'Total Aprobados', Valor: stats.total_aprobados || 0 },
          { Métrica: 'Tasa de Aprobación', Valor: `${stats.total_examenes > 0 ? ((stats.total_aprobados / stats.total_examenes) * 100).toFixed(1) : 0}%` },
          { Métrica: 'Promedio General', Valor: `${(stats.promedio_general || 0).toFixed(1)}/15` },
          { Métrica: 'Promedio Lenguaje', Valor: `${(stats.promedio_lenguaje || 0).toFixed(1)}/5` },
          { Métrica: 'Promedio Inglés', Valor: `${(stats.promedio_ingles || 0).toFixed(1)}/5` },
          { Métrica: 'Promedio Matemáticas', Valor: `${(stats.promedio_matematicas || 0).toFixed(1)}/5` }
        ];
        const wsStats = XLSX.utils.json_to_sheet(statsData);
        wsStats['!cols'] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsStats, 'Estadísticas');
      }

      // Descargar archivo
      const fecha = formatForFilename();
      XLSX.writeFile(wb, `Resultados_Examenes_JUANABE_${fecha}.xlsx`);
      
      notify.push("success", "Excel generado correctamente");
    } catch (error) {
      console.error('Error exportando Excel:', error);
      notify.push("error", "Error generando archivo Excel");
    }
  };

  // ⭐ NUEVA FUNCIÓN: Filtrar por grado
  const resultadosFiltrados = resultados.filter(res => {
    const matchGrado = gradoFiltro === 'todos' || res.grado === gradoFiltro;
    const matchDocumento = res.documento.toLowerCase().includes(documentoFiltro.toLowerCase());
    const matchNombre = 
      res.nombre.toLowerCase().includes(nombreFiltro.toLowerCase()) ||
      res.apellido.toLowerCase().includes(nombreFiltro.toLowerCase());
    return matchGrado && matchDocumento && matchNombre;
  });

  const clearFilters = () => {
    setGradoFiltro('todos');
    setDocumentoFiltro('');
    setNombreFiltro('');
  };

  // Función para filtrar preguntas
  const preguntasFiltradas = questions.filter(q => {
    const matchId = questionIdFiltro === '' || q.id.toString().includes(questionIdFiltro);
    const matchGrado = questionGradoFiltro === 'todos' || q.grado === questionGradoFiltro;
    const matchArea = questionAreaFiltro === 'todos' || q.area === questionAreaFiltro;
    const matchTexto = questionTextoFiltro === '' ||
      q.pregunta.toLowerCase().includes(questionTextoFiltro.toLowerCase()) ||
      q.opciones.some(opt => opt.texto.toLowerCase().includes(questionTextoFiltro.toLowerCase()));
    return matchId && matchGrado && matchArea && matchTexto;
  });

  const clearQuestionFilters = () => {
    setQuestionIdFiltro('');
    setQuestionGradoFiltro('todos');
    setQuestionAreaFiltro('todos');
    setQuestionTextoFiltro('');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
        <div className="flex gap-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg transition shadow"
            title={isDarkMode ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            {isDarkMode ? "Tema Claro" : "Tema Oscuro"}
          </button>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 transition shadow"
          >
            <Download size={20} />
            Exportar a Excel
          </button>
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 transition shadow"
          >
            <RefreshCw size={20} />
            Actualizar
          </button>
        </div>
      </div>



      {/* Estadísticas */}
      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Total Exámenes</h3>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{stats.total_examenes || 0}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Aprobados</h3>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{stats.total_aprobados || 0}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Promedio General</h3>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                {(stats.promedio_general || 0).toFixed(1)}/15
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Tasa Aprobación</h3>
              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                {stats.total_examenes > 0
                  ? ((stats.total_aprobados / stats.total_examenes) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>

          {/* Promedios por área */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">Lenguaje</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(stats.promedio_lenguaje || 0).toFixed(1)}/5</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-700 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">Inglés</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(stats.promedio_ingles || 0).toFixed(1)}/5</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-700 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-purple-800 dark:text-purple-400 mb-2">Matemáticas</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(stats.promedio_matematicas || 0).toFixed(1)}/5</p>
            </div>
          </div>
        </>
      )}

      {/* ⭐ NUEVO: Filtro por grado */}
      <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filtrar por grado:
          </label>
          <select
            value={gradoFiltro}
            onChange={(e) => setGradoFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="todos">Todos los grados</option>
            <option value="3°">Tercero</option>
            <option value="4°">Cuarto</option>
            <option value="5°">Quinto</option>
            <option value="6°">Sexto</option>
            <option value="7°">Septimo</option>
            <option value="8°">Octavo</option>
            <option value="9°">Noveno</option>
            <option value="10°">Decimo</option>
            <option value="11°">Undecimo</option>
          </select>
        </div>

        {/* ⭐ NUEVO: Filtro por Documento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Buscar por Documento:
          </label>
          <input
            type="text"
            placeholder="Escribe el documento..."
            value={documentoFiltro}
            onChange={(e) => setDocumentoFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* ⭐ NUEVO: Filtro por Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Buscar por Nombre/Apellido:
          </label>
          <input
            type="text"
            placeholder="Escribe el nombre o apellido..."
            value={nombreFiltro}
            onChange={(e) => setNombreFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <button
          onClick={clearFilters}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition shadow"
        >
        🗑️ Limpiar filtros
        </button>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Mostrando {resultadosFiltrados.length} de {resultados.length} exámenes
        </p>
      </div>

      {/* Tabla de resultados */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-juanabe-rojo text-white flex justify-start gap-3 items-center">
          <h2 className="text-xl font-bold">
            Resultados de Exámenes ({resultadosFiltrados.length})
          </h2>
          <button
            onClick={() => toggleSection('resultados')}
            className="p-2 hover:bg-red-700 rounded transition"
            title={expandedSections.resultados ? "Colapsar" : "Expandir"}
          >
            {expandedSections.resultados ? (
              <ChevronUp size={24} className="text-white" />
            ) : (
              <ChevronDown size={24} className="text-white" />
            )}
          </button>
        </div>

        {expandedSections.resultados && (
          resultadosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <AlertCircle className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
              <p className="text-lg">
                {gradoFiltro === 'todos'
                  ? 'No hay exámenes registrados aún'
                  : `No hay exámenes registrados para el grado ${gradoFiltro}`
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Documento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Nombre
                    </th>
                    {/* ⭐ NUEVA COLUMNA */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Grado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Puntaje
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      L
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      I
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      M
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {resultadosFiltrados.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {formatDateForDisplay(res.fecha_examen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {res.documento}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 uppercase">
                        {res.nombre} {res.apellido}
                      </td>
                      {/* ⭐ NUEVA CELDA */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          {normalizeGrade(res.grado) || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                        {res.puntaje_total}/15
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                        {res.puntaje_lenguaje}/5
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                        {res.puntaje_ingles}/5
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 dark:text-purple-400">
                        {res.puntaje_matematicas}/5
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          res.aprobado
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}>
                          {res.aprobado ? 'APROBADO' : 'REPROBADO'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleRegenerarPDF(res.id, `${res.nombre} ${res.apellido}`)}
                            disabled={generandoPDF === res.id}
                            className={`p-2 rounded transition ${
                              generandoPDF === res.id
                                ? 'bg-blue-600 text-white cursor-wait'
                                : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            }`}
                            title="Regenerar PDF del examen"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleEliminar(res.id, `${res.nombre} ${res.apellido}`)}
                            className={`p-2 rounded transition ${
                              confirmDelete === res.id
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                            title="Eliminar registro"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Filtros para preguntas */}
      <div className="mb-6 mt-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ID de pregunta:
          </label>
          <input
            type="text"
            placeholder="Buscar por ID..."
            value={questionIdFiltro}
            onChange={(e) => setQuestionIdFiltro(e.target.value)}
            className="w-full md:w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Grado:
          </label>
          <select
            value={questionGradoFiltro}
            onChange={(e) => setQuestionGradoFiltro(e.target.value)}
            className="w-full md:w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="todos">Todos</option>
            <option value="3°">3°</option>
            <option value="4°">4°</option>
            <option value="5°">5°</option>
            <option value="6°">6°</option>
            <option value="7°">7°</option>
            <option value="8°">8°</option>
            <option value="9°">9°</option>
            <option value="10°">10°</option>
            <option value="11°">11°</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Área:
          </label>
          <select
            value={questionAreaFiltro}
            onChange={(e) => setQuestionAreaFiltro(e.target.value)}
            className="w-full md:w-40 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="todos">Todas</option>
            <option value="lenguaje">Lenguaje</option>
            <option value="ingles">Inglés</option>
            <option value="matematicas">Matemáticas</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Palabra contenida:
          </label>
          <input
            type="text"
            placeholder="Buscar en pregunta u opciones..."
            value={questionTextoFiltro}
            onChange={(e) => setQuestionTextoFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <button
          onClick={clearQuestionFilters}
          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition shadow"
        >
          🗑️ Limpiar filtros
        </button>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Mostrando {preguntasFiltradas.length} de {questions.length} preguntas
        </p>
      </div>

      {/* Sección de Gestión de Preguntas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mt-8">
        <div className="px-6 py-4 bg-juanabe-rojo text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Gestión de Preguntas ({preguntasFiltradas.length})</h2>
            <button
              onClick={() => toggleSection('preguntas')}
              className="p-2 hover:bg-red-700 rounded transition"
              title={expandedSections.preguntas ? "Colapsar" : "Expandir"}
            >
              {expandedSections.preguntas ? (
                <ChevronUp size={24} className="text-white" />
              ) : (
                <ChevronDown size={24} className="text-white" />
              )}
            </button>
          </div>
          <button
            onClick={() => handleOpenQuestionModal()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg hover:bg-juanabe-beige transition shadow"
          >
            <Plus size={20} />
            Añadir Nueva Pregunta
          </button>
        </div>

        {expandedSections.preguntas && (
          preguntasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <AlertCircle className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
              <p className="text-lg">
                {questions.length === 0
                  ? 'No hay preguntas registradas aún.'
                  : 'No se encontraron preguntas que coincidan con los filtros aplicados.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Grado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Área</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Pregunta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Opciones</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Respuesta Correcta</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {preguntasFiltradas.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{q.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{q.grado}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{q.area}</td>
                      <td className="px-6 py-4 whitespace-wrap text-sm text-gray-900 dark:text-gray-100 max-w-md">{q.pregunta}</td>
                      <td className="px-6 py-4 whitespace-wrap text-sm text-gray-600 dark:text-gray-300">
                        <div className="space-y-1">
                          {q.opciones
                            .filter(opt => opt.texto.trim())
                            .map((opt, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="font-semibold text-gray-800 dark:text-gray-200 min-w-[20px]">
                                  {String.fromCharCode(65 + i)}.
                                </span>
                                <span>{opt.texto}</span>
                              </div>
                            ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-wrap text-sm font-bold text-green-700 dark:text-green-400">{q.respuesta}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleOpenQuestionModal(q)}
                            className="p-2 rounded transition text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Editar pregunta"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-2 rounded transition text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Eliminar pregunta"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Sección de Gestión de Configuraciones de Examen */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mt-8">
        <div className="px-6 py-4 bg-juanabe-rojo text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Configuraciones de Examen ({examConfigurations.length})</h2>
            <button
              onClick={() => toggleSection('configuraciones')}
              className="p-2 hover:bg-red-700 rounded transition"
              title={expandedSections.configuraciones ? "Colapsar" : "Expandir"}
            >
              {expandedSections.configuraciones ? (
                <ChevronUp size={24} className="text-white" />
              ) : (
                <ChevronDown size={24} className="text-white" />
              )}
            </button>
          </div>
          <button
            onClick={() => handleOpenConfigModal()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg hover:bg-gray-100 transition shadow"
          >
            <Plus size={20} />
            Añadir Nueva Configuración
          </button>
        </div>

        {expandedSections.configuraciones && (
          examConfigurations.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <AlertCircle className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
              <p className="text-lg">No hay configuraciones de examen registradas aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Tiempo (min)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Preg. Lenguaje</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Preg. Inglés</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Preg. Matemáticas</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Aleatorio</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {examConfigurations.map((conf) => (
                    <tr key={conf.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{conf.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{conf.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{conf.tiempo_limite_minutos}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{conf.preguntas_lenguaje}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{conf.preguntas_ingles}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{conf.preguntas_matematicas}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                        {conf.orden_aleatorio ? "Sí" : "No"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleOpenConfigModal(conf)}
                            className="p-2 rounded transition text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Editar configuración"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteConfig(conf.id)}
                            className="p-2 rounded transition text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Eliminar configuración"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <QuestionModal
        isOpen={isQuestionModalOpen}
        onClose={handleCloseQuestionModal}
        onSave={handleSaveQuestion}
        question={editingQuestion}
      />

      {/* Sección de Progreso de Exámenes Pendientes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mt-8">
        <div className="px-6 py-4 bg-juanabe-rojo text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Progreso de Exámenes Pendientes ({pendingProgress.length})</h2>
            <button
              onClick={() => toggleSection('progreso')}
              className="p-2 hover:bg-red-700 rounded transition"
              title={expandedSections.progreso ? "Colapsar" : "Expandir"}
            >
              {expandedSections.progreso ? (
                <ChevronUp size={24} className="text-white" />
              ) : (
                <ChevronDown size={24} className="text-white" />
              )}
            </button>
          </div>
          <div className="text-sm bg-orange-600 px-3 py-1 rounded">
            Función Mejorada
          </div>
        </div>

        {expandedSections.progreso && (
          <div className="p-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-blue-400 dark:text-blue-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Sistema de Progreso Mejorado
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-200">
                    <p>
                      El sistema de guardado de progreso ha sido completamente mejorado para almacenar:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Las preguntas exactas asignadas al estudiante</li>
                      <li>Las respuestas que ya ha seleccionado</li>
                      <li>La configuración del examen utilizada</li>
                      <li>El tiempo transcurrido y el progreso actual</li>
                    </ul>
                    <p className="mt-2">
                      Al recuperar progreso, el estudiante ve exactamente las mismas preguntas que se le asignaron inicialmente.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {pendingProgress.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No hay exámenes pendientes
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Todos los estudiantes han completado sus exámenes o no hay progreso guardado actualmente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Documento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Último Guardado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Progreso
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {pendingProgress.map((progress) => (
                      <tr key={progress.documento} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {progress.documento}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {progress.nombre || 'Desconocido'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {formatDateForDisplay(progress.last_saved_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {progress.current_question_index || 0} preguntas respondidas
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleEliminarProgreso(progress.documento, `${progress.nombre || 'Estudiante'} ${progress.apellido || ''}`.trim())}
                            className="p-2 rounded transition text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Eliminar progreso pendiente"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Características del Sistema Mejorado:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">✅ Almacenamiento Completo</h5>
                  <p className="text-gray-600 dark:text-gray-400">Guarda preguntas, respuestas, configuración y tiempo</p>
                </div>
                <div>
                  <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">✅ Recuperación Exacta</h5>
                  <p className="text-gray-600 dark:text-gray-400">Muestra las mismas preguntas asignadas inicialmente</p>
                </div>
                <div>
                  <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">✅ Persistencia Segura</h5>
                  <p className="text-gray-600 dark:text-gray-400">Auto-guardado cada 3 segundos durante el examen</p>
                </div>
                <div>
                  <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-1">✅ Gestión Administrativa</h5>
                  <p className="text-gray-600 dark:text-gray-400">Vista completa de exámenes pendientes en el panel</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <QuestionModal
        isOpen={isQuestionModalOpen}
        onClose={handleCloseQuestionModal}
        onSave={handleSaveQuestion}
        question={editingQuestion}
      />

      <ExamConfigModal
        isOpen={isConfigModalOpen}
        onClose={handleCloseConfigModal}
        onSave={handleSaveConfig}
        config={editingConfig}
      />
    </div>
  );
}
