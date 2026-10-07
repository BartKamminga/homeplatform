# Sentry / GlitchTip

- Call `await Sentry.flush(1500)` before a `window.location.href` redirect, otherwise events are lost.
- Make the minimum level configurable through an environment variable (e.g. `SENTRY_MIN_LEVEL`).
