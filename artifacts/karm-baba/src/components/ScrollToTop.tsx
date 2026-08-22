import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * SPA navigation keeps the previous scroll position. Reset to the top of the
 * page (and main landmark) whenever the route changes.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const main = document.getElementById("main-content");
      if (main) main.scrollTop = 0;
    };

    reset();
    const id = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(id);
  }, [location]);

  return null;
}
