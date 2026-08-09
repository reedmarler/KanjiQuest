# Hugging Face Spaces (Docker SDK) expects the app to listen on port 7860.
FROM python:3.12-slim

WORKDIR /app

# Cache pip layer separately from source so code edits don't force a
# full dependency reinstall.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py tts_engine.py download_models.py warmup_bert.py ./

# Bake model weights and the shared BERT model into the image so containers
# start instantly and don't depend on Hugging Face being reachable at
# runtime (Spaces containers restart on sleep/wake).
ENV HF_HOME=/app/.cache/huggingface
RUN python download_models.py && python warmup_bert.py

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
