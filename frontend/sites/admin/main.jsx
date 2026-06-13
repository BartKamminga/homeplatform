import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@core/theme.css";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Users from "./pages/Users.jsx";
import Groups from "./pages/Groups.jsx";
import Themes from "./pages/Themes.jsx";
import Sites from "./pages/Sites.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import Changelog from "./pages/Changelog.jsx";
import System from "./pages/System.jsx";
import ApiStats from "./pages/ApiStats.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Todo from "./pages/Todo.jsx";
import Roadmap from "./pages/Roadmap.jsx";
import Backup from "./pages/Backup.jsx";
import DataStorage from "./pages/DataStorage.jsx";
import ErrorBoundary from "@components/ErrorBoundary.jsx";
import { isLoggedIn } from "@core/auth.js";
import { trackEvent } from "@core/api.js";
import { initSentry } from "@core/sentry.js";

initSentry();
trackEvent("admin", "page.view", { path: window.location.pathname });

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/admin/login" replace />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary label="Admin">
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <PrivateRoute>
              <Routes>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="users" element={<Users />} />
                <Route path="groups" element={<Groups />} />
                <Route path="themes" element={<Themes />} />
                <Route path="sites" element={<Sites />} />
                <Route path="audit-log" element={<AuditLog />} />
                <Route path="changelog" element={<Changelog />} />
                <Route path="system" element={<System />} />
                <Route path="api-stats" element={<ApiStats />} />
                <Route path="monitoring" element={<Monitoring />} />
                <Route path="backup" element={<Backup />} />
                <Route path="todo" element={<Todo />} />
                <Route path="roadmap" element={<Roadmap />} />
                <Route path="data-storage" element={<DataStorage />} />
              </Routes>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
