module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}', './index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Lichess-inspired palette
        'l-bg':    { DEFAULT: '#262421', light: '#312E2B', lighter: '#3C3836' },
        'l-board': { light: '#F0D9B5', dark: '#B58863' },
        'l-text':  { DEFAULT: '#BABABA', muted: '#999999', dim: '#6B6B6B' },
        'l-accent': { blue: '#5B8FB9', green: '#629924', orange: '#CC8B2C' },
        surface: '#2C2926',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
