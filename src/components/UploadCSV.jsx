import { Upload } from "lucide-react";
import { useNotification } from "../hooks/useNotification.js";
import { examApi } from "../api/examApi"; // Importar examApi

export default function UploadCSV({ onLoad }) {
  const notify = useNotification();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      notify.push("info", "Subiendo archivo CSV... Esto puede tardar unos segundos.");
      const response = await fetch('/api/upload-questions', {
        method: 'POST',
        headers: {
          'x-admin-key': localStorage.getItem('admin-key') || '',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details ? data.details.join("; ") : data.error || "Error desconocido";
        throw new Error(errorMsg);
      }

      notify.push("success", `Se cargaron ${data.insertedCount} preguntas correctamente.`);
      onLoad(); // Cargar datos actualizados en AdminPanel
    } catch (error) {
      notify.push("error", `Error al subir el archivo CSV: ${error.message}`);
      console.error(error);
    }

    // Limpiar el input file
    e.target.value = null;
  };
// disabled and style none para que no se pueda subir el archivo CSV
  return (
    <label disabled={true} style={{ display: 'none' }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded cursor-pointer hover:bg-red-700 transition">
      <Upload size={18} />
      <span>Cargar Preguntas</span>
      <input type="file" className="hidden" accept=".csv" onChange={handleUpload} />
    </label>
  );
}