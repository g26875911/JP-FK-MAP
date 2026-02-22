#!/bin/bash
SCRIPT_DIR="/Users/zi-jianchen/.openclaw/workspace/projects/japan"
cd "$SCRIPT_DIR"

SUBDOMAIN="japan-zi-jian"
FIXED_URL="https://${SUBDOMAIN}.loca.lt"

echo "清理舊進程..."
lsof -ti:8090 | xargs kill -9 2>/dev/null
sleep 1

echo "啟動安全伺服器 (server.py)..."
python3 "$SCRIPT_DIR/server.py" > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

echo "啟動 localtunnel（子域名: $SUBDOMAIN，自動重啟）..."
(
  while true; do
    START_TIME=$SECONDS
    npx localtunnel --port 8090 --subdomain "$SUBDOMAIN" > /tmp/japan_lt.log 2>&1
    RUN_TIME=$((SECONDS - START_TIME))
    # 若進程在 10 秒內就退出，代表子域名被佔或連線失敗，等久一點再重試
    if [ $RUN_TIME -lt 10 ]; then
      echo "[$(date '+%H:%M:%S')] localtunnel 啟動失敗，15 秒後重試..." >> /tmp/japan_lt.log
      sleep 15
    else
      echo "[$(date '+%H:%M:%S')] localtunnel 中斷，3 秒後重啟..." >> /tmp/japan_lt.log
      sleep 3
    fi
  done
) &
LT_PID=$!
sleep 4

# 寫入固定公開網址（供 reboot-check / assistant 查詢）
{
  echo "$FIXED_URL"
  date '+%Y-%m-%d %H:%M:%S'
} > current_url.txt

echo ""
echo "========================================"
echo "公開網址: $FIXED_URL"
echo "密碼保護: 已啟用 (0424)"
echo "安全機制: 錯誤 3 次鎖定 1 小時"
echo "注意: 第一次開啟需輸入自己的 IP（點一次即可）"
echo "========================================"
echo "按 Ctrl+C 停止服務"

trap "kill $SERVER_PID $LT_PID 2>/dev/null; rm -f /tmp/japan_lt.log current_url.txt; exit 0" INT TERM
wait
