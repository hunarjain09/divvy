/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./divvy.html",
    "./dist/index.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#30e87a",
        "primary-dark": "#25b860",
        "background-light": "#f6f8f7",
        "background-dark": "#112117",
        "slate-dark": "#1e293b",
        "slate-light": "#f8fafc",
        "text-main": "#111814"
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "sans": ["Inter", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "1rem",
        "lg": "1.5rem",
        "xl": "2rem",
        "2xl": "3rem",
        "full": "9999px"
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
