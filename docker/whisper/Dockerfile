FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN python -m pip install --no-cache-dir faster-whisper==1.1.1 fastapi==0.115.6 uvicorn==0.34.0 python-multipart==0.0.20 requests==2.32.3 av==12.3.0

WORKDIR /app
COPY app.py .

# Het model wordt bij de eerste start gedownload naar /models (volume), daarna lokaal.
EXPOSE 8095
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8095"]
