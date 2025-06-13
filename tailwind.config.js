/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        'display': ['Orbitron', 'system-ui', 'sans-serif'],
      },
      colors: {
        'ton': {
          50: '#e6f2ff',
          100: '#b3d9ff',
          200: '#80c0ff',
          300: '#4da6ff',
          400: '#1a8cff',
          500: '#0066cc',
          600: '#0052a3',
          700: '#003d7a',
          800: '#002952',
          900: '#001429',
        },
        'cosmic': {
          50: '#f0f0ff',
          100: '#d9d9ff',
          200: '#b3b3ff',
          300: '#8c8cff',
          400: '#6666ff',
          500: '#4040ff',
          600: '#3333cc',
          700: '#262699',
          800: '#1a1a66',
          900: '#0d0d33',
        },
        'mystical': {
          50: '#fff0f5',
          100: '#ffd9e6',
          200: '#ffb3cc',
          300: '#ff8cb3',
          400: '#ff6699',
          500: '#ff4080',
          600: '#cc3366',
          700: '#99264d',
          800: '#661a33',
          900: '#330d1a',
        }
      },
      backgroundImage: {
        'cosmic-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'mystical-gradient': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'ton-gradient': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'sacred-gradient': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        'enlightenment': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        sparkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.1)' }
        }
      }
    },
  },
  plugins: [],
};