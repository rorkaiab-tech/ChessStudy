export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        board: { light: '#eeeed2', dark: '#769656' },
        surface: '#0f1117',
        glass: 'rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
};
