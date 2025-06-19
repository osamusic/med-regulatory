# MedShield AI - ローカル開発環境

ローカル開発用の簡単セットアップガイドです。

## クイックスタート

### 1. 環境変数の設定

`.env`ファイルを作成してOpenAI APIキーを設定：

```bash
# .env ファイル
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. ローカル開発環境の起動

```bash
# ローカル開発用のDocker Composeを使用
docker compose -f docker-compose.local.yml up --build
```

### 3. アクセス

- **フロントエンド**: http://localhost:8080
- **バックエンドAPI**: http://localhost:8080/api
- **APIドキュメント**: http://localhost:8080/api/docs

## ローカル環境の特徴

### データベース
- **SQLite**: ローカルファイルベース、設定不要
- **データ保存場所**: `backend/storage/` ディレクトリ
- **永続化**: Dockerボリュームで自動管理

### 開発機能
- **ホットリロード**: コード変更時の自動反映
  - フロントエンド: React/Vite開発サーバー
  - バックエンド: FastAPI `--reload` モード
- **デバッグ**: 開発用ログとエラー表示
- **CORS**: localhost間での通信許可

### 簡略化された設定
- **HTTPのみ**: SSL証明書不要
- **認証**: 簡単なJWT認証
- **外部依存**: Redis以外の外部サービス不要

## よく使用するコマンド

### コンテナの管理

```bash
# 起動
docker compose -f docker-compose.local.yml up -d

# ログ確認
docker compose -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.local.yml logs -f frontend

# 停止
docker compose -f docker-compose.local.yml down

# 完全リセット（ボリュームも削除）
docker compose -f docker-compose.local.yml down -v
```

### データベースの管理

```bash
# バックエンドコンテナにアクセス
docker compose -f docker-compose.local.yml exec backend bash

# SQLiteデータベースファイルの場所
ls -la /app/storage/
```

### 開発時のヒント

1. **初回起動時**: 管理者ユーザーを作成
   - ユーザー登録画面で管理者として登録
   - シークレットキー: `admin123` (デフォルト)

2. **コード変更**: 
   - フロントエンド: 自動リロード
   - バックエンド: 自動リロード（uvicorn --reload）

3. **データリセット**:
   ```bash
   # SQLiteファイルを削除してリセット
   docker compose -f docker-compose.local.yml down
   docker volume rm med-regulatory_backend-storage
   docker compose -f docker-compose.local.yml up --build
   ```

## トラブルシューティング

### ポート競合
8080ポートが使用中の場合は、`docker-compose.local.yml`のポート設定を変更：

```yaml
nginx:
  ports:
    - "8081:80"  # 8081ポートに変更
```

### API接続エラー
- ブラウザのネットワークタブでAPI URLを確認
- `http://localhost:8080/api/health/redis` でヘルスチェック

### データベースエラー
- SQLiteファイルのパーミッション確認
- ボリュームをリセットしてクリーンスタート