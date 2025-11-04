import { cn } from "@utils/stringUtils";
import "molstar/build/viewer/molstar.css";
import { memo, useEffect, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  useMolstarViewer,
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
  }: {
    moleculePayloads: (MoleculePayload | null)[];
    className?: string;
    backgroundHexColor?: string;
    defaultStructureHexColor?: string;
  }) => {
    const DEFAULT_STRUCTURE_COLOR = defaultStructureHexColor ?? "#94a3b8";
    const DEFAULT_BACKGROUND_COLOR = "#f4f4f4";

    const parentRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Use the new hook - store managed outside React
    const { ready, api } = useMolstarViewer("molecule-viewer");

    /* ───────────────── init once ───────────────── */
    useEffect(() => {
      if (!canvasRef.current || !parentRef.current) return;

      void api.init(canvasRef.current, parentRef.current, {
        background: backgroundHexColor ?? DEFAULT_BACKGROUND_COLOR,
        defaultColor: DEFAULT_STRUCTURE_COLOR,
      });

      return () => {
        api.unmountCanvas();
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
        // Find if any payload has custom colors
        const indexToColorMap =
          moleculePayloads.find((p) => p?.indexToColor)?.indexToColor ?? null;

        // Update theme first if needed
        await api.setCustomTheme(indexToColorMap, DEFAULT_STRUCTURE_COLOR);

        // Ensure structures are loaded (only rebuilds if content changed)
        await api.ensurePayloads(moleculePayloads, DEFAULT_STRUCTURE_COLOR);

        // Apply transforms imperatively (no rebuilds)
        await api.applyTransforms(moleculePayloads);

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
