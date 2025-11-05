import { ModelTransform } from "./hooks/useMolstarViewer";

// Helper to safely parse numbers and prevent NaN
const toNum = (value: string, fallback = 0): number => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
          value={
            Number.isFinite(currentTransform.position.x)
              ? currentTransform.position.x
              : 0
          }
          onChange={(e) => updatePosition("x", toNum(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Y:
        <input
          type="number"
          className="rounded-md text-xs"
          step="0.1"
          value={
            Number.isFinite(currentTransform.position.y)
              ? currentTransform.position.y
              : 0
          }
          onChange={(e) => updatePosition("y", toNum(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Z:
        <input
          type="number"
          className="rounded-md text-xs"
          step="0.1"
          value={
            Number.isFinite(currentTransform.position.z)
              ? currentTransform.position.z
              : 0
          }
          onChange={(e) => updatePosition("z", toNum(e.target.value))}
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
          value={
            Number.isFinite(currentTransform.rotation.x)
              ? currentTransform.rotation.x
              : 0
          }
          onChange={(e) => updateRotation("x", toNum(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Y:
        <input
          type="number"
          className="rounded-md text-xs"
          step="1"
          value={
            Number.isFinite(currentTransform.rotation.y)
              ? currentTransform.rotation.y
              : 0
          }
          onChange={(e) => updateRotation("y", toNum(e.target.value))}
        />
      </label>
      <label className="flex flex-col text-xs">
        Z:
        <input
          type="number"
          className="rounded-md text-xs"
          step="1"
          value={
            Number.isFinite(currentTransform.rotation.z)
              ? currentTransform.rotation.z
              : 0
          }
          onChange={(e) => updateRotation("z", toNum(e.target.value))}
        />
      </label>
    </div>
  );
};
