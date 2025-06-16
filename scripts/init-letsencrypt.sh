#!/bin/bash

# Let's Encrypt初期設定スクリプト
# 使用方法: ./scripts/init-letsencrypt.sh your-email@example.com

if [ $# -eq 0 ]; then
    echo "使用方法: $0 <email>"
    echo "例: $0 admin@osamusic.org"
    exit 1
fi

EMAIL=$1
DOMAINS=(osamusic.org www.osamusic.org)
STAGING=0 # 本番環境の場合は0、テスト環境の場合は1

echo "### Let's Encrypt証明書の初期設定を開始します..."

# 既存の証明書をチェック
if docker volume ls | grep -q letsencrypt; then
  read -p "既存の証明書データが見つかりました。続行しますか? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "既存のデータを削除します..."
    docker volume rm $(docker volume ls -q | grep letsencrypt) 2>/dev/null || true
    docker volume rm $(docker volume ls -q | grep certbot) 2>/dev/null || true
  else
    echo "処理を中止しました。"
    exit 1
  fi
fi

# まずHTTPのみでnginxを起動
echo "### HTTP設定でNginx を起動中..."
cp nginx/nginx-http-only.conf nginx/nginx.conf.backup
cp nginx/nginx-http-only.conf nginx/nginx.conf
docker compose up --force-recreate -d nginx

# Nginxが起動するまで待機
echo "### Nginxの起動を待機中..."
sleep 10

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

# HTTPS設定に切り替え
echo "### HTTPS設定に切り替え中..."
if [ -f nginx/nginx.conf.backup ]; then
    mv nginx/nginx.conf.backup nginx/nginx.conf
else
    echo "警告: nginx.conf.backupが見つかりません。手動でHTTPS設定に戻してください。"
fi

# Nginxを再起動
echo "### Nginx を再起動中..."
docker compose restart nginx

# Nginxの状態を確認
echo "### Nginxの状態を確認中..."
sleep 5
if docker compose ps nginx | grep -q "Up"; then
    echo "### Let's Encrypt証明書の設定が完了しました！"
    echo "### 証明書は12時間ごとに自動更新されます。"
    echo "### HTTPSアクセス: https://osamusic.org"
else
    echo "### エラー: Nginxの起動に失敗しました。ログを確認してください:"
    echo "### docker compose logs nginx"
    exit 1
fi