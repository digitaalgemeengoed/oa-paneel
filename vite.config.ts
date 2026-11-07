import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Eén zelfstandige module met eigen css, zodat elke werkomgeving het paneel
// kan laden zonder bouwstraat.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "oa-paneel.js", cssFileName: "oa-paneel" },
    sourcemap: true,
  },
});
