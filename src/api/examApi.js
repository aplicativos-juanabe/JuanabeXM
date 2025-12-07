const API_URL = '/api';  // ← CAMBIAR DE http://localhost:3001/api A SOLO /api

export const examApi = {
  // Verificar si estudiante existe y si ya realizó el examen
  async verificarEstudiante(documento) {
    console.log('🔍 Verificando estudiante:', documento);
    try {
      const response = await fetch(`${API_URL}/estudiante/${documento}`);
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error verificando estudiante');
      const data = await response.json();
      console.log('📥 Data recibida:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en verificarEstudiante:', error);
      throw error;
    }
  },

  // Registrar nuevo estudiante
  async registrarEstudiante(datos) {
    console.log('📝 Registrando estudiante:', datos);
    try {
      const response = await fetch(`${API_URL}/estudiante`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error registrando estudiante');
      const data = await response.json();
      console.log('📥 Data recibida:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en registrarEstudiante:', error);
      throw error;
    }
  },

  // Guardar resultado del examen
  async guardarExamen(documento, resultados, tiempoUsado) {
    console.log('💾 Guardando examen:', { documento, puntaje: resultados.score });
    try {
      const response = await fetch(`${API_URL}/examen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento, resultados, tiempoUsado })
      });
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error guardando examen');
      const data = await response.json();
      console.log('📥 Data recibida:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en guardarExamen:', error);
      throw error;
    }
  },

  // Obtener resultado específico
  async obtenerResultado(documento) {
    console.log('📊 Obteniendo resultado:', documento);
    try {
      const response = await fetch(`${API_URL}/resultado/${documento}`);
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error obteniendo resultado');
      const data = await response.json();
      console.log('📥 Data recibida:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerResultado:', error);
      throw error;
    }
  },

  // Obtener todos los resultados
  async obtenerTodosResultados() {
    console.log('📊 Obteniendo todos los resultados...');
    try {
      const response = await fetch(`${API_URL}/resultados`);
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error obteniendo resultados');
      const data = await response.json();
      console.log('📥 Total resultados:', data.length);
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerTodosResultados:', error);
      throw error;
    }
  },

  // Obtener estadísticas
  async obtenerEstadisticas() {
    console.log('📈 Obteniendo estadísticas...');
    try {
      const response = await fetch(`${API_URL}/estadisticas`);
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error obteniendo estadísticas');
      const data = await response.json();
      console.log('📥 Estadísticas recibidas:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerEstadisticas:', error);
      throw error;
    }
  },

  // Eliminar examen
  async eliminarExamen(examenId) {
    console.log('🗑️ Eliminando examen:', examenId);
    try {
      const response = await fetch(`${API_URL}/examen/${examenId}`, {
        method: 'DELETE'
      });
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error eliminando examen');
      const data = await response.json();
      console.log('📥 Data recibida:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en eliminarExamen:', error);
      throw error;
    }
  },

  // Eliminar estudiante
  async eliminarEstudiante(documento) {
    console.log('🗑️ Eliminando estudiante:', documento);
    try {
      const response = await fetch(`${API_URL}/estudiante/${documento}`, {
        method: 'DELETE'
      });
      console.log('📡 Response status:', response.status);
      if (!response.ok) throw new Error('Error eliminando estudiante');
      const data = await response.json();
      console.log('📥 Data recibida:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en eliminarEstudiante:', error);
      throw error;
    }
  },

  // Regenerar PDF de examen
  async regenerarPDF(examenId) {
    console.log('📄 Regenerando PDF para examen:', examenId);
    try {
      // Abrir la ventana primero para evitar bloqueos por popup
      const newWindow = window.open('', '_blank');
      if (!newWindow) {
        throw new Error('Las ventanas emergentes están bloqueadas');
      }

      const response = await fetch(`${API_URL}/examen/${examenId}/pdf`);
      console.log('📡 Response status:', response.status);
      const text = await response.text();
      if (!response.ok) {
        // Cerrar la ventana abierta porque hubo un error
        try { newWindow.close(); } catch (e) {}
        throw new Error(`Error generando PDF: ${response.status} ${text}`);
      }

      // Escribir el HTML directamente en la ventana abierta
      newWindow.document.open();
      newWindow.document.write(text);
      newWindow.document.close();

      return { success: true };
    } catch (error) {
      console.error('❌ Error en regenerarPDF:', error);
      throw error;
    }
  }
};