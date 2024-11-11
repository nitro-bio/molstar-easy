import { useEffect, useState } from "react";
import { MoleculePayload } from "./MoleculeViewer";

export const MoleculePayloadGenerator = ({
  setPayload,
}: {
  payload: MoleculePayload | null;
  setPayload: (payload: MoleculePayload | null) => void;
}) => {
  const [pdbId, setPdbId] = useState("1CRN");
  const [pdbString, setPdbString] = useState<string | null>(null);
  const [structureColor, setStructureColor] = useState("#94a3b8");
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
          structureHexColor: structureColor,
          highlights: [],
        });
      }
    },
    [pdbString, structureColor],
  );

  return (
    <div className="bg items-center justify-center gap-4 rounded-xl border px-2 py-1">
      <label className="flex flex-col gap-1">
        PDB ID:
        <input
          type="text"
          value={pdbId}
          onChange={(e) => setPdbId(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        Structure Color:
        <input
          type="color"
          value={structureColor}
          onChange={(e) => setStructureColor(e.target.value)}
        />
      </label>
    </div>
  );
};
