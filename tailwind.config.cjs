/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "ebony-bg": "#202024",
        "ebony-surface": "#29292e",
        "ebony-deep": "#1a1a1a",
        "ebony-border": "#323238",
        "ebony-primary": "#850000",
        "ebony-text": "#E1E1E6",
        "ebony-muted": "#A8A8B3",
      },
      boxShadow: {
        "neon-green": "0 0 10px rgba(34, 197, 94, 0.25)",
      },
    },
  },
  plugins: [],
};
