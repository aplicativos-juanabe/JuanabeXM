/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Habilitar modo oscuro basado en clases
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeInUp 0.4s ease-out',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      colors: {
        juanabe: {
          gris: "#DFDDDC",
          negro: "#010000",
          rojo: "#CD2325",
          beige: "#C19B94",
          oliva: "#6F8A3C",
          rojoClaro: "#D95C5B",
        }
      }
    },
  },
  plugins: [],
}
