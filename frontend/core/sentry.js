import * as Sentry from "@sentry/react";

export function initSentry() {
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      if (cfg.sentry_dsn) {
        Sentry.init({
          dsn: cfg.sentry_dsn,
          environment: cfg.environment,
          tracesSampleRate: 0.1,
        });
      }
    })
    .catch(() => {});
}
