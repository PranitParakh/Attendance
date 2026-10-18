FROM mcr.microsoft.com/playwright/python:v1.49.1-noble

WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HEADLESS=true

# Copy dependencies
COPY requirements.txt .

# Install dependencies and ensure chromium browser is ready
RUN pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium

# Copy application source
COPY app/ ./app/

# Expose container port
EXPOSE 8000

# Run FastAPI via Uvicorn with dynamic port binding for cloud platforms
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
