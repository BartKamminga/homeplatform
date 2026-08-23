# Scan-agent worker — licht, geen browser nodig (in tegenstelling tot
# plugins/ghost/, dit proces browst niet, het roept alleen onze eigen REST-API
# en de gewone Anthropic Messages API aan).
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py .

CMD ["python", "worker.py"]
