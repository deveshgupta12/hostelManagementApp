/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Sora'", "sans-serif"],
        body: ["'Space Grotesk'", "sans-serif"],
      },
      boxShadow: {
        panel: "0 10px 30px rgba(17, 24, 39, 0.15)",
      },
    },
  },
  plugins: [],
};
