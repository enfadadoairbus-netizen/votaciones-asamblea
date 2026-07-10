import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:   "#151A21",   // texto principal
        paper: "#F6F7F5",   // fondo
        card:  "#FFFFFF",
        brand: "#28506E",   // azul asamblea (acción principal)
        favor: "#1E7F55",   // a favor
        contra:"#B4472B",   // en contra (clay, no rojo puro)
        muted: "#6B7280"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
