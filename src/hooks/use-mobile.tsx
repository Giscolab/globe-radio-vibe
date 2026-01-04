import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const getMatches = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  };

  const [isMobile, setIsMobile] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const listener = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    media.addEventListener("change", listener);

    return () => {
      media.removeEventListener("change", listener);
    };
  }, []);

  return isMobile;
}
