import React, { useState, useEffect } from "react";
import { X, Save, Plus } from "lucide-react";
import { useNotification } from "../hooks/useNotification";

export default function QuestionModal({ isOpen, onClose, onSave, question }) {
  const [formData, setFormData] = useState({
    grado: "",
    area: "",
    pregunta: "",
    imagenPregunta: "",
    opciones: [
      { texto: "", imagen: "" },
      { texto: "", imagen: "" },
      { texto: "", imagen: "" },
      { texto: "", imagen: "" },
    ],
    respuestaCorrecta: "",
  });
  const notify = useNotification();

  useEffect(() => {
    if (question) {
      setFormData({
        grado: question.grado,
        area: question.area,
        pregunta: question.pregunta,
        imagenPregunta: question.imagen_pregunta || "",
        opciones: question.opciones.map((opt) => ({
          texto: opt.texto || "",
          imagen: opt.imagen || "",
        })),
        respuestaCorrecta: question.respuesta_correcta,
      });
    } else {
      setFormData({
        grado: "",
        area: "",
        pregunta: "",
        imagenPregunta: "",
        opciones: [
          { texto: "", imagen: "" },
          { texto: "", imagen: "" },
          { texto: "", imagen: "" },
          { texto: "", imagen: "" },
        ],
        respuestaCorrecta: "",
      });
    }
  }, [question, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (index, field, value) => {
    const newOpciones = [...formData.opciones];
    newOpciones[index][field] = value;
    setFormData((prev) => ({ ...prev, opciones: newOpciones }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.grado || !formData.area || !formData.pregunta || !formData.respuestaCorrecta) {
      notify.push("error", "Por favor, completa los campos obligatorios.");
      return;
    }
    // Validar que la respuesta correcta sea una de las opciones
    const opcionesTexto = formData.opciones.map(opt => opt.texto);
    if (!opcionesTexto.includes(formData.respuestaCorrecta)) {
        notify.push("error", "La respuesta correcta debe coincidir con una de las opciones de texto.");
        return;
    }
    onSave(formData);
  };

  if (!isOpen) return null;
  //  devolver al primer classname
  return (
    <div className="fixed bg-black bg-opacity-30 text-black backdrop-blur-md inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white  rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl text-black font-bold">
            {question ? "Editar Pregunta" : "Nueva Pregunta"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Grado</label>
              <input
                type="text"
                name="grado"
                value={formData.grado}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Área</label>
              <input
                type="text"
                name="area"
                value={formData.area}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Pregunta</label>
            <textarea
              name="pregunta"
              value={formData.pregunta}
              onChange={handleChange}
              rows="3"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            ></textarea>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Imagen de Pregunta (URL o Ruta)
            </label>
            <input
              type="text"
              name="imagenPregunta"
              value={formData.imagenPregunta}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Opciones</h3>
            {formData.opciones.map((opcion, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Opción {index + 1} Texto
                  </label>
                  <input
                    type="text"
                    value={opcion.texto}
                    onChange={(e) => handleOptionChange(index, "texto", e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Opción {index + 1} Imagen (URL o Ruta)
                  </label>
                  <input
                    type="text"
                    value={opcion.imagen}
                    onChange={(e) => handleOptionChange(index, "imagen", e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Respuesta Correcta (Texto exacto de una opción)
            </label>
            <input
              type="text"
              name="respuestaCorrecta"
              value={formData.respuestaCorrecta}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>

          <div className="flex justify-end gap-3">
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
              Guardar Pregunta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}