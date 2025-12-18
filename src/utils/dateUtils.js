/**
 * Utilidades centralizadas para manejo consistente de fechas y horas
 * Todas las fechas se almacenan en UTC en la base de datos SQLite
 * Se convierten a zona horaria de Colombia (America/Bogota, UTC-5) para display
 */

/**
 * Convierte un timestamp de SQLite (formato 'YYYY-MM-DD HH:MM:SS') a fecha local de Colombia
 * @param {string} sqliteTimestamp - Timestamp en formato SQLite
 * @returns {Date} Objeto Date en zona horaria local
 */
export const parseSQLiteTimestamp = (sqliteTimestamp) => {
  if (!sqliteTimestamp) return null;

  try {
    // SQLite CURRENT_TIMESTAMP está en UTC, agregar 'Z' para indicar UTC
    const utcDate = new Date(sqliteTimestamp.replace(" ", "T") + "Z");
    return utcDate;
  } catch (error) {
    console.warn('Error parsing SQLite timestamp:', sqliteTimestamp, error);
    return null;
  }
};

/**
 * Formatea una fecha para display en español colombiano
 * @param {string|Date} date - Fecha a formatear
 * @param {object} options - Opciones de formato (opcional)
 * @returns {string} Fecha formateada
 */
export const formatDateForDisplay = (date, options = {}) => {
  if (!date) return 'N/A';

  try {
    let dateObj;

    if (typeof date === 'string') {
      // Si es string, intentar parsear como SQLite timestamp
      dateObj = parseSQLiteTimestamp(date);
      if (!dateObj) {
        // Si no es SQLite timestamp, intentar parsear como ISO string
        dateObj = new Date(date);
      }
    } else {
      dateObj = date;
    }

    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
      return 'Fecha inválida';
    }

    const defaultOptions = {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    return dateObj.toLocaleString('es-CO', { ...defaultOptions, ...options });
  } catch (error) {
    console.warn('Error formatting date for display:', date, error);
    return 'Error en fecha';
  }
};

/**
 * Formatea una fecha solo con fecha (sin hora) para display
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada (solo fecha)
 */
export const formatDateOnly = (date) => {
  return formatDateForDisplay(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: undefined,
    minute: undefined
  });
};

/**
 * Formatea una fecha para nombres de archivo (formato YYYY-MM-DD)
 * @param {Date} date - Fecha a formatear (por defecto, fecha actual)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const formatForFilename = (date = new Date()) => {
  try {
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Error formatting date for filename:', error);
    return new Date().toISOString().split('T')[0];
  }
};

/**
 * Obtiene la fecha y hora actual formateada para display
 * @returns {string} Fecha y hora actual
 */
export const getCurrentDateTime = () => {
  return formatDateForDisplay(new Date());
};

/**
 * Obtiene solo el año actual
 * @returns {number} Año actual
 */
export const getCurrentYear = () => {
  return new Date().getFullYear();
};

/**
 * Convierte una fecha a zona horaria de Colombia (UTC-5)
 * @param {Date} date - Fecha a convertir
 * @returns {Date} Fecha convertida a zona horaria local
 */
export const convertToLocalTimezone = (date) => {
  if (!date || !(date instanceof Date)) return date;

  try {
    // Crear nueva fecha con la misma hora pero en zona local
    return new Date(date.toLocaleString("sv-SE", { timeZone: "America/Bogota" }));
  } catch (error) {
    console.warn('Error converting to local timezone:', error);
    return date;
  }
};

/**
 * Valida si una cadena es un timestamp válido de SQLite
 * @param {string} timestamp - Timestamp a validar
 * @returns {boolean} True si es válido
 */
export const isValidSQLiteTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') return false;

  // Regex para formato 'YYYY-MM-DD HH:MM:SS'
  const sqliteTimestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

  if (!sqliteTimestampRegex.test(timestamp)) return false;

  // Verificar que la fecha sea válida
  const date = parseSQLiteTimestamp(timestamp);
  return date instanceof Date && !isNaN(date);
};
