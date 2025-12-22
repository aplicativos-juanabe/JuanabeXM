import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { useNotification } from "../hooks/useNotification";

export default function ExamConfigModal({ isOpen, onClose, onSave, config }) {
  const [formData, setFormData] = useState({
    nombre: "",
    tiempo_limite_minutos: 60,
    preguntas_lenguaje: 5,
    preguntas_ingles: 5,
    preguntas_matematicas: 5,
    orden_aleatorio: 1, // 1 para true, 0 para false
  });
  const notify = useNotification();

  useEffect(() => {
    if (config) {
      setFormData({
        nombre: config.nombre,
        tiempo_limite_minutos: config.tiempo_limite_minutos,
        preguntas_lenguaje: config.preguntas_lenguaje,
        preguntas_ingles: config.preguntas_ingles,
        preguntas_matematicas: config.preguntas_matematicas,
        orden_aleatorio: config.orden_aleatorio,
      });
    } else {
      setFormData({
        nombre: "",
        tiempo_limite_minutos: 60,
        preguntas_lenguaje: 5,
        preguntas_ingles: 5,
        preguntas_matematicas: 5,
        orden_aleatorio: 1, // Default a aleatorio
      });
    }
  }, [config, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" 
        ? (checked ? 1 : 0) 
        : type === "number" 
          ? parseInt(value, 10) || 0 
          : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.tiempo_limite_minutos) {
      notify.push("error", "Por favor, completa los campos obligatorios.");
      return;
    }
    if (
      formData.preguntas_lenguaje < 0 ||
      formData.preguntas_ingles < 0 ||
      formData.preguntas_matematicas < 0 ||
      formData.tiempo_limite_minutos <= 0
    ) {
      notify.push("error", "Los valores numéricos deben ser positivos.");
      return;
    }
    // Asegurar que todos los valores numéricos sean enteros
    const dataToSave = {
      ...formData,
      tiempo_limite_minutos: parseInt(formData.tiempo_limite_minutos, 10),
      preguntas_lenguaje: parseInt(formData.preguntas_lenguaje, 10),
      preguntas_ingles: parseInt(formData.preguntas_ingles, 10),
      preguntas_matematicas: parseInt(formData.preguntas_matematicas, 10),
      orden_aleatorio: formData.orden_aleatorio === 1 ? 1 : 0,
    };
    onSave(dataToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bg-black bg-opacity-30 text-black backdrop-blur-md inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white  rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">
            {config ? "Editar Configuración" : "Nueva Configuración de Examen"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Nombre de la Configuración
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tiempo Límite (minutos)
              </label>
              <input
                type="number"
                name="tiempo_limite_minutos"
                value={formData.tiempo_limite_minutos}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                min="1"
                required
              />
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                name="orden_aleatorio"
                checked={formData.orden_aleatorio === 1}
                onChange={handleChange}
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Ordenar preguntas aleatoriamente
              </label>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Número de Preguntas por Área
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Lenguaje
                </label>
                <input
                  type="number"
                  name="preguntas_lenguaje"
                  value={formData.preguntas_lenguaje}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Inglés
                </label>
                <input
                  type="number"
                  name="preguntas_ingles"
                  value={formData.preguntas_ingles}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Matemáticas
                </label>
                <input
                  type="number"
                  name="preguntas_matematicas"
                  value={formData.preguntas_matematicas}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  min="0"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              <Save size={18} />
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}