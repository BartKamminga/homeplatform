---
name: roadmap-workflow
description: Status flow of HomePlatform roadmap items (analyzed, in_progress, ready, on_acc, deploying, done), keeping notes and closing items with a version, changelog, git tag and GitHub Release. Use when picking up, updating or closing a roadmap item.
---
# Roadmap workflow

## Per item
1. Analyse → status `analyzed`: fill in `impact` (on the user), `risk` and `scope`, and store the reasoning in the `notes` field.
   - **High items: always analyse before you start.**
2. (Optional) The user marks the item `pick_up` — explicit priority for the next session.
3. Start → status `in_progress`.
4. While working → keep notes in the `notes` field (they go to the changelog later).
5. Code ready, not deployed yet → status `ready`.
6. Deployed to acceptance, not to production yet → status `on_acc`.
7. Production deploy started → status `deploying`.
8. After a successful production deploy → status `done` + version number → a changelog entry is created automatically.

## Closing
- Version number unclear: ask the user first (see the versioning rules).
- Several items in the same deploy: one command, `.\roadmap.ps1 -Close -Ids "534,535,536" -Version v3.33`.
- `.\roadmap.ps1 -Close -Ids "..." -Version v4.1`:
  1. closes the items and creates the changelog
  2. creates and pushes git tag `v4.1`
  3. creates GitHub Release `v4.1` with release notes per site

## Database
- Manual alembic migrations for the changelog are no longer needed for items that go through the roadmap.
- Infrastructure changes to the database (new tables, columns) still require an alembic migration.
