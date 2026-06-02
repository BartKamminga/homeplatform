FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Draai migraties bij elke start, dan start de server
CMD ["sh", "-c", "alembic stamp head || true && alembic upgrade head || true && uvicorn main:app --host 0.0.0.0 --port 8000"]
