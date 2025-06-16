# MedShield AI - 医療機器サイバーセキュリティ専門家システム

医療機器のサイバーセキュリティに関する情報を自動収集・分析・提案するAI支援システムです。

## Nginx設定

### ドメイン設定
- メインドメイン: `osamusic.org`
- WWWドメイン: `www.osamusic.org`

### SSL証明書 (Let's Encrypt)

#### 初回証明書取得

1. Nginxコンテナに接続:
```bash
docker exec -it med-regulatory-nginx-1 bash
```

2. Certbotをインストール:
```bash
apt-get update
apt-get install -y certbot
```

3. Webroot用ディレクトリを作成:
```bash
mkdir -p /var/www/certbot
```

4. 証明書を取得:
```bash
certbot certonly --webroot \
  -w /var/www/certbot \
  -d osamusic.org \
  -d www.osamusic.org \
  --agree-tos \
  --email your-email@example.com
```

#### 証明書の自動更新

1. Cronジョブを設定:
```bash
# Nginxコンテナ内で
crontab -e
```

2. 以下の行を追加（毎日2:30に更新チェック）:
```
30 2 * * * /usr/bin/certbot renew --quiet && nginx -s reload
```

#### Docker Composeでの永続化

証明書とチャレンジファイルを永続化するため、`docker-compose.yml`に以下のボリュームを追加することを推奨:

```yaml
services:
  nginx:
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - letsencrypt:/etc/letsencrypt
      - certbot-www:/var/www/certbot

volumes:
  letsencrypt:
  certbot-www:
```

### セキュリティ設定

- **SSL/TLS**: TLS 1.2以上のみサポート
- **HSTS**: 有効（max-age=63072000）
- **セキュリティヘッダー**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection等を設定
- **レート制限**: 
  - API: 10リクエスト/秒
  - ログイン: 5リクエスト/分

## システム概要

MedShield AIは、医療機器のサイバーセキュリティに関するドキュメント収集、ベクトル検索、AI分析、評価レポート生成を自動化する包括的なシステムです。

### 主要機能
- **自動ドキュメント収集**: FDA、NIST、PMDAからの公的ガイドライン収集
- **AI分析・分類**: OpenAIを活用した文書の自動分類とリスク評価
- **ベクトル検索**: LlamaIndexによる高精度なセマンティック検索
- **ニュース収集**: 医療機器関連のセキュリティニュース自動収集
- **アセスメント管理**: プロジェクトベースの評価管理
- **レポート生成**: AI支援による評価レポート自動生成

## アーキテクチャ

### バックエンド (FastAPI)
- **認証システム**: JWT認証、保護/公開ルーター分離
- **データベース**: SQLAlchemy ORM、SQLite（`backend/storage/`に保存）
- **キャッシング**: Redis バックエンド、カスタムキー生成
- **API構造**: モジュラールーター設計

#### コアモジュール
- `auth/`: ユーザー認証・認可
- `crawler/`: FDA、NIST、PMDA ドキュメント収集
- `indexer/`: LlamaIndex ベクトル検索・ドキュメントインデックス
- `classifier/`: AI文書分類
- `guidelines/`: ガイドライン管理・検索
- `news_collector/`: ニュース記事収集・処理
- `process/`: ドキュメント処理ワークフロー
- `admin/`: 管理機能

### フロントエンド (React/Vite)
- **状態管理**: Context ベース（`AuthContext`, `ProcessContext`, `ThemeContext`）
- **ルーティング**: React Router による SPA
- **API通信**: Axios クライアント（`api/axiosClient.js`）
- **スタイリング**: Tailwind CSS、レスポンシブデザイン

#### 主要コンポーネント
- **認証**: ログイン、登録、保護されたルート
- **ダッシュボード**: システム統計、アクティビティ表示
- **ガイドライン**: 一覧、詳細、検索、分類管理
- **アセスメント**: プロジェクト管理、評価フォーム
- **管理者**: ユーザー管理、システム設定
- **ニュース**: 記事一覧、詳細表示
- **ドキュメント**: 検索、分類、処理状況

