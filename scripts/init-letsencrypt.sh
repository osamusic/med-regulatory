#!/bin/bash

# Let's Encrypt初期設定スクリプト（安全版）
# 使用方法: ./scripts/init-letsencrypt.sh your-email@example.com

set -e  # エラーが発生したら即座に終了

# スクリプトのディレクトリを取得して、プロジェクトルートに移動
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

if [ $# -eq 0 ]; then
    echo "使用方法: $0 <email>"
    echo "例: $0 admin@osamusic.org"
    exit 1
fi

EMAIL=$1

# Load domain names from environment or use defaults
DOMAIN_NAME=${DOMAIN_NAME:-osamusic.org}
DOMAIN_ALIASES=${DOMAIN_ALIASES:-www.osamusic.org}

# Convert comma-separated aliases to array
IFS=',' read -ra ALIAS_ARRAY <<< "$DOMAIN_ALIASES"
DOMAINS=("$DOMAIN_NAME" "${ALIAS_ARRAY[@]}")

STAGING=0 # 本番環境の場合は0、テスト環境の場合は1
NGINX_CONF_DIR="nginx"
HTTPS_CONF="${NGINX_CONF_DIR}/nginx.conf"
HTTP_ONLY_CONF="${NGINX_CONF_DIR}/nginx-http-only.conf"
BACKUP_CONF="${NGINX_CONF_DIR}/nginx.conf.https-backup"

echo "### Let's Encrypt証明書の初期設定を開始します..."

# 必要なファイルの存在確認
if [ ! -f "$HTTPS_CONF" ]; then
    echo "エラー: $HTTPS_CONF が見つかりません。"
    exit 1
fi

if [ ! -f "$HTTP_ONLY_CONF" ]; then
    echo "エラー: $HTTP_ONLY_CONF が見つかりません。"
    exit 1
fi

# 既存の証明書をチェック
if docker volume ls | grep -q letsencrypt; then
  read -p "既存の証明書データが見つかりました。続行しますか? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "既存のデータを削除します..."
    # Stop all containers to ensure clean state
    docker compose down || true
    # Remove specific volumes
    docker volume rm med-regulatory_letsencrypt 2>/dev/null || true
    docker volume rm med-regulatory_certbot-www 2>/dev/null || true
    # Clean up any dangling networks
    docker network prune -f 2>/dev/null || true
  else
    echo "処理を中止しました。"
    exit 1
  fi
fi

# 元のnginx.confをバックアップ（HTTPSの設定を保持）
echo "### 元のnginx設定をバックアップ中..."
cp "$HTTPS_CONF" "$BACKUP_CONF"
echo "### バックアップを作成しました: $BACKUP_CONF"

# クリーンアップ関数
cleanup() {
    echo "### クリーンアップ中..."
    if [ -f "$BACKUP_CONF" ]; then
        echo "### HTTPS設定を復元しています..."
        cp "$BACKUP_CONF" "$HTTPS_CONF"
        docker compose restart nginx || true
    fi
}

# エラー時にクリーンアップを実行
trap cleanup ERR

# まずHTTPのみでnginxを起動
echo "### HTTP設定でNginx を起動中..."
cp "$HTTP_ONLY_CONF" "$HTTPS_CONF"
# Start all services to ensure dependencies are met
docker compose up -d

# Nginxが起動するまで待機
echo "### Nginxの起動を待機中..."
for i in {1..30}; do
    if docker compose ps nginx | grep -q "Up"; then
        echo "### Nginxが起動しました。"
        break
    fi
    echo -n "."
    sleep 1
done

if ! docker compose ps nginx | grep -q "Up"; then
    echo "### エラー: Nginxの起動に失敗しました。"
    exit 1
fi

# 証明書ディレクトリを準備
echo "### 証明書ディレクトリを準備中..."
docker compose run --rm --entrypoint "mkdir -p /etc/letsencrypt/live/osamusic.org" certbot

# 証明書を取得
echo "### Let's Encrypt証明書を取得中..."

# ドメイン引数を構築
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# ステージング環境の場合
if [ $STAGING != "0" ]; then
  STAGING_ARG="--staging"
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    $DOMAIN_ARGS \
    --email $EMAIL \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal" certbot

# 証明書の取得成功を確認
if [ $? -ne 0 ]; then
    echo "### エラー: 証明書の取得に失敗しました。"
    exit 1
fi

# 証明書ファイルの存在を確認
echo "### 証明書ファイルを確認中..."
if docker compose run --rm --entrypoint "test -f /etc/letsencrypt/live/osamusic.org/fullchain.pem" certbot; then
    echo "### 証明書ファイルが正常に作成されました。"
else
    echo "### エラー: 証明書ファイルが見つかりません。"
    exit 1
fi

# HTTPS設定に切り替え
echo "### HTTPS設定に切り替え中..."
cp "$BACKUP_CONF" "$HTTPS_CONF"
echo "### HTTPS設定を復元しました。"

# Nginxを再起動
echo "### Nginx を再起動中..."
docker compose restart nginx

# Nginxの状態を確認
echo "### Nginxの状態を確認中..."
sleep 5

if ! docker compose ps nginx | grep -q "Up"; then
    echo "### エラー: Nginxの起動に失敗しました。"
    echo "### ログを確認してください: docker compose logs nginx"
    
    # 証明書パスの問題の可能性があるため、詳細なログを表示
    echo "### 最新のエラーログ:"
    docker compose logs --tail=20 nginx
    exit 1
fi

echo "### Let's Encrypt証明書の設定が完了しました！"
echo "### 証明書は12時間ごとに自動更新されます。"
echo "### HTTPSアクセス: https://osamusic.org"

# HTTPSが機能しているか確認（外部からのアクセスをシミュレート）
echo "### HTTPS接続を確認中..."
sleep 2
if curl -s -o /dev/null -w "%{http_code}" https://osamusic.org --resolve osamusic.org:443:127.0.0.1 --insecure 2>/dev/null | grep -q "200\|301\|302"; then
    echo "### HTTPS接続が確認できました。"
else
    echo "### 警告: HTTPS接続の確認に失敗しました。"
    echo "### 以下のコマンドで手動確認してください:"
    echo "### curl -I https://osamusic.org"
fi

# バックアップファイルをクリーンアップ
echo "### バックアップファイルを削除中..."
rm -f "$BACKUP_CONF"

echo "### 設定が完了しました！"