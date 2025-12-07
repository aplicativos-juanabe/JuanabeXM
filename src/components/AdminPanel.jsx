import { useState, useEffect } from "react";
import { examApi } from "../api/examApi";
import { Trash2, Download, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { useNotification } from "../hooks/useNotification";
import * as XLSX from 'xlsx';
import { normalizeGrade } from "../utils/gradeUtils";

export default function AdminPanel() {
  const [resultados, setResultados] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [gradoFiltro, setGradoFiltro] = useState('todos'); // ⭐ NUEVO
  const [documentoFiltro, setDocumentoFiltro] = useState(''); // Filtro por documento
  const [nombreFiltro, setNombreFiltro] = useState('');     // Filtro por nombre
  const [generandoPDF, setGenerandoPDF] = useState(null); // ⭐ NUEVO: Para tracking de PDF en generación
  const notify = useNotification();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resData, statsData] = await Promise.all([
        examApi.obtenerTodosResultados(),
        examApi.obtenerEstadisticas()
      ]);
      setResultados(resData);
      setStats(statsData);
      notify.push("success", "Datos actualizados");
    } catch (error) {
      console.error(error);
      notify.push("error", "Error cargando datos");
    } finally {
      setLoading(false);
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
        'Fecha': new Date(new Date(res.fecha_examen).setHours(new Date(res.fecha_examen).getHours() - 5)).toLocaleString('es-CO'),
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
      const fecha = new Date().toISOString().split('T')[0];
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <div className="flex gap-3">
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
          >
            <Download size={20} />
            Exportar a Excel
          </button>
          <button 
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow"
          >
            <RefreshCw size={20} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ⭐ NUEVO: Filtro por grado */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filtrar por grado:
          </label>
          <select
            value={gradoFiltro}
            onChange={(e) => setGradoFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar por Documento:
          </label>
          <input
            type="text"
            placeholder="Escribe el documento..."
            value={documentoFiltro}
            onChange={(e) => setDocumentoFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* ⭐ NUEVO: Filtro por Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar por Nombre/Apellido:
          </label>
          <input
            type="text"
            placeholder="Escribe el nombre o apellido..."
            value={nombreFiltro}
            onChange={(e) => setNombreFiltro(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        
        <button
          onClick={clearFilters}
          className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition shadow"
        >
        🗑️ Limpiar filtros
        </button>

        <p className="text-sm text-gray-500 mt-2">
          Mostrando {resultadosFiltrados.length} de {resultados.length} exámenes
        </p>
      </div>

      {/* Estadísticas */}
      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600">Total Exámenes</h3>
              <p className="text-3xl font-bold text-blue-700">{stats.total_examenes || 0}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600">Aprobados</h3>
              <p className="text-3xl font-bold text-green-700">{stats.total_aprobados || 0}</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600">Promedio General</h3>
              <p className="text-3xl font-bold text-purple-700">
                {(stats.promedio_general || 0).toFixed(1)}/15
              </p>
            </div>
            <div className="bg-yellow-50 p-6 rounded-lg shadow">
              <h3 className="text-sm text-gray-600">Tasa Aprobación</h3>
              <p className="text-3xl font-bold text-yellow-700">
                {stats.total_examenes > 0 
                  ? ((stats.total_aprobados / stats.total_examenes) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>

          {/* Promedios por área */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border-2 border-blue-200 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-blue-800 mb-2">Lenguaje</h3>
              <p className="text-2xl font-bold">{(stats.promedio_lenguaje || 0).toFixed(1)}/5</p>
            </div>
            <div className="bg-white border-2 border-green-200 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-green-800 mb-2">Inglés</h3>
              <p className="text-2xl font-bold">{(stats.promedio_ingles || 0).toFixed(1)}/5</p>
            </div>
            <div className="bg-white border-2 border-purple-200 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-purple-800 mb-2">Matemáticas</h3>
              <p className="text-2xl font-bold">{(stats.promedio_matematicas || 0).toFixed(1)}/5</p>
            </div>
          </div>
        </>
      )}

      {/* Tabla de resultados */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-red-700 text-white">
          <h2 className="text-xl font-bold">
            Resultados de Exámenes ({resultadosFiltrados.length}) 
          </h2>
        </div>
        
        {resultadosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
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
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Nombre
                  </th>
                  {/* ⭐ NUEVA COLUMNA */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Grado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Puntaje
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    I
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    M
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {resultadosFiltrados.map((res) => ( 
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(new Date(res.fecha_examen).setHours(new Date(res.fecha_examen).getHours() - 5)).toLocaleString('es-CO')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {res.documento}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 uppercase">
                      {res.nombre} {res.apellido}
                    </td>
                    {/* ⭐ NUEVA CELDA */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {normalizeGrade(res.grado) || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {res.puntaje_total}/15
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {res.puntaje_lenguaje}/5
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {res.puntaje_ingles}/5
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                      {res.puntaje_matematicas}/5
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        res.aprobado 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
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
                              : 'text-blue-600 hover:bg-blue-50'
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
                              : 'text-red-600 hover:bg-red-50'
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
        )}
      </div>
    </div>
  );
}