## ディレクトリ構造

```
cyber-meddev-agents/
├── backend/                    # FastAPI バックエンド
│   ├── src/
│   │   ├── admin/             # 管理者機能
│   │   ├── auth/              # JWT認証システム
│   │   ├── classifier/        # AI文書分類
│   │   ├── crawler/           # ドキュメント収集
│   │   ├── db/                # データベース（SQLAlchemy）
│   │   ├── guidelines/        # ガイドライン管理
│   │   ├── indexer/           # LlamaIndex ベクトル検索
│   │   ├── news_collector/    # ニュース収集
│   │   ├── process/           # 処理ワークフロー
│   │   ├── scripts/           # 管理スクリプト
│   │   ├── utils/             # ユーティリティ（キャッシュ、ログ、LLM）
│   │   └── main.py            # FastAPIアプリケーション
│   ├── storage/               # SQLite データベース保存場所
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                  # React/Vite フロントエンド
│   ├── src/
│   │   ├── api/              # Axios APIクライアント
│   │   ├── components/       # Reactコンポーネント
│   │   │   ├── admin/        # 管理者画面
│   │   │   ├── assessment/   # アセスメント管理
│   │   │   ├── auth/         # 認証関連
│   │   │   ├── common/       # 共通コンポーネント
│   │   │   ├── dashboard/    # ダッシュボード
│   │   │   ├── documents/    # ドキュメント検索
│   │   │   ├── guidelines/   # ガイドライン管理
│   │   │   ├── news/         # ニュース表示
│   │   │   └── process/      # 処理管理
│   │   ├── contexts/         # React Context
│   │   ├── hooks/            # カスタムフック
│   │   └── constants/        # 定数定義
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml         # Docker Compose設定
├── CLAUDE.md                  # Claude Code 向け開発ガイド
└── README.md                  # このファイル
```

## セットアップ方法

### 必要な環境変数

`.env` ファイルをプロジェクトルートに作成：

```env
# 必須
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# 管理者設定
ADMIN_REGISTRATION_SECRET=admin123
USER_REGISTRATION_SECRET=user123

# Firebase認証（オプション）
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_SERVICE_ACCOUNT_JSON=your_firebase_service_account_json

# Google OAuth（フロントエンド用）
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# オプション（デフォルト値あり）
ALLOWED_ORIGINS=http://localhost,https://localhost
ALLOWED_HOSTS=localhost
MAX_DOCUMENT_SIZE=4000
```

### Docker開発（推奨）

```bash
# リポジトリクローン
git clone https://github.com/osamusic/cyber-meddev-agents.git
cd cyber-meddev-agents

# 全スタック起動（ホットリロード対応）
docker-compose up --build

# 特定サービスのログ確認
docker-compose logs -f backend
docker-compose logs -f frontend

# サービス停止
docker-compose down
```

### 手動開発セットアップ

#### バックエンド

```bash
cd backend

# Poetry推奨
poetry install
# または pip
pip install -r requirements.txt

# 開発サーバー起動
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 環境変数指定起動
OPENAI_API_KEY=your_key uvicorn src.main:app --reload
```

#### フロントエンド

```bash
cd frontend

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションプレビュー
npm run preview
```

## アクセス情報

- **フロントエンド**: http://localhost:5173
- **バックエンドAPI**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs
- **Redoc**: http://localhost:8000/redoc

## データベース管理

- **場所**: `backend/storage/` (SQLite)
- **自動作成**: SQLAlchemy による起動時テーブル作成
- **管理スクリプト**: `backend/src/scripts/` 内の各種ユーティリティ

### 管理者ユーザー作成

```bash
# Dockerコンテナ内で実行
docker-compose exec backend python src/scripts/create_admin_user.py

# ローカル環境で実行
cd backend
python src/scripts/create_admin_user.py
```

