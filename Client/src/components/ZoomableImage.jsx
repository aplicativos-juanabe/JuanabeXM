import { X, ZoomIn } from "lucide-react";
import { useState, useEffect } from "react";

// Componente Modal de Imagen
function ImageModal({ src, alt, onClose }) {
  useEffect(() => {
    // Cerrar con tecla ESC
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 backdrop-blur-md bg-white bg-opacity-80 rounded-3xl z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-white text-gray-800 rounded-full p-3 hover:bg-gray-200 transition shadow-lg z-[10000]"
        title="Cerrar (ESC)"
      >
        <X size={24} />
      </button>
      
      <div 
        className="relative max-w-7xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        
{/*         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm">
          Haz clic fuera de la imagen o presiona ESC para cerrar
        </div> */}
      </div>
    </div>
  );
}

// Componente de Imagen con zoom
export default function ZoomableImage({ src, alt, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  console.log('🖼️ ZoomableImage renderizado con src:', src, 'alt:', alt);
  // Keep local state in sync with incoming src prop
  useEffect(() => {
    setCurrentSrc(src);
    // reset error flag when the prop changes so the new image gets a chance to load
    setImageError(false);
  }, [src]);
  // no usamos img_original como fallback: respetamos solo /img/

  if (imageError) {
    console.warn('Imagen no disponible, mostrando placeholder:', src);
    // Mostrar un placeholder visual en vez de null para evitar huecos en la UI
    return (
      <>
        <div
          className={`relative group cursor-default bg-gray-100 border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center ${className}`}
          title="Imagen no disponible"
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="4" width="22" height="16" rx="2" stroke="#9CA3AF" strokeWidth="1.5" fill="#F3F4F6" />
            <path d="M4 9l4 4 3-3 6 6" stroke="#6B7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mt-3 text-center text-xs text-gray-600">Imagen no disponible</div>
          <div className="mt-1 text-center text-xs text-gray-400 select-none">{alt || src}</div>
        </div>

        {/* Mantener la posibilidad de abrir un modal con placeholder */}
        {isOpen && (
          <ImageModal
            src={src}
            alt={alt || 'Imagen no disponible'}
            onClose={() => {
              setIsOpen(false);
            }}
          />
        )}
      </>
    );
  }

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Imagen clickeada:', src);
    setIsOpen(true);
  };

  console.log('ZoomableImage renderizado, isOpen:', isOpen);

  return (
    <>
      <div 
        className="relative group cursor-pointer"
        onClick={handleClick}
      >
        <img
          src={currentSrc}
          alt={alt}
          className={`${className} transition-transform duration-200 group-hover:scale-105`}
          onError={(e) => {
            console.error('❌ Error cargando imagen:', currentSrc);
            console.error('❌ Alt text:', alt);
            console.error('❌ Event details:', e);
            // No intentamos rutas de respaldo (p.ej. /img_original) — marcamos error y mostramos placeholder
            setImageError(true);
          }}
        />
        
        {/* Overlay con icono de zoom */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center rounded-lg pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white rounded-full p-2 shadow-lg">
            <ZoomIn className="text-gray-800" size={24} />
          </div>
        </div>
        
        {/* Indicador de "Click para ampliar" */}
{/*         <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded pointer-events-none">
          Ampliar
        </div> */}
      </div>

      {isOpen && (
        <ImageModal
          src={src}
          alt={alt}
          onClose={() => {
            console.log('Cerrando modal');
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}