# docker/claude-agent/Dockerfile
# Losse container om Claude Code CLI headless te draaien op de G4 (of lokaal),
# los van de homeplatform-app zelf. Bevat alle tooling die nodig is om de repo
# te clonen, backend/frontend te builden en te testen, en roadmap.ps1 te draaien.

FROM node:22-bookworm

# git, python (backend/alembic), tmux (persistente sessie), curl/gnupg (voor pwsh-repo)
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        python3 \
        python3-venv \
        python3-pip \
        tmux \
        curl \
        ca-certificates \
        gnupg \
        openssh-client \
    && rm -rf /var/lib/apt/lists/*

# PowerShell Core (voor roadmap.ps1 / MindBox.ps1 — praten alleen met de API, geen lokale DB)
RUN curl -fsSL https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -o /tmp/packages-microsoft-prod.deb \
    && dpkg -i /tmp/packages-microsoft-prod.deb \
    && rm /tmp/packages-microsoft-prod.deb \
    && apt-get update && apt-get install -y powershell \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# SSH host key van GitHub vast opnemen (voorkomt interactieve host-key-prompt bij git clone/push)
RUN mkdir -p /root/.ssh \
    && ssh-keyscan -t rsa,ed25519 github.com >> /root/.ssh/known_hosts

WORKDIR /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY build-check.sh /usr/local/bin/build-check.sh
COPY onboarding/ /opt/onboarding/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/build-check.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