## 開発・テスト

### バックエンドテスト

```bash
cd backend

# テスト依存関係インストール
poetry install --with test

# 全テスト実行
pytest

# カバレッジ付きテスト実行
pytest --cov=src --cov-report=html

# 特定のテストファイル実行
pytest tests/unit/auth/test_auth.py

# テストマーカー指定実行
pytest -m unit  # ユニットテストのみ
pytest -m integration  # 統合テストのみ
```

### フロントエンドテスト

```bash
cd frontend

# テスト依存関係インストール
npm install

# 全テスト実行
npm test

# テスト種別実行
npm run test:unit          # ユニットテストのみ
npm run test:integration   # 統合テストのみ
npm run test:e2e          # E2Eテストのみ

# テストUI起動
npm run test:ui

# カバレッジ付きテスト実行
npm run test:coverage

# ウォッチモードでテスト実行
npm run test:watch

# 一回だけテスト実行
npm run test:run

# 特定のテストファイル実行
npm test -- auth.test.jsx
```

#### テスト構造
```
frontend/tests/
├── unit/                 # ユニットテスト
│   ├── components/       # コンポーネントテスト
│   ├── hooks/           # カスタムフックテスト
│   └── utils/           # ユーティリティテスト
├── integration/         # 統合テスト
│   └── app.test.jsx     # アプリ全体テスト
├── e2e/                # E2Eテスト
└── utils/              # テストユーティリティ
    └── testUtils.jsx   # 共通テストヘルパー
```

### Docker環境でのテスト

```bash
# バックエンドテスト
docker-compose exec backend pytest

# フロントエンドテスト
docker-compose exec frontend npm test

# カバレッジレポート生成
docker-compose exec backend pytest --cov=src --cov-report=html
docker-compose exec frontend npm run test:coverage
```

## 統合ポイント

- **ポート**: バックエンド:8000、フロントエンド:5173
- **認証**: JWT トークン（localStorage保存）
- **検索**: LlamaIndex + OpenAI embeddings
- **ストレージ**: コンテナ間共有ボリューム

## API エンドポイント

### 公開エンドポイント
- `POST /auth/login` - ユーザーログイン
- `POST /auth/register` - ユーザー登録
- `GET /` - ヘルスチェック

### 保護されたエンドポイント（JWT認証必要）
- `/guidelines/*` - ガイドライン管理
- `/admin/*` - 管理者機能
- `/indexer/*` - ベクトル検索
- `/crawler/*` - ドキュメント収集
- `/classifier/*` - AI分類
- `/news/*` - ニュース管理
- `/process/*` - 処理ワークフロー

## 技術スタック

### バックエンド
- **FastAPI**: モダンな Python Web フレームワーク
- **SQLAlchemy**: Python ORM
- **LlamaIndex**: ベクトル検索・RAG
- **OpenAI API**: 埋め込み生成・AI分析
- **Redis**: API レスポンスキャッシュ
- **JWT**: トークンベース認証

### フロントエンド
- **React 18**: UI ライブラリ
- **Vite**: 高速ビルドツール
- **Tailwind CSS**: ユーティリティファースト CSS
- **React Router**: SPA ルーティング
- **Axios**: HTTP クライアント

### インフラ
- **Docker & Docker Compose**: コンテナ化
- **SQLite**: 開発用データベース
- **Redis**: キャッシュ層

## ライセンス

プロジェクトのライセンス情報を追加してください。


## 貢献

プルリクエストやイシューの報告を歓迎します。開発に参加する前に、CLAUDE.md を確認して開発ガイドラインを理解してください。

### 開発フロー
1. フィーチャーブランチ作成
2. 開発・テスト実行
3. PR作成（CI自動実行）
4. レビュー・マージ
5. main → ステージング自動デプロイ
6. タグ作成 → プロダクション自動デプロイ