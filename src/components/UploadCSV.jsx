import { Upload } from "lucide-react";
import { useNotification } from "../hooks/useNotification.js";
import { parseCSV } from "../utils/csvParser.js";
import { normalizeImagePath } from '../utils/imageUtils.js';

export default function UploadCSV({ onLoad }) {
  const notify = useNotification();

  const handle = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const rows = parseCSV(await f.text());
      const questions = {};

      rows.slice(1).forEach((r) => {
        if (r.length < 13) {
          console.warn('Fila con formato incorrecto:', r);
          return;
        }
        
        const [g, a, p, imgP, o1, imgO1, o2, imgO2, o3, imgO3, o4, imgO4, res] = r;
        
        const area = a
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z]/g, "");

        if (!questions[g]) questions[g] = {};
        if (!questions[g][area]) questions[g][area] = [];

        questions[g][area].push({
          id: `${g}_${area}_${questions[g][area].length + 1}`,
          pregunta: p,
          imagenPregunta: normalizeImagePath(imgP),
          opciones: [
            { texto: o1, imagen: normalizeImagePath(imgO1) },
            { texto: o2, imagen: normalizeImagePath(imgO2) },
            { texto: o3, imagen: normalizeImagePath(imgO3) },
            { texto: o4, imagen: normalizeImagePath(imgO4) }
          ],
          respuesta: res,
        });
      });

      onLoad(questions);
      notify.push("success", "Banco de preguntas cargado correctamente");
    } catch (error) {
      notify.push("error", "Error al cargar el archivo CSV");
      console.error(error);
    }
  };

  return (
    <label className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded cursor-pointer hover:bg-red-700 transition">
      <Upload size={18} />
      <span>Cargar Preguntas</span>
      <input type="file" className="hidden" accept=".csv" onChange={handle} />
    </label>
  );
}