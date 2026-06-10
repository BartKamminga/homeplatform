import * as Sentry from "@sentry/react";

const LEVEL_ORDER = { debug: 0, info: 1, warning: 2, warn: 2, error: 3, fatal: 4 };

export function initSentry() {
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      if (!cfg.sentry_dsn) return;
      const minLevel = cfg.sentry_min_level || "warning";
      Sentry.init({
        dsn: cfg.sentry_dsn,
        environment: cfg.environment,
        tracesSampleRate: 0,
        autoSessionTracking: false,
        integrations: [
          Sentry.captureConsoleIntegration({ levels: ["error", "warn"] }),
        ],
        beforeSend(event) {
          const lvl = event.level || "error";
          if ((LEVEL_ORDER[lvl] ?? 3) < (LEVEL_ORDER[minLevel] ?? 2)) return null;
          return event;
        },
      });
    })
    .catch(() => {});
}

export function reportError(error, context = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setTag(k, String(v)));
    Sentry.captureException(error);
  });
}

export function reportMessage(message, level = "warning", context = {}) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setTag(k, String(v)));
    Sentry.captureMessage(message, level);
  });
}
