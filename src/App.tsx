import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSettingsStore } from "@/stores/settings.store";
import { setForceProxy } from "@/engine/radio/utils/httpsUpgrade";
import { getEngineConfig } from "@/engine/core/engineConfig";
import { logger, type LogLevel } from "@/engine/core/logger";
import { usePlaybackSignals } from "@/hooks/usePlaybackSignals";

// Lazy load pages to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Initialize settings on app load
function SettingsInitializer() {
  const forceProxy = useSettingsStore((s) => s.forceProxy);
  
  useEffect(() => {
    setForceProxy(forceProxy);
  }, [forceProxy]);

  useEffect(() => {
    const normalizeLevel = (value?: string): LogLevel | "none" | null => {
      if (!value) return null;
      const normalized = value.toLowerCase();
      if (normalized === "none") return "none";
      if (normalized === "debug") return "debug";
      if (normalized === "info") return "info";
      if (normalized === "warn") return "warn";
      if (normalized === "error") return "error";
      return null;
    };

    const configLevel = normalizeLevel(getEngineConfig().debug.logLevel);
    const envLevel = normalizeLevel(import.meta.env.VITE_LOG_LEVEL);
    const level = envLevel ?? configLevel ?? "warn";

    if (level === "none") {
      logger.setEnabled(false);
      return;
    }

    logger.setEnabled(true);
    logger.setLevel(level);
  }, []);
  
  return null;
}

function PlaybackSignalsInitializer() {
  usePlaybackSignals();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SettingsInitializer />
      <PlaybackSignalsInitializer />
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
