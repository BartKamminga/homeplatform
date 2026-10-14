"""What HomePlatform already has, as Keelson systems, elements and links (item 1340).

No secret values here: secrets and keys are registered by name and location only.
Statuses: present (exists and is in use), partial (exists but scattered or incomplete), missing.
"""

# (key, name, kind, status, description, extra meta)
SYSTEMS = [
    ("platform", "HomePlatform", "platform", "active", "Shared platform: backend, sites, deploy pipeline and servers.",
     {"roadmap_sites": ["platform", "infra", "homeplatform"], "changelog_sites": ["core", "platform"]}),
    ("admin", "Admin", "product", "active", "Platform administration: users, sites, infrastructure, roadmap.", {"path": "/admin/"}),
    ("account", "Account", "product", "active", "Sign-in, invitations and personal settings.", {"path": "/account/"}),
    ("landing", "Landing", "product", "active", "Public entry page of webheaven.nl.", {"path": "/"}),
    ("hockey-inside", "Hockey Inside", "product", "active", "Hockey competition data, scans and analysis.", {"path": "/hockey-inside/"}),
    ("poulebord", "Poulebord", "product", "active", "Pool boards for parents, coaches and coordinators.", {"path": "/poulebord/"}),
    ("yearof-mo14", "MO14 à Paris", "product", "active", "Supporters site and studio for the MO14 team trip.", {"path": "/yearof/"}),
    ("fiets", "Fiets", "product", "active", "Cycling app with classic and arcade frontends.", {"path": "/fiets/"}),
    ("vbt", "VBT", "product", "active", "Virtual bike trainer.", {"path": "/vbt/"}),
    ("myhome", "MyHome", "product", "active", "Digital twin of the house, towards Home Assistant.", {"path": "/myhome/"}),
    ("beatcrades", "BeatCrades", "product", "active", "Music collection and DJ crates.", {"path": "/beatcrades/"}),
    ("mixmusic", "Mix Music", "product", "active", "Music mixes and downloads.", {"path": "/mixmusic/"}),
    ("dontforget", "DontForget", "product", "active", "Notes and reminders with voice input.", {"path": "/dontforget/"}),
    ("mindbox", "Mindbox", "product", "active", "Cases, commands and deadlines for agent sessions.", {"path": "/mindbox/"}),
    ("agent-control", "Agent Control", "product", "active", "Agent contexts, tasks and dev sessions.", {"path": "/agent-control/"}),
    ("keelson", "Keelson", "product", "active", "This app: every dimension of building and running systems.", {"path": "/keelson/"}),
    ("tournix", "Tournix", "product", "archived", "Tournament management, archived after item 1269.", {"path": "/tournix/"}),
    ("nkhockey", "NK Hockey", "product", "archived", "Hockey championship site, archived after item 1269.", {"path": "/nkhockey/"}),
    ("scrapster", "Scrapster", "product", "archived", "World Cup scraper and team codes, archived after item 1269.", {"path": "/scrapster/"}),
    ("railvane", "Railvane", "tool", "active", "Guardrails manager in its own repository.", {"repo": "C:/Projects/railvane"}),
    ("pixelcrawl", "Pixelcrawl", "product", "planned", "Game learning project: roguelike crawler.", {"repo": "C:/Projects/games/pixelcrawl"}),
]

