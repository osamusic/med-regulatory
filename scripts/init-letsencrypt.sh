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
DATA_PATH="./letsencrypt"
STAGING=0 # 本番環境の場合は0、テスト環境の場合は1

echo "### Let's Encrypt証明書の初期設定を開始します..."

# 既存の証明書をチェック
if [ -d "$DATA_PATH" ]; then
  read -p "既存の証明書データが見つかりました。続行しますか? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "既存のデータを削除します..."
    rm -rf $DATA_PATH
  else
    echo "処理を中止しました。"
    exit 1
  fi
fi

# ダミー証明書を作成
echo "### ダミー証明書を作成中..."
mkdir -p "$DATA_PATH/live/osamusic.org"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1\
    -keyout '/etc/letsencrypt/live/osamusic.org/privkey.pem' \
    -out '/etc/letsencrypt/live/osamusic.org/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Nginx を起動中..."
docker-compose up --force-recreate -d nginx

# ダミー証明書を削除
echo "### ダミー証明書を削除中..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/osamusic.org && \
  rm -Rf /etc/letsencrypt/archive/osamusic.org && \
  rm -Rf /etc/letsencrypt/renewal/osamusic.org.conf" certbot

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

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    $DOMAIN_ARGS \
    --email $EMAIL \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal" certbot

echo "### Nginx を再起動中..."
docker-compose exec nginx nginx -s reload

echo "### Let's Encrypt証明書の設定が完了しました！"
echo "### 証明書は12時間ごとに自動更新されます。"