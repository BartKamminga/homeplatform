import { adminStyles } from "../adminStyles.js";

export const SITES = ["alle", "platform", "landing", "admin", "account", "dontforget", "mixmusic", "nkhockey", "tournix", "fiets", "poulebord", "beatload"];
export const STATUSES = ["alle", "idea", "analyzed", "pick_up", "in_progress", "ready", "deploying", "done"];
export const PRIORITIES = ["alle", "high", "medium", "low"];
export const SCOPES = ["frontend", "backend", "beide", "infra", "database", "platform"];
export const STATUS_ORDER = ["deploying", "in_progress", "ready", "pick_up", "analyzed", "idea", "done"];

export const STATUS_CYCLE = { idea: "analyzed", analyzed: "pick_up", pick_up: "in_progress", in_progress: "ready", ready: "deploying", deploying: "done", done: "idea" };

export const STATUS_LABEL = { idea: "Idea", analyzed: "Analyzed", pick_up: "Pick up", in_progress: "In progress", ready: "Ready to deploy", deploying: "Deploying", done: "Done" };
export const STATUS_COLOR = {
  idea: "var(--color-text-muted)",
  analyzed: "#8b5cf6",
  pick_up: "#0ea5e9",
  in_progress: "var(--color-primary)",
  ready: "var(--color-warning)",
  deploying: "var(--color-danger)",
  done: "var(--color-success)",
};

export const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
export const PRIORITY_STYLE = {
  high:   { background: "var(--color-danger-light)",  color: "var(--color-danger)" },
  medium: { background: "var(--color-warning-light)", color: "var(--color-warning)" },
  low:    { background: "var(--color-surface-2)",     color: "var(--color-text-muted)" },
};

export const METER_VALUES = ["low", "medium", "high"];
export const METER_COLOR = { low: "var(--color-success)", medium: "var(--color-warning)", high: "var(--color-danger)" };

export const EMPTY_FORM = {
  title: "",
  description: "",
  site: "platform",
  priority: "medium",
  status: "idea",
  notes: "",
  version: "",
  impact: null,
  risk: null,
  scope: null,
};

export const s = {
  header: adminStyles.pageHeader,
  subtitle: adminStyles.pageSubtitle,
  filterBar: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  filterRow: { display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" },
  filterLabel: {
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--color-text-muted)",
    minWidth: "64px", flexShrink: 0,
  },
  filterBtn: (active) => ({
    padding: "4px 10px", fontSize: "12px", borderRadius: "99px", cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: active ? "var(--color-primary)" : "transparent",
    color: active ? "#fff" : "var(--color-text-muted)",
    fontWeight: active ? 600 : 400,
    transition: "background 0.1s, color 0.1s",
  }),
  btnPrimary: { ...adminStyles.btnPrimary, marginLeft: "auto" },
  card: { ...adminStyles.surfaceCard, marginBottom: "10px", overflow: "hidden" },
  cardBody: { padding: "14px 16px" },
  cardRow: { display: "flex", alignItems: "flex-start", gap: "10px" },
  badge: (style) => ({
    fontSize: "11px", padding: "2px 7px", borderRadius: "99px",
    fontWeight: 500, flexShrink: 0, ...style,
  }),
  statusDot: (status) => ({
    width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
    marginTop: "4px",
    background: STATUS_COLOR[status] || "var(--color-text-muted)",
    cursor: "pointer",
    border: "2px solid transparent",
    boxSizing: "border-box",
    transition: "box-shadow 0.15s",
  }),
  title: { fontWeight: 600, fontSize: "14px", flex: 1, lineHeight: 1.4 },
  desc: {
    fontSize: "12px", color: "var(--color-text-muted)", marginTop: "4px",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: "6px", flexShrink: 0, marginLeft: "auto" },
  iconBtn: {
    padding: "4px 8px", fontSize: "12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)", background: "transparent",
    color: "var(--color-text-muted)", cursor: "pointer",
  },
  dangerBtn: adminStyles.btnDanger,
  sectionLabel: adminStyles.sectionLabel,
  form: { ...adminStyles.surfaceCard, padding: "18px", marginBottom: "20px" },
  formGrid: { display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" },
  formGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  label: adminStyles.formLabel,
  input: adminStyles.formInput,
  textarea: { ...adminStyles.formInput, resize: "vertical", minHeight: "70px" },
  formActions: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "14px" },
  btnSecondary: adminStyles.btnSecondary,
};
