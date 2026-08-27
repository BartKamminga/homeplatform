// Gedeelde horizontale instellingen-rij (item 848): icoon/label links, vrije
// content rechts, onderrand. Was letterlijk gekopieerd in admin/System.jsx en
// fiets/InstellingenPage.jsx (los ontwikkeld, andere props maar dezelfde
// flex-rij-met-onderrand-vorm). account/ProfilePage.jsx's Row (label BOVEN
// children, verticaal) en dontforget/SettingsPage.jsx's Row (icoon-cirkel,
// eigen mobiele-app-theming) zijn bewust NIET hierop overgezet - andere vorm
// resp. andere visuele taal, geen echte duplicatie met dit patroon.
export default function SettingsRow({ icon, label, end, mono, last, style }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
      borderBottom: last ? "none" : "1px solid var(--color-border)",
      ...style,
    }}>
      {icon && <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, fontSize: 13, color: "var(--color-text-muted)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, fontFamily: mono ? "var(--font-mono)" : undefined }}>
        {end}
      </div>
    </div>
  );
}
