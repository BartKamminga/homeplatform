FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# beatportdl — optioneel; build gaat door als download mislukt
# Controleer https://github.com/unspok3n/beatportdl/releases voor de juiste versie/bestandsnaam
RUN ARCH=$(dpkg --print-architecture); \
    if [ "$ARCH" = "amd64" ]; then BIN="beatportdl_Linux_x86_64.tar.gz"; \
    else BIN="beatportdl_Linux_arm64.tar.gz"; fi; \
    curl -fsSL "https://github.com/unspok3n/beatportdl/releases/latest/download/${BIN}" \
      | tar -xz -C /usr/local/bin beatportdl 2>/dev/null \
      && chmod +x /usr/local/bin/beatportdl \
      || echo "beatportdl niet gedownload — plaats binary handmatig op /usr/local/bin/beatportdl"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