_SECRETS = ["SECRET_KEY", "JWT_PRIVATE_KEY_B64", "OIDC_GOOGLE_CLIENT_SECRET", "OIDC_MICROSOFT_CLIENT_SECRET",
            "STRAVA_CLIENT_SECRET", "VAPID_PRIVATE_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "INFRA_PEER_TOKEN"]
_CONFIG = ["DATABASE_URL", "EXTERNAL_URL", "SENTRY_DSN","PROD_LAN_IP", "ACC_LAN_IP", "NAS_URL",
           "OIDC_GOOGLE_CLIENT_ID", "OIDC_MICROSOFT_CLIENT_ID", "OIDC_REDIRECT_BASE", "STRAVA_CLIENT_ID",
           "VAPID_PUBLIC_KEY", "VAPID_SUBJECT", "MUSIC_DIR", "DOWNLOAD_DIR", "WORKER_POLL_IDLE_SEC",
           "DEV_SESSION_REPO_URL", "DEV_SESSION_MEMORY_MB", "DEV_SESSION_MAX_CONCURRENT_GIT", "IMAGE_TAG"]

_GUARDRAILS = [("deploy-safety", "Never deploy without an explicit order; develop first, wait for a production go."),
               ("language", "Code and UI in English; project management in Dutch."), ("semver", "MAJOR.MINOR.PATCH rules."),
               ("file-size", "Flag files over 300 lines."), ("powershell", "PowerShell 5.1 quirks."),
               ("python", "pip via python -m, Alembic rules."), ("sentry", "Flush before redirect, configurable minimum level."),
               ("roadmap", "The roadmap API is the backlog."), ("deploy", "Deploy order and IMAGE_TAG."),
               ("project", "Project layout and local development."), ("servers", "g5 production, G4 acceptance and management.")]

_DOCS = ["cutover-g4-g5.md", "myhome-onderzoek.md", "myhome-plan-inregelen.md", "vbt-join-onderzoek.md",
         "yearof-mo14-overzicht-en-refactorplan.md", "scripts/README.md"]

# (key, kind, name, status, description, attributes)
PLATFORM_ELEMENTS = [
    ("product", "Product", "HomePlatform", "present", "One platform hosting all personal apps and sites.", {"url": "https://webheaven.nl"}),
    ("roadmap", "RoadmapItem", "Roadmap backlog", "present", "Central backlog in roadmap_items, managed through roadmap.ps1 and /api/roadmap.", None),
    ("feature-grouping", "Feature", "Features above items", "missing", "Items are not yet grouped into features or epics.", None),
    ("accounts", "User", "Accounts and invitations", "present", "Users, groups, site access, invitations, Google and Microsoft sign-in.", None),
    ("tracking", "UsageMetric", "Tracking events", "partial", "trackEvent page views per site; no dashboard per feature yet.", None),
    ("bug-reports", "Feedback", "Bug reports", "partial", "In-app bug reports; no general feedback channel.", None),
    ("theme", "DesignToken", "Platform theme", "present", "frontend/core/theme.css plus themes per site.", {"path": "frontend/core/theme.css"}),
    ("backend-app", "Component", "Backend (FastAPI)", "present", "FastAPI + SQLModel backend with routers per site.", {"path": "backend/"}),
    ("frontend-app", "Component", "Frontend (Vite MPA)", "present", "One Vite multi-page app with a folder per site.", {"path": "frontend/sites/"}),
    ("openapi", "ApiEndpoint", "OpenAPI contract", "partial", "Generated by FastAPI; no versioning policy yet.", {"path": "/docs"}),
    ("alembic", "Table", "Alembic migration chain", "present", "SQLite schema with Alembic migrations and has-table checks.", {"path": "backend/alembic/versions"}),
    ("repo", "Repository", "homeplatform", "present", "Monorepo on GitHub.", {"url": "https://github.com/BartKamminga/homeplatform"}),
    ("branch-develop", "Branch", "develop", "present", "Integration branch, deploys to acceptance.", None),
    ("branch-main", "Branch", "main", "present", "Release branch, deploys to production.", None),
    ("pytest", "TestCase", "Backend test suite", "partial", "pytest suite in backend/tests; frontend has no tests.", {"path": "backend/tests"}),
    ("acc-check", "AcceptanceCheck", "Acceptance check on G4", "present", "Manual check on port 8081 before the production go.", None),
    ("pipeline-deploy", "Pipeline", "deploy.yml", "present", "develop to acceptance, main to production.", {"path": ".github/workflows/deploy.yml"}),
    ("pipeline-snapshot", "Pipeline", "db-snapshot.yml", "present", "Scheduled database snapshot.", {"path": ".github/workflows/db-snapshot.yml"}),
    ("pipeline-loadtest", "Pipeline", "Load tests on acceptance", "present", "Load test workflows against acceptance.", {"path": ".github/workflows"}),
    ("images", "Artifact", "GHCR images", "present", "Images built on G4, pushed to GHCR, tagged with the short commit hash.", None),
    ("semver", "Version", "Semantic versioning", "present", "MAJOR.MINOR.PATCH, set when closing roadmap items.", None),
    ("changelog", "ChangelogEntry", "Changelog", "present", "changelog table, filled by roadmap.ps1 -Close.", None),
    ("releases", "Release", "Git tags and GitHub Releases", "present", "Tagged on origin/main when an item closes.", None),
    ("deploys", "Deployment", "Deployments", "partial", "Run by GitHub Actions; not registered as records.", None),
    ("feature-flags", "FeatureFlag", "Feature flags", "present", "Feature flags managed in the admin studio.", None),
    ("env-dev", "Environment", "Development", "present", "Local machine, Vite dev server and local SQLite.", None),
    ("env-acc", "Environment", "Acceptance", "present", "G4, port 8081, built locally from develop.", {"port": 8081}),
    ("env-prod", "Environment", "Production", "present", "g5, port 8080, webheaven.nl through a Cloudflare tunnel.", {"port": 8080}),
    ("host-g5", "Host", "g5", "present", "Production server.", {"ip": "192.168.30.49", "repo": "/home/bart/homeplatform-repo"}),
    ("host-g4", "Host", "G4", "present", "Acceptance and management server; builds the production images.", {"ip": "192.168.30.232"}),
    ("host-nas", "Host", "NAS", "present", "File storage for music and backups.", None),
    ("svc-caddy", "Service", "caddy", "present", "Web server and reverse proxy, part of the homeplatform-web image.", None),
    ("svc-backend", "Service", "backend", "present", "FastAPI backend container.", None),
    ("svc-ghost", "Service", "ghost", "present", "Ghost container.", None),
    ("svc-agent-worker", "Service", "agent_worker", "present", "Background worker for agent tasks.", None),
    ("svc-cloudflared", "Service", "cloudflared", "present", "Cloudflare tunnel for production.", None),
    ("svc-bugsink", "Service", "bugsink", "present", "Error tracking on G4, port 8090.", {"port": 8090}),
    ("svc-portainer", "Service", "Portainer", "present", "Container management on G4, port 9000.", {"port": 9000}),
    ("svc-cockpit", "Service", "Cockpit", "present", "Server management on G4, port 9091.", {"port": 9091}),
    ("db-prod", "Database", "Production database", "present", "SQLite in /home/bart/homeplatform/db on g5.", None),
    ("db-acc", "Database", "Acceptance database", "present", "SQLite in /home/bart/homeplatform-acc on G4.", None),
    ("backup-nightly", "Backup", "Nightly backup", "present", "scripts/backup-homeplatform.sh.", {"path": "scripts/backup-homeplatform.sh"}),
    ("backup-predeploy", "Backup", "Pre-deploy snapshot", "present", "db/backups/pre-deploy-* before every production deploy.", {"path": "scripts/db-snapshot-predeploy.sh"}),
    ("backup-files", "Backup", "File backup", "present", "Uploads and NAS files.", {"path": "scripts/backup-files.sh"}),
    ("restore", "Backup", "Restore script", "partial", "scripts/restore-homeplatform.sh; restore tests are not scheduled.", {"path": "scripts/restore-homeplatform.sh"}),
    ("domain-webheaven", "Domain", "webheaven.nl", "present", "Through the Cloudflare tunnel to Caddy on g5.", None),
    ("domain-mo14", "Domain", "mo14.webheaven.nl", "present", "Sponsordeck on G4, port 8082.", None),
    ("capacity", "Capacity", "Disk and memory", "partial", "Visible in Cockpit and the admin infrastructure page; no growth tracking.", None),
    ("errors", "ErrorEvent", "Bugsink", "present", "Sentry SDK in frontend and backend, events to Bugsink.", None),
    ("watcher", "HealthCheck", "services-watcher", "present", "Host script that restarts services.", {"path": "scripts/services-watcher.sh"}),
    ("logs", "LogStream", "Container logs", "partial", "docker logs per container; not central.", None),
    ("metrics", "Metric", "Host metrics", "partial", "Admin infrastructure overview and Cockpit.", None),
    ("runbook-caddy", "Runbook", "Caddy reset", "present", "Reset Caddy on production after a crash.", None),
    ("roles", "Role", "Groups and site access", "present", "Admin group, require_admin, site access per group.", None),
    ("api-keys", "ApiKey", "Personal API keys", "present", "hp_ keys per user, revocable.", None),
    ("audit", "AuditEntry", "audit_log", "present", "Audit log per site.", None),
    ("data-register", "DataRecord", "Data storage page", "partial", "Admin page listing stored data per table.", None),
    ("ssh", "AccessGrant", "SSH key homeplatform", "present", "One key for g5 and G4.", None),
    ("vpn", "AccessGrant", "UniFi Teleport VPN", "present", "Home network access from outside.", None),
    ("deploy-grants", "AccessGrant", "External deploy grants", "present", "SSH keys that may deploy other repositories on G4.", None),
    ("member-bart", "Member", "Bart", "present", "Owner, developer and operator of the platform.", None),
    ("role-owner", "JobRole", "Product owner", "present", "Decides priorities and gives production go's.", None),
    ("role-dev", "JobRole", "Developer", "present", "Builds and tests changes.", None),
    ("role-ops", "JobRole", "Operator", "present", "Keeps servers, backups and deploys running.", None),
    ("agent-claude", "Agent", "Claude Code", "present", "Pair programmer in VS Code and dev-session containers.", None),
    ("sessions", "Session", "MindBox cases", "partial", "Cases with events per session; not tied to time spent.", None),
    ("doc-claude-md", "Doc", "CLAUDE.md", "present", "Project agreements for agents.", {"path": "CLAUDE.md"}),
    ("playbook-roadmap", "Playbook", "roadmap-workflow", "present", "Status flow and closing items with a version.", None),
    ("playbook-caddy", "Playbook", "caddy-reset", "present", "Reset Caddy on production.", None),
    ("sub-github", "Subscription", "GitHub", "partial", "Repository, Actions and GHCR. Cost not recorded.", None),
    ("sub-cloudflare", "Subscription", "Cloudflare", "partial", "DNS and tunnel. Cost not recorded.", None),
    ("sub-claude", "Subscription", "Claude", "partial", "Claude Code and agents. Cost not recorded.", None),
    ("asset-g5", "Asset", "g5 hardware", "partial", "Production machine. Purchase data not recorded.", None),
    ("asset-g4", "Asset", "G4 hardware", "partial", "Acceptance machine. Purchase data not recorded.", None),
    ("asset-nas", "Asset", "NAS hardware", "partial", "Storage. Purchase data not recorded.", None),
]
PLATFORM_ELEMENTS += [(f"var-{n.lower()}", "ConfigVar", n, "present", "Set through .env and docker-compose.base.yml.", None) for n in _CONFIG]
PLATFORM_ELEMENTS += [(f"secret-{n.lower()}", "Secret", n, "partial", "Stored in .env on the server; no rotation date recorded.", None) for n in _SECRETS]
PLATFORM_ELEMENTS += [(f"guardrail-{k}", "Guardrail", k, "present", d, {"path": f".claude/guardrails/{k}.md"}) for k, d in _GUARDRAILS]
PLATFORM_ELEMENTS += [(f"doc-{n.split('/')[-1].split('.')[0]}", "Doc", n, "present", "Document in the repository.", {"path": n if "/" in n else f"docs/{n}"}) for n in _DOCS]

# (from key, to key, verb) inside the platform system
PLATFORM_LINKS = [
    ("roadmap", "product", "belongs to"), ("theme", "frontend-app", "styles"),
    ("backend-app", "svc-backend", "runs as"), ("frontend-app", "svc-caddy", "runs as"), ("openapi", "backend-app", "is served by"),
    ("alembic", "db-prod", "is stored in"), ("branch-develop", "repo", "belongs to"), ("branch-main", "repo", "belongs to"),
    ("pipeline-deploy", "repo", "runs for"), ("pipeline-snapshot", "repo", "runs for"), ("pipeline-loadtest", "env-acc", "targets"),
    ("releases", "images", "bundles"), ("releases", "semver", "carries"), ("changelog", "releases", "describes"),
    ("changelog", "roadmap", "comes from"), ("deploys", "images", "rolls out"), ("deploys", "env-prod", "targets"),
    ("deploys", "env-acc", "targets"), ("acc-check", "deploys", "approves"),
    ("env-acc", "host-g4", "runs on"), ("env-prod", "host-g5", "runs on"),
    ("svc-caddy", "env-prod", "is part of"), ("svc-backend", "env-prod", "is part of"), ("svc-ghost", "env-prod", "is part of"),
    ("svc-agent-worker", "env-prod", "is part of"), ("svc-cloudflared", "env-prod", "is part of"),
    ("db-prod", "env-prod", "belongs to"), ("db-acc", "env-acc", "belongs to"),
    ("backup-nightly", "db-prod", "protects"), ("backup-predeploy", "db-prod", "protects"), ("restore", "db-prod", "protects"),
    ("domain-webheaven", "svc-cloudflared", "routes to"), ("domain-webheaven", "svc-caddy", "routes to"),
    ("capacity", "host-g5", "is measured on"), ("errors", "env-prod", "is reported from"), ("errors", "env-acc", "is reported from"),
    ("watcher", "svc-backend", "watches"), ("logs", "svc-backend", "comes from"), ("metrics", "host-g5", "is measured on"),
    ("metrics", "host-g4", "is measured on"), ("runbook-caddy", "playbook-caddy", "is captured as"),
    ("roles", "accounts", "is granted to"), ("api-keys", "roles", "has"), ("audit", "accounts", "records actions of"),
    ("data-register", "alembic", "describes"), ("ssh", "host-g5", "grants access to"), ("ssh", "host-g4", "grants access to"),
    ("deploy-grants", "host-g4", "grants access to"),
    ("member-bart", "role-owner", "fills"), ("member-bart", "role-dev", "fills"), ("member-bart", "role-ops", "fills"),
    ("agent-claude", "role-dev", "fills"), ("member-bart", "product", "works on"), ("role-owner", "product", "is responsible for"),
    ("agent-claude", "sessions", "runs"), ("sessions", "roadmap", "works on"), ("playbook-roadmap", "guardrail-roadmap", "puts into practice"),
    ("sub-github", "pipeline-deploy", "pays for"), ("asset-g5", "host-g5", "is the hardware of"),
    ("asset-g4", "host-g4", "is the hardware of"), ("asset-nas", "host-nas", "is the hardware of"),
]
PLATFORM_LINKS += [(f"guardrail-{k}", "agent-claude", "steers") for k, _ in _GUARDRAILS]
PLATFORM_LINKS += [(f"var-{n.lower()}", "svc-backend", "configures") for n in _CONFIG if n != "IMAGE_TAG"]
PLATFORM_LINKS += [(f"secret-{n.lower()}", "svc-backend", "is used by") for n in _SECRETS]

# Checklist lines that are already in place for the platform (keys from keelson_catalog.check_templates)
PLATFORM_DONE_CHECKS = [
    "product.setup.2", "users.setup.0", "design.setup.1", "design.run.1",
    "code.setup.0", "code.run.0", "quality.run.2",
    "delivery.setup.0", "delivery.setup.1", "delivery.setup.2", "delivery.run.0", "delivery.run.1",
    "environments.setup.0", "environments.setup.1", "environments.setup.2",
    "operations.setup.0", "operations.setup.1", "security.setup.0", "security.setup.2",
    "workflow.setup.0", "workflow.setup.1", "workflow.setup.2", "workflow.run.0",
]
PRODUCT_DONE_CHECKS = ["product.setup.2"]
