import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import './styles/index.css'

// Debug: verificar si el CSS se está cargando
console.log('🎨 CSS cargado - Tailwind debería funcionar');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
// Force redeploy - 12/22/2025 13:43:51
