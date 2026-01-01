import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      // 🔥 Obligatoire pour SQLite WASM, assure les bonnes politiques CORS
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    mimeTypes: {
      // Assure que les fichiers .wasm sont correctement interprétés
      "application/wasm": ["wasm"],
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // -------------------------------------------------------------------
    // 🔥 FIX : Force le Content-Type 'application/wasm' pour le serveur de développement
    // Sans cela, le navigateur refuse de compiler le module SQLite.
    // -------------------------------------------------------------------
    {
      name: "wasm-mime-fix",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Si l'URL demande un fichier .wasm
          if (req.url?.endsWith(".wasm")) {
            // On force le bon type MIME
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-scroll-area",
          ],
        },
      },
    },
  },
  // Assure que les fichiers .wasm sont traités comme des assets
  assetsInclude: ["**/*.wasm"],
}));
