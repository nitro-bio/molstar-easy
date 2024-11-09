import { cn } from "@utils/stringUtils";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MoleculeViewer, MoleculeHighlight } from "./MoleculeViewer";

export default {
  title: "MoleculeViewer",
};

export const WithHiglights = () => {
  const highlights = [
    {
      // red
      label: { text: "Red Annotation", hexColor: "#881337", scale: 1 },
      start: 14,
      end: 30,
    },
    {
      // green
      label: { text: "Green Annotation", hexColor: "#16a34a", scale: 0.5 },
      start: 0,
      end: 10,
    },
  ];
  const [currentHighlightType, setCurrentHighlightType] = useState<
    "red" | "green"
  >("red");
  const [backgroundColor, setBackgroundColor] = useState("#f4f4f4");
  const [structureColor, setStructureColor] = useState("#94a3b8");
  const deferredBackgroundColor = useDeferredValue(backgroundColor);
  const deferredStructureColor = useDeferredValue(structureColor);
  const currentHighlights: [MoleculeHighlight] = useMemo(
    () => (currentHighlightType === "red" ? [highlights[0]] : [highlights[1]]),
    [currentHighlightType],
  );
  const pdbUrl = "https://files.rcsb.org/download/1CRN.pdb";
  const [pdbStr, setPdbStr] = useState<string | null>(null);
  useEffect(
    function fetchPDB() {
      fetch(pdbUrl)
        .then((res) => res.text())
        .then((pdbStr) => setPdbStr(pdbStr));
    },
    [pdbUrl],
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <button
        className={cn("w-fit rounded-md bg-zinc-400 px-4 py-2 text-white")}
        onClick={() =>
          setCurrentHighlightType((prev) => (prev === "red" ? "green" : "red"))
        }
      >
        {currentHighlightType === "red" ? "Show Green" : "Show Red"}
      </button>
      <div className="flex gap-4">
        <label>
          Background Color:
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
          />
        </label>
        <label>
          Structure Color:
          <input
            type="color"
            value={structureColor}
            onChange={(e) => setStructureColor(e.target.value)}
          />
        </label>
      </div>

      {pdbStr && (
        <MoleculeViewer
          className="min-h-80 overflow-hidden rounded-xl border-2 border-dashed border-zinc-500"
          backgroundHexColor={deferredBackgroundColor}
          structureHexColor={deferredStructureColor}
          pdbStr={pdbStr}
          highlights={currentHighlights}
        />
      )}
    </div>
  );
};
