FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# beatportdl — directe binary van GitHub releases (geen tar.gz)
RUN ARCH=$(dpkg --print-architecture) && echo "Architectuur: $ARCH" && \
    if [ "$ARCH" = "amd64" ]; then GOARCH="amd64"; \
    elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then GOARCH="arm64"; \
    else echo "Onbekende architectuur: $ARCH" && exit 1; fi && \
    URL="https://github.com/unspok3n/beatportdl/releases/latest/download/beatportdl-linux-${GOARCH}" && \
    echo "Downloading $URL ..." && \
    curl -fsSL "$URL" -o /usr/local/bin/beatportdl && \
    chmod +x /usr/local/bin/beatportdl && \
    echo "beatportdl geïnstalleerd: $(/usr/local/bin/beatportdl --version 2>&1 || echo ok)"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
