import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { registerImageProxy } from "./src/server/image-proxy";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    mimeTypes: {
      "application/wasm": ["wasm"]
    },

    // 🔥 AJOUT CRUCIAL POUR OPFS / SharedArrayBuffer
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  },

  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"]
  },

  build: {
    commonjsOptions: {
      exclude: ["@sqlite.org/sqlite-wasm"]
    },
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
            "@radix-ui/react-scroll-area"
          ]
        }
      }
    }
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "wasm-mime-fix",
      configureServer(server: ViteDevServer) {
        registerImageProxy(server);
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      }
    }
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },

  assetsInclude: ["**/*.wasm"]
}));
