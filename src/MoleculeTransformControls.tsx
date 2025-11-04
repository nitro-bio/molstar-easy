import { ModelTransform } from "./hooks/useMolstarViewer";

export const MoleculeTransformControls = ({
  transform,
  setTransform,
}: {
  transform: ModelTransform | null;
  setTransform: (transform: ModelTransform | null) => void;
}) => {
  const currentTransform = transform ?? {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };

  const updatePosition = (axis: "x" | "y" | "z", value: number) => {
    setTransform({
      ...currentTransform,
      position: { ...currentTransform.position, [axis]: value },
    });
  };

  const updateRotation = (axis: "x" | "y" | "z", value: number) => {
    setTransform({
      ...currentTransform,
      rotation: { ...currentTransform.rotation, [axis]: value },
    });
  };

  const resetTransform = () => {
    setTransform({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    });
  };

  return (
    <div className="grid grid-cols-3 items-center justify-center gap-2 rounded-xl border px-4 py-2">
      <div className="col-span-3 flex items-center justify-between">
        <label className="text-sm text-zinc-600">Transform</label>
        <button
          onClick={resetTransform}
          className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
        >
          Reset
        </button>
      </div>

      {/* Position Section */}
      <label className="col-span-3 mt-2 border-t pt-2 text-xs text-zinc-500">
        Position
      </label>
      <label className="flex flex-col text-xs">
        X:
        <input
          type="number"
          className="rounded-md text-xs"
          step="0.1"
          value={currentTransform.position.x}
          onChange={(e) => updatePosition("x", parseFloat(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Y:
        <input
          type="number"
          className="rounded-md text-xs"
          step="0.1"
          value={currentTransform.position.y}
          onChange={(e) => updatePosition("y", parseFloat(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Z:
        <input
          type="number"
          className="rounded-md text-xs"
          step="0.1"
          value={currentTransform.position.z}
          onChange={(e) => updatePosition("z", parseFloat(e.target.value))}
        />
      </label>

      {/* Rotation Section */}
      <label className="col-span-3 mt-2 border-t pt-2 text-xs text-zinc-500">
        Rotation (degrees)
      </label>
      <label className="flex flex-col text-xs">
        X:
        <input
          type="number"
          className="rounded-md text-xs"
          step="1"
          value={currentTransform.rotation.x}
          onChange={(e) => updateRotation("x", parseFloat(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Y:
        <input
          type="number"
          className="rounded-md text-xs"
          step="1"
          value={currentTransform.rotation.y}
          onChange={(e) => updateRotation("y", parseFloat(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Z:
        <input
          type="number"
          className="rounded-md text-xs"
          step="1"
          value={currentTransform.rotation.z}
          onChange={(e) => updateRotation("z", parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
};
