/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta de colores oscuros
        dark: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
        },
        // Colores primarios del proyecto
        primary: {
          700: '#0369a1',
          600: '#0284c7',
          500: '#0ea5e9',
          400: '#38bdf8',
          300: '#7dd3fc',
        },
        // Colores de anime personalizados
        anime: {
          primary: 'var(--anime-primary)',
          'primary-dark': 'var(--anime-primary-dark)',
        }
      },
      backgroundImage: {
        'anime-gradient': 'linear-gradient(135deg, var(--anime-gradient-start), var(--anime-gradient-end))',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      }
    },
  },
  plugins: [],
};
