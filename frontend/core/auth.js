// frontend/core/auth.js

import { clearToken, api } from './api.js';

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('hp_user') || 'null');
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return !!localStorage.getItem('hp_token');
}

export async function logout() {
  try {
    await api.post('/api/auth/logout');
  } finally {
    clearToken();
    window.location.href = '/admin/login';
  }
}

export async function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/admin/login';
    return null;
  }
  return getCurrentUser();
}
