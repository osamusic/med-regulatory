#!/usr/bin/env python3
"""
cloud-sql-proxyの詳細動作確認テスト
"""

import logging
import os
import time

import pyodbc
from sqlalchemy import create_engine, text

# ログ設定
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def test_raw_odbc_connection():
    """生のODBC接続をテストする"""
    logger.info("=== 生のODBC接続テスト ===")

    # 接続文字列を構築
    server = "cloud-sql-proxy,1433"
    database = "cybermed-db"
    username = "sqlserver"
    password = os.getenv("DB_PASSWORD", "")

    connection_string = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
        f"Encrypt=yes;"
        f"Connection Timeout=30;"
        f"Login Timeout=30;"
    )

    logger.info(f"接続文字列: {connection_string.replace(password, '***')}")

    try:
        logger.info("ODBC接続を試行中...")
        start_time = time.time()

        conn = pyodbc.connect(connection_string, timeout=30)

        elapsed = time.time() - start_time
        logger.info(f"✅ ODBC接続成功! (所要時間: {elapsed:.2f}秒)")

        # 簡単なクエリをテスト
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION as version")
        result = cursor.fetchone()
        logger.info(f"SQL Server バージョン: {result.version}")

        cursor.execute("SELECT DB_NAME() as current_db")
        result = cursor.fetchone()
        logger.info(f"現在のデータベース: {result.current_db}")

        cursor.close()
        conn.close()
        logger.info("ODBC接続を正常にクローズしました")
        return True

    except pyodbc.Error as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ ODBC接続エラー (所要時間: {elapsed:.2f}秒)")
        logger.error(f"エラー詳細: {str(e)}")
        return False
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ 予期しないエラー (所要時間: {elapsed:.2f}秒)")
        logger.error(f"エラー詳細: {str(e)}")
        return False


def build_sqlalchemy_url():
    """SQLAlchemy URLを手動で構築"""
    from sqlalchemy.engine import URL

    # 環境変数から値を取得
    server = "cloud-sql-proxy"
    port = 1433
    database = "cybermed-db"
    username = "sqlserver"
    password = os.getenv("DB_PASSWORD", "")

    # SQLAlchemy URLオブジェクトを作成
    url = URL.create(
        "mssql+pyodbc",
        username=username,
        password=password,  # SQLAlchemyが自動的にエスケープする
        host=server,
        port=port,
        database=database,
        query={
            "driver": "ODBC Driver 18 for SQL Server",
            "TrustServerCertificate": "yes",
            "Encrypt": "yes",
            "timeout": "30",
            "login_timeout": "30",
        },
    )

    logger.info(f"構築されたSQLAlchemy URL: {str(url).split('@')[0]}@***")
    return url


def test_sqlalchemy_connection():
    """SQLAlchemy接続テスト"""
    logger.info("=== SQLAlchemy接続テスト ===")

    start_time = time.time()

    try:
        # SQLAlchemy URL構築アプローチ
        url = build_sqlalchemy_url()
        engine = create_engine(url, echo=True)

        with engine.connect() as conn:
            elapsed = time.time() - start_time
            logger.info(f"✅ SQLAlchemy接続成功! (所要時間: {elapsed:.2f}秒)")

            # テストクエリ実行
            result = conn.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            logger.info(f"テストクエリ結果: {row.test}")

            return True

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ SQLAlchemy接続失敗 (所要時間: {elapsed:.2f}秒)")
        logger.error(f"エラー: {str(e)}")
        return False


def test_connection_timing():
    """接続タイミングの詳細テスト"""
    logger.info("=== 接続タイミングテスト ===")

    import socket

    # TCP接続の段階的テスト
    try:
        logger.info("TCP接続テスト中...")
        start_time = time.time()

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30)
        sock.connect(("cloud-sql-proxy", 1433))

        tcp_time = time.time() - start_time
        logger.info(f"✅ TCP接続成功 (所要時間: {tcp_time:.2f}秒)")

        # データ送信テスト
        sock.send(b"\x00")
        sock.close()

        return True

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"❌ TCP接続エラー (所要時間: {elapsed:.2f}秒)")
        logger.error(f"エラー詳細: {str(e)}")
        return False


def main():
    """メイン関数"""
    logger.info("=== cloud-sql-proxy詳細動作確認開始 ===")

    # 1. TCP接続テスト
    tcp_ok = test_connection_timing()

    # 2. 生のODBC接続テスト
    odbc_ok = test_raw_odbc_connection()

    # 3. SQLAlchemy接続テスト
    sqlalchemy_ok = test_sqlalchemy_connection()

    # 結果まとめ
    logger.info("=== テスト結果まとめ ===")
    logger.info(f"TCP接続: {'✅ OK' if tcp_ok else '❌ NG'}")
    logger.info(f"ODBC接続: {'✅ OK' if odbc_ok else '❌ NG'}")
    logger.info(f"SQLAlchemy接続: {'✅ OK' if sqlalchemy_ok else '❌ NG'}")

    if odbc_ok and sqlalchemy_ok:
        logger.info("🎉 cloud-sql-proxyは完全に正常動作しています！")
        logger.info("元のアプリケーションの問題は他の要因かもしれません")
    elif tcp_ok and not odbc_ok:
        logger.warning("⚠️ TCP接続は成功するが、SQL認証で問題が発生")
        logger.warning("Cloud SQLインスタンスの認証情報を確認してください")
    else:
        logger.error("❌ cloud-sql-proxyに根本的な問題があります")


if __name__ == "__main__":
    main()
