import { cn } from "@utils/stringUtils";
import { useDeferredValue, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { MoleculePayloadGenerator } from "./MoleculePayloadGenerator";
import { MoleculePayload, MoleculeViewer } from "./MoleculeViewer";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = ReactDOM.createRoot(rootElement);

const App = () => {
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
            "border-border flex items-center justify-center rounded border border-dashed px-4 py-2",
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
      </div>
    </div>
  );
};

root.render(<App />);
