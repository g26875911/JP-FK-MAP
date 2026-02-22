#!/bin/bash
cd "$(dirname "$0")"

echo "清理舊進程..."
lsof -ti:8090 | xargs kill -9 2>/dev/null
sleep 1

echo "啟動安全伺服器 (server.py)..."
# 執行 server.py（預設 port 8090）
python3 server.py > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

echo "啟動 ngrok..."
# 使用獨立的 ngrok web 介面 port 避免跟 todo 專案衝突
ngrok http --web-addr=127.0.0.1:4041 8090 > /dev/null 2>&1 &
sleep 3

NGROK_URL=$(curl -s http://127.0.0.1:4041/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null)

# 寫入目前公開網址（供 reboot-check / assistant 查詢）
{
  echo "$NGROK_URL"
  date '+%Y-%m-%d %H:%M:%S'
} > current_url.txt

echo ""
echo "========================================"
echo "🌍 公開網址: $NGROK_URL"
echo "🔒 密碼保護: 已啟用 (0424)"
echo "⚠️  安全機制: 錯誤 3 次鎖定 1 小時"
echo "========================================"
echo "按 Ctrl+C 停止服務"

trap "kill $SERVER_PID; pkill -f 'ngrok http --web-addr=127.0.0.1:4041 8090'; exit 0" INT TERM
wait