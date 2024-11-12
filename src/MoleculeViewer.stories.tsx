import { useDeferredValue, useState } from "react";
import { MoleculePayloadGenerator } from "./MoleculePayloadGenerator";
import { MoleculePayload, MoleculeViewer } from "./MoleculeViewer";
import { cn } from "@utils/stringUtils";

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
      <div className="grid w-fit grid-cols-2 items-center justify-center gap-2 rounded-xl border px-4 py-2">
        <label className="flex flex-col text-sm">
          Background Color
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {payloads?.map((payload, index) => (
          <MoleculePayloadGenerator
            key={index}
            payload={payload}
            setPayload={(payload) => setPayload(index, payload)}
          />
        ))}
        <button
          className={cn(
            "flex items-center justify-center rounded border border-dashed border-zinc-600 px-4 py-2 font-black text-zinc-600",
            payloads.length % 2 == 0 ? "h-fit" : "w-fit",
          )}
          onClick={() =>
            setPayloads((prev) => (prev ? [...prev, null] : [null]))
          }
        >
          +
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
