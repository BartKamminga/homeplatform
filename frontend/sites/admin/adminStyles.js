export const adminStyles = {
  pageHeader: { fontSize: "22px", fontWeight: 600, marginBottom: "6px" },
  pageSubtitle: { color: "var(--color-text-muted)", marginBottom: "24px", fontSize: "13px" },

  errorBanner: {
    padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: "16px",
    background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "13px",
  },

  surfaceCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
  },

  sectionLabel: {
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: "var(--color-text-light)",
    marginBottom: "8px", marginTop: "20px",
  },

  codeTag: {
    fontFamily: "var(--font-mono)", fontSize: "12px",
    background: "var(--color-surface)", padding: "2px 6px",
    borderRadius: "var(--radius-sm)",
  },

  formInput: {
    padding: "7px 10px", fontSize: "13px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)", background: "var(--color-background)",
    color: "var(--color-text)", width: "100%", boxSizing: "border-box",
  },

  formLabel: { fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)" },

  btnPrimary: {
    padding: "7px 14px", fontSize: "13px", fontWeight: 600,
    borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
    background: "var(--color-primary)", color: "#fff",
  },

  btnSecondary: {
    padding: "7px 14px", fontSize: "13px", fontWeight: 500,
    borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)",
    background: "transparent", color: "var(--color-text)", cursor: "pointer",
  },

  btnDanger: {
    padding: "4px 8px", fontSize: "12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-danger)", background: "transparent",
    color: "var(--color-danger)", cursor: "pointer",
  },
};
