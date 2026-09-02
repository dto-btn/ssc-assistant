import { useEffect } from "react";

// Ref-counted so multiple callers (e.g. concurrently mounted disclaimers)
// can request `#root` be inert without one's cleanup un-gating another's.
let inertCount = 0;

export function useInertRoot(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.getElementById("root");
    if (!root) return;

    inertCount += 1;
    root.inert = true;
    document.getElementById("modal-root")?.removeAttribute("aria-hidden");

    return () => {
      inertCount -= 1;
      if (inertCount === 0) root.inert = false;
    };
  }, [active]);
}
