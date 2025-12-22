const API_URL = import.meta.env.VITE_API_URL || '/api';  // URL de la API de Railway

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
  },

  // Funciones para la gestión de preguntas (ADMINISTRACIÓN)
  async obtenerTodasLasPreguntas() {
    console.log('📚 Obteniendo todas las preguntas...');
    try {
      const response = await fetch(`${API_URL}/preguntas`);
      if (!response.ok) throw new Error('Error obteniendo preguntas');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerTodasLasPreguntas:', error);
      throw error;
    }
  },

  async obtenerPreguntaPorId(id) {
    console.log('🔎 Obteniendo pregunta por ID:', id);
    try {
      const response = await fetch(`${API_URL}/preguntas/${id}`, {
        headers: {
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
      });
      if (!response.ok) throw new Error('Error obteniendo pregunta');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerPreguntaPorId:', error);
      throw error;
    }
  },

  async crearPregunta(preguntaData) {
    console.log('➕ Creando pregunta:', preguntaData);
    try {
      const response = await fetch(`${API_URL}/preguntas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
        body: JSON.stringify(preguntaData),
      });
      if (!response.ok) throw new Error('Error creando pregunta');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en crearPregunta:', error);
      throw error;
    }
  },

  async actualizarPregunta(id, preguntaData) {
    console.log('✏️ Actualizando pregunta:', id, preguntaData);
    try {
      const response = await fetch(`${API_URL}/preguntas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
        body: JSON.stringify(preguntaData),
      });
      if (!response.ok) throw new Error('Error actualizando pregunta');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en actualizarPregunta:', error);
      throw error;
    }
  },

  async eliminarPregunta(id) {
    console.log('🗑️ Eliminando pregunta:', id);
    try {
      const response = await fetch(`${API_URL}/preguntas/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
      });
      if (!response.ok) throw new Error('Error eliminando pregunta');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en eliminarPregunta:', error);
      throw error;
    }
  },

  // Funciones para el progreso del examen
  async guardarProgresoExamen(documento, currentQuestionIndex, answers, questions = null, config = null, examId = null, remainingTimeSeconds = null) {
    console.log('💾 Guardando progreso del examen para:', documento);
    try {
      const response = await fetch(`${API_URL}/examen/progreso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento,
          currentQuestionIndex,
          answersJson: answers, // Pass object directly, let database handle JSON.stringify
          questionsJson: questions, // Pass object directly
          configJson: config, // Pass object directly
          examId,
          remainingTimeSeconds
        }),
      });
      if (!response.ok) throw new Error('Error guardando progreso del examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en guardarProgresoExamen:', error);
      throw error;
    }
  },

  async obtenerProgresoExamen(documento) {
    console.log('📈 Obteniendo progreso del examen para:', documento);
    try {
      const response = await fetch(`${API_URL}/examen/progreso/${documento}`);
      if (!response.ok) {
        if (response.status === 404) return null; // No hay progreso guardado
        throw new Error('Error obteniendo progreso del examen');
      }
      const data = await response.json();
      return { ...data, answersJson: JSON.parse(data.answers_json) }; // Parsear JSON de respuestas
    } catch (error) {
      console.error('❌ Error en obtenerProgresoExamen:', error);
      throw error;
    }
  },

  async eliminarProgresoExamen(documento) {
    console.log('🗑️ Eliminando progreso del examen para:', documento);
    try {
      const response = await fetch(`${API_URL}/examen/progreso/${documento}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
      });
      if (!response.ok) throw new Error('Error eliminando progreso del examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en eliminarProgresoExamen:', error);
      throw error;
    }
  },

  async obtenerTodosProgresosPendientes() {
    console.log('📊 Obteniendo todos los progresos pendientes...');
    try {
      const response = await fetch(`${API_URL}/examen/progreso-pendiente`, {
        headers: {
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
      });
      if (!response.ok) throw new Error('Error obteniendo progresos pendientes');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerTodosProgresosPendientes:', error);
      throw error;
    }
  },

  // Funciones para la gestión de configuraciones de examen (ADMINISTRACIÓN)
  async obtenerConfiguracionesExamen() {
    console.log('⚙️ Obteniendo configuraciones de examen...');
    try {
      const response = await fetch(`${API_URL}/examen/configuraciones`);
      if (!response.ok) throw new Error('Error obteniendo configuraciones de examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerConfiguracionesExamen:', error);
      throw error;
    }
  },

  async obtenerConfiguracionExamenPorId(id) {
    console.log('⚙️ Obteniendo configuración de examen por ID:', id);
    try {
      const response = await fetch(`${API_URL}/examen/configuraciones/${id}`);
      if (!response.ok) throw new Error('Error obteniendo configuración de examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en obtenerConfiguracionExamenPorId:', error);
      throw error;
    }
  },

  async crearConfiguracionExamen(configData) {
    console.log('➕ Creando configuración de examen:', configData);
    try {
      const response = await fetch(`${API_URL}/examen/configuraciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
        body: JSON.stringify(configData),
      });
      if (!response.ok) throw new Error('Error creando configuración de examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en crearConfiguracionExamen:', error);
      throw error;
    }
  },

  async actualizarConfiguracionExamen(id, configData) {
    console.log('✏️ Actualizando configuración de examen:', id, configData);
    try {
      const response = await fetch(`${API_URL}/examen/configuraciones/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
        body: JSON.stringify(configData),
      });
      if (!response.ok) throw new Error('Error actualizando configuración de examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en actualizarConfiguracionExamen:', error);
      throw error;
    }
  },

  async eliminarConfiguracionExamen(id) {
    console.log('🗑️ Eliminando configuración de examen:', id);
    try {
      const response = await fetch(`${API_URL}/examen/configuraciones/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
      });
      if (!response.ok) throw new Error('Error eliminando configuración de examen');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Error en eliminarConfiguracionExamen:', error);
      throw error;
    }
  }
};
