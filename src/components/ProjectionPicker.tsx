import type { ProjectionKey } from "../lib/projections";
import { PROJECTION_LABELS } from "../lib/projections";

interface ProjectionPickerProps {
  value: ProjectionKey;
  onChange: (key: ProjectionKey) => void;
}

export function ProjectionPicker({ value, onChange }: ProjectionPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ProjectionKey)}
      className="px-2 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {(Object.keys(PROJECTION_LABELS) as ProjectionKey[]).map((key) => (
        <option key={key} value={key}>
          {PROJECTION_LABELS[key]}
        </option>
      ))}
    </select>
  );
}
