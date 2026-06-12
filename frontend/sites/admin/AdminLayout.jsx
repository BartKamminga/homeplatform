// frontend/sites/admin/AdminLayout.jsx
import BaseLayout from "@core/BaseLayout.jsx";

const NAV = [
  { to: "/admin/dashboard", icon: "◈", label: "Dashboard" },
  { to: "/admin/users", icon: "◉", label: "Gebruikers" },
  { to: "/admin/groups", icon: "◎", label: "Groepen" },
  { to: "/admin/themes", icon: "◐", label: "Thema's" },
  { to: "/admin/sites", icon: "◫", label: "Sites" },
  { to: "/admin/audit-log", icon: "◳", label: "Audit log" },
  { to: "/admin/changelog", icon: "◷", label: "Changelog" },
  { to: "/admin/system", icon: "⚙", label: "Systeem" },
  { to: "/admin/api-stats", icon: "▤", label: "API stats" },
  { to: "/admin/monitoring", icon: "🔗", label: "Beheer & links" },
  { to: "/admin/backup", icon: "🗄", label: "Backup" },
  { to: "/admin/todo", icon: "☑", label: "Todo" },
  { to: "/admin/roadmap", icon: "◈", label: "Roadmap" },
];

export default function AdminLayout({ children }) {
  return (
    <BaseLayout navItems={NAV} siteTitle="Admin">
      {children}
    </BaseLayout>
  );
}
