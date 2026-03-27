/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dev: '#4F46E5',
        network: '#059669',
      },
    },
  },
  plugins: [],
}
