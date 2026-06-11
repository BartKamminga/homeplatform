import { useGroups } from "@core/useGroups.js";

export default function GroupSwitcher({ compact = false }) {
  const { groups, active, setActiveGroup } = useGroups();

  if (groups.length <= 1) return null;

  return (
    <select
      value={active || ""}
      onChange={(e) => setActiveGroup(e.target.value)}
      style={{
        background: "transparent",
        border: "1px solid var(--color-border, var(--border, #e0e0e0))",
        color: "var(--color-text, var(--text, #1a1a1a))",
        borderRadius: 6,
        padding: "5px 8px",
        fontSize: 13,
        cursor: "pointer",
        width: compact ? "auto" : "100%",
      }}
    >
      <option value="">Persoonlijk</option>
      {groups.map((slug) => (
        <option key={slug} value={slug}>{slug}</option>
      ))}
    </select>
  );
}
