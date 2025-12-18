#!/bin/bash

echo "🚀 Configurando Plataforma de Evaluación JUANABE..."

# Crear estructura de carpetas
mkdir -p src/components src/context src/hooks src/utils src/styles public

echo "📦 Instalando dependencias..."
npm install

echo "✅ ¡Proyecto configurado exitamente!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Copia los archivos de código en sus respectivas carpetas"
echo "2. Crea el archivo preguntas.csv con el formato indicado"
echo "3. Ejecuta: npm run dev"
echo ""
echo "🌐 La aplicación se abrirá en: http://localhost:3000"