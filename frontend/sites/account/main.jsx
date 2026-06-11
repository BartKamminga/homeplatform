import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@core/theme.css';
import InvitePage from './pages/InvitePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import ErrorBoundary from '@components/ErrorBoundary.jsx';
import { isLoggedIn } from '@core/auth.js';
import { trackEvent, loadTheme } from '@core/api.js';
import { initSentry } from '@core/sentry.js';

initSentry();
trackEvent('account', 'page.view', { path: window.location.pathname });
loadTheme();

function RequireAuth({ children }) {
  if (!isLoggedIn()) {
    window.location.href = '/landing/';
    return null;
  }
  return children;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary label="Account">
      <BrowserRouter>
        <Routes>
          <Route path="/account/invite/:token" element={<InvitePage />} />
          <Route path="/account/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/account/groups"  element={<RequireAuth><GroupsPage /></RequireAuth>} />
          <Route path="/account/*"       element={<Navigate to="profile" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
