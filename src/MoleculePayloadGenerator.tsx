import { useEffect, useState } from "react";
import { MoleculeHighlight, MoleculePayload } from "./MoleculeViewer";

export const MoleculePayloadGenerator = ({
  setPayload,
}: {
  payload: MoleculePayload | null;
  setPayload: (payload: MoleculePayload | null) => void;
}) => {
  const [pdbId, setPdbId] = useState("1CRN");
  const [pdbString, setPdbString] = useState<string | null>(null);
  const [structureColor, setStructureColor] = useState("#94a3b8");
  const [highlight, setHighlight] = useState<MoleculeHighlight>({
    start: 0,
    end: 10,
    label: {
      text: "Red Annotation",
      hexColor: "#881337",
      scale: 1,
    },
  });
  useEffect(
    function fetchPDB() {
      fetch(`https://files.rcsb.org/download/${pdbId}.pdb`).then(
        async (response) => {
          const pdbString = await response.text();
          setPdbString(pdbString);
        },
      );
    },
    [pdbId],
  );
  useEffect(
    function updatePayload() {
      if (!pdbString) {
        setPayload(null);
      } else {
        setPayload({
          pdbString,
          indexToColor: new Map(
            Array.from({ length: 1000 }, (_, i) => [i, structureColor]),
          ),
          highlights: highlight ? [highlight] : undefined,
        });
      }
    },
    [pdbString, structureColor, highlight],
  );

  return (
    <div className="grid grid-cols-2 items-center justify-center gap-2 rounded-xl border px-4 py-2">
      <label className="col-span-2 text-sm text-zinc-600">Protein</label>
      <label className="flex flex-col text-xs">
        PDB ID:
        <input
          type="text"
          className="rounded-md text-xs"
          value={pdbId}
          onChange={(e) => setPdbId(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs">
        Structure Color:
        <input
          type="color"
          value={structureColor}
          onChange={(e) => setStructureColor(e.target.value)}
        />
      </label>
      <label className="col-span-2 mt-2 border-t pt-4 text-sm text-zinc-600">
        Highlight
      </label>
      <label className="flex flex-col text-xs">
        Highlight Start:
        <input
          type="number"
          className="rounded-md text-xs"
          step="1"
          value={highlight.start}
          onChange={(e) =>
            setHighlight({ ...highlight, start: parseInt(e.target.value) })
          }
        />
      </label>
      <label className="flex flex-col text-xs">
        Highlight End:
        <input
          type="number"
          className="rounded-md text-xs"
          value={highlight.end}
          step="1"
          onChange={(e) =>
            setHighlight({ ...highlight, end: parseInt(e.target.value) })
          }
        />
      </label>

      <label className="flex flex-col text-xs">
        Highlight Label:
        <input
          type="text"
          className="rounded-md text-xs"
          value={highlight.label.text}
          onChange={(e) =>
            setHighlight({
              ...highlight,
              label: { ...highlight.label, text: e.target.value },
            })
          }
        />
      </label>
      <label className="flex flex-col text-xs">
        Highlight Color:
        <input
          type="color"
          value={highlight.label.hexColor}
          onChange={(e) =>
            setHighlight({
              ...highlight,
              label: {
                ...highlight.label,
                hexColor: e.target.value,
              },
            })
          }
        />
      </label>
    </div>
  );
};
