import { cn } from "@utils/stringUtils";
import "molstar/build/viewer/molstar.css";
import { memo, useEffect, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  useMolstarViewer,
  destroyViewer,
  type MoleculeStyle,
  type MoleculeHighlight,
  type MoleculePayload,
} from "./hooks/useMolstarViewer";

const MoleculeViewer = memo(
  ({
    moleculePayloads,
    className,
    backgroundHexColor,
    defaultStructureHexColor,
    viewerId,
  }: {
    moleculePayloads: (MoleculePayload | null)[];
    className?: string;
    backgroundHexColor?: string;
    defaultStructureHexColor?: string;
    viewerId?: string;
  }) => {
    const DEFAULT_STRUCTURE_COLOR = defaultStructureHexColor ?? "#94a3b8";
    const DEFAULT_BACKGROUND_COLOR = "#f4f4f4";

    const parentRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Generate immutable viewerId on first render (avoids SSR hydration mismatch & mid-flight store swaps)
    const resolvedIdRef = useRef(
      viewerId ??
        `molecule-viewer-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    );
    const stableViewerId = resolvedIdRef.current;

    // Use the new hook - store managed outside React
    const { ready, api } = useMolstarViewer(stableViewerId);

    /* ───────────────── init once & cleanup on unmount ───────────────── */
    useEffect(() => {
      if (!canvasRef.current || !parentRef.current) return;

      void api.init(canvasRef.current, parentRef.current, {
        background: backgroundHexColor ?? DEFAULT_BACKGROUND_COLOR,
        defaultColor: DEFAULT_STRUCTURE_COLOR,
      });

      return () => {
        api.unmountCanvas();
        // Clean up the store when component unmounts
        destroyViewer(stableViewerId);
      };
    }, []); // ← EXACTLY once

    /* ───────────────── bg colour updates ───────────────── */
    useEffect(() => {
      if (ready && backgroundHexColor) {
        api.setBackground(backgroundHexColor);
      }
    }, [ready, backgroundHexColor, api]);

    /* ───────────────── load / update structures ───────────────── */
    useEffect(() => {
      if (!ready) return;

      (async () => {
        // Ensure structures are loaded (only rebuilds if content changed)
        await api.ensurePayloads(moleculePayloads, DEFAULT_STRUCTURE_COLOR);

        // Apply transforms imperatively (no rebuilds)
        await api.applyTransforms(moleculePayloads);

        // Apply per-structure themes imperatively (no rebuilds)
        await api.applyThemes(moleculePayloads);

        // Apply highlights imperatively (no rebuilds)
        await api.applyHighlights(moleculePayloads);
      })();
    }, [ready, moleculePayloads, DEFAULT_STRUCTURE_COLOR, api]);

    /* ───────────────── render ───────────────── */
    return (
      <ErrorBoundary
        FallbackComponent={() => <>Something went wrong</>}
        onError={(e) => console.error(e)}
      >
        <div ref={parentRef} className={cn("", className)}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </ErrorBoundary>
    );
  },
);

MoleculeViewer.displayName = "MoleculeViewer";
export type { MoleculeHighlight, MoleculePayload, MoleculeStyle };
export { MoleculeViewer };
