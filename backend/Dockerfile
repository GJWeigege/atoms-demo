FROM python:3.12-slim

WORKDIR /app

COPY backend/pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY backend/ .
COPY config/ /app/config/
COPY templates/ /app/templates/

ENV TEMPLATES_ROOT=/app/templates
ENV CONFIG_ROOT=/app/config
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
