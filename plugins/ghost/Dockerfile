# Ghost — headless Vanger-worker, geïsoleerd van de backend-image.
# Basis-image bevat Python + alle Chromium-dependencies al klaar voor gebruik.
FROM mcr.microsoft.com/playwright/python:v1.47.0-noble

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ghost.py .
COPY hockey-vanger-contract.json .

CMD ["python", "ghost.py"]
