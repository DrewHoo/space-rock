import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // If this repo is named "space-rock" and published as a project site,
  // GitHub Pages will serve it from https://<user>.github.io/space-rock/
  // so we set the base path accordingly.
  base: "/space-rock/",
  plugins: [react(), tailwindcss()],
  worker: {
    format: "es",
  },
});
