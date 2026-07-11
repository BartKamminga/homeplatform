FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# beatportdl — zoek de juiste download URL via de GitHub API
RUN ARCH=$(dpkg --print-architecture) && echo "Architectuur: $ARCH" && \
    if [ "$ARCH" = "amd64" ]; then GOARCH="x86_64"; \
    elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then GOARCH="arm64"; \
    else echo "Onbekende architectuur: $ARCH" && exit 1; fi && \
    API=$(curl -fsSL "https://api.github.com/repos/unspok3n/beatportdl/releases/latest") && \
    URL=$(echo "$API" | grep '"browser_download_url"' | grep -i linux | grep -i "$GOARCH" | grep -v '\.sha' | head -1 | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/') && \
    echo "Download URL: $URL" && \
    curl -fsSL "$URL" -o /tmp/beatportdl_pkg && \
    (tar -xz -C /usr/local/bin beatportdl < /tmp/beatportdl_pkg \
     || (cp /tmp/beatportdl_pkg /usr/local/bin/beatportdl)) && \
    rm /tmp/beatportdl_pkg && \
    chmod +x /usr/local/bin/beatportdl && \
    echo "beatportdl geïnstalleerd: $(beatportdl --version 2>&1 || true)"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
