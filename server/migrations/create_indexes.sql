CREATE INDEX IF NOT EXISTS idx_estudiantes_documento ON estudiantes(documento);
CREATE INDEX IF NOT EXISTS idx_examenes_estudiante ON examenes(documento);
CREATE INDEX IF NOT EXISTS idx_respuestas_examen ON respuestas(examen_id);