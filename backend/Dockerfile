FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# システム依存パッケージ（uvicornやpyodbcなどがあるなら必要）
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    gcc g++ \
    gnupg2 \
    unixodbc-dev \
    apt-transport-https \
    && curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor \
        | tee /usr/share/keyrings/microsoft.gpg > /dev/null \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
        > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with specific UID/GID to match host user
RUN groupadd -g 1000 appuser && useradd -u 1000 -g appuser -m appuser

# 作業ディレクトリ
WORKDIR /app

# 依存ファイルをコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m nltk.downloader punkt_tab

# アプリ本体をコピー
COPY src/ ./src

# Create storage directories with proper permissions before switching user
RUN mkdir -p /app/storage/cls_index /app/storage/index /app/storage/proc_index /app/storage/documents

# Change ownership of the app directory to the non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# 起動（FastAPI）
CMD ["gunicorn", "src.main:app", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "360"]

