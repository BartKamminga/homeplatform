FROM python:3.12-alpine

WORKDIR /app

RUN pip install --no-cache-dir flask

COPY server.py .
COPY static/ ./static/

EXPOSE 8765

ENV MUSIC_DIR=/music

CMD ["python", "server.py"]
