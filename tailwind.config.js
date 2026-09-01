/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: { terminal: '0 18px 50px rgba(0,0,0,.30)' }
    }
  },
  plugins: []
}
