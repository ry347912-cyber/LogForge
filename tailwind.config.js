/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forge: {
          900: '#020817',
          800: '#0f1629',
          700: '#1a2440',
          600: '#1e3a5f',
          500: '#0ea5e9',
          400: '#38bdf8',
          300: '#7dd3fc',
        },
        danger: { 500: '#ef4444', 400: '#f87171', 600: '#dc2626' },
        warn: { 500: '#f59e0b', 400: '#fbbf24' },
        success: { 500: '#10b981', 400: '#34d399' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: { from: { transform: 'translateY(-10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
}
