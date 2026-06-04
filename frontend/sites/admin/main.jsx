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
import { isLoggedIn } from "@core/auth.js";
import { trackEvent } from "@core/api.js";

trackEvent(__SITE__, "page.view", "path" + window.location.pathname);

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/admin/login" replace />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
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
              </Routes>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
