import { useDeferredValue, useState } from "react";
import { MoleculePayloadGenerator } from "./MoleculePayloadGenerator";
import { MoleculePayload, MoleculeViewer } from "./MoleculeViewer";

export default {
  title: "MoleculeViewer",
  component: MoleculeViewer,
};

export const Demo = () => {
  const [backgroundColor, setBackgroundColor] = useState("#f1f1f1");
  const deferredBackgroundColor = useDeferredValue(backgroundColor);
  const [payloads, setPayloads] = useState<(MoleculePayload | null)[]>([null]);
  const setPayload = (index: number, payload: MoleculePayload | null) => {
    setPayloads((prev) => {
      const next = prev ? [...prev] : [];
      next[index] = payload;
      return next;
    });
  };
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex gap-4">
        <label>
          Background Color:
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-4">
        {payloads?.map((payload, index) => (
          <MoleculePayloadGenerator
            key={index}
            payload={payload}
            setPayload={(payload) => setPayload(index, payload)}
          />
        ))}
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={() =>
            setPayloads((prev) => (prev ? [...prev, null] : [null]))
          }
        >
          Add Molecule
        </button>
      </div>
      <div className="">
        <MoleculeViewer
          className=""
          backgroundHexColor={deferredBackgroundColor}
          moleculePayloads={payloads}
        />
      </div>{" "}
    </div>
  );
};
