# Japan 旅遊地圖專案說明

這個資料夾包含一個網頁版的日本旅遊地圖，會讀取 `notes.md` 並將景點顯示在互動地圖上。

## 檔案結構

- `index.html` - 旅遊地圖網頁介面（使用 Leaflet.js）
- `notes.md` - 景點資料（主要編輯的檔案）
- `start.sh` - 一鍵啟動腳本（同時啟動 HTTP server 和 localtunnel）
- `assets/` - 靜態資源

## 啟動服務

```bash
./start.sh
```

腳本會自動：
1. 清理 port 8090 的舊進程
2. 在背景啟動 Python HTTP server（port 8090）
3. 在背景啟動 localtunnel（固定子域名 `japan-zi-jian`），log 寫至 `/tmp/japan_lt.log`
4. localtunnel 崩潰時自動重啟，網址不變
5. 印出公開網址並寫入 `current_url.txt`

**公開網址固定為：** `https://japan-zi-jian.loca.lt`（不再隨重啟改變）

> **注意**：japan 使用 localtunnel，todo 使用 ngrok，兩者互不衝突，可同時運作。

按 `Ctrl+C` 停止所有服務。

## localtunnel 使用說明

### Friendly Reminder 頁面（首次訪問）

第一次開啟 localtunnel 網址時，會出現一個驗證頁面，需要輸入「家裡那台電腦（跑 localtunnel 的主機）」的公開 IP 才能進入。

**查詢 IP 的方法：**

在家裡那台跑 localtunnel 的電腦上查詢（或請 assistant 回報）。用瀏覽器開啟以下網址，顯示的數字就是要輸入的 IP：

```
https://api.ipify.org
```

輸入 IP 送出後即可進入，**同一個 session 內不需再輸入**（關掉分頁或重新整理不受影響，直到清除瀏覽器資料為止）。

### 與 ngrok 的差異

| 項目 | localtunnel（japan） | ngrok（todo） |
|------|----------------------|---------------|
| 費用 | 免費，無 session 限制 | 免費，限 1 個 session |
| 首次訪問 | 需輸入 IP 通過驗證 | 無額外驗證 |
| URL 格式 | `https://xxx.loca.lt` | `https://xxx.ngrok-free.app` |
| URL 固定性 | **固定**（`--subdomain japan-zi-jian`） | 每次重啟都會改變 |

## 查詢目前網址

當用戶詢問「日本地圖網址」或類似問題時，直接讀取 `current_url.txt`：

```bash
head -n 1 /Users/zi-jianchen/.openclaw/workspace/projects/japan/current_url.txt
```

如果檔案不存在或是空的，表示服務未啟動，請告知用戶需要先執行 `./start.sh`。

## Assistant behavior: 回答日本旅遊網址
當用戶詢問「日本旅遊網址／日本地圖網址」時：
1) 優先讀取 `current_url.txt` 第一行
2) 若不存在或是空的：提示先執行 `./start.sh`


## 為什麼需要 HTTP server？

`index.html` 使用 `fetch('notes.md')` 讀取資料，這在 `file://` 協定下會被瀏覽器的安全政策封鎖，必須透過 HTTP server 才能正常運作。

## notes.md 格式

每個景點以 `# [分類] 名稱` 作為標題，支援以下分類：

| 分類標籤 | 顯示類別 |
|----------|----------|
| 美食、餐廳 | 美食（紅色） |
| 景點、整理 | 景點（藍色） |
| 住宿、飯店 | 住宿（綠色） |
| 購物 | 購物（橘色） |

範例格式：

```markdown
# [美食] 一蘭拉麵 博多本店
> 座標: 33.5897, 130.4207
> 地址: 福岡市博多區中洲5-3-2
> 連結: https://maps.app.goo.gl/xxxxx

### 想做什麼
- 點招牌豚骨拉麵，選硬麵、濃湯底

### 備註
- 24 小時營業，建議避開用餐尖峰時段
```

## 新增或修改景點

直接編輯 `notes.md` 即可，存檔後在瀏覽器重新整理頁面就會看到更新。座標可以從 Google Maps 複製（右鍵點地圖 → 複製座標）。

沒有座標的景點仍會出現在左側列表，並標示「缺座標」，點擊後會自動開啟 Google Maps 搜尋。

## 故障排除：能啟動但連不進去

### 症狀
- `start.sh` 成功印出公開網址
- 瀏覽器開啟後一直轉圈、timeout，或等很久才有反應

### 根本原因
`server.py` 原本使用單執行緒的 `TCPServer`，localtunnel 會建立 HTTP keep-alive 持久連線，導致 server 被佔住、無法處理瀏覽器的新請求。

**已於 2026-02-19 修復**：`server.py` 改用 `ThreadingTCPServer`，若再次出現請重啟 `start.sh`。

### 快速診斷

```bash
# 確認 server 有回應（應立即回傳 200，若卡住或 000 表示 server 沒起來）
curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8090/
```

### 萬用重啟指令

```bash
lsof -ti:8090 | xargs kill -9 2>/dev/null
pkill -f "localtunnel"
cd /Users/zi-jianchen/.openclaw/workspace/projects/japan && ./start.sh
```

---

## 故障排除：公開網址突然失效（localtunnel 崩潰）

### 症狀
- server 本地正常（curl localhost:8090 回傳 200）
- 但公開網址 `https://japan-zi-jian.loca.lt` 無法連入

### 說明
`start.sh` 已內建自動重啟機制，localtunnel 崩潰後會在 3 秒內自動恢復，**通常不需要手動處理**，等幾秒再試即可。

若長時間無法連入，才需要手動介入：

### 診斷

```bash
cat /tmp/japan_lt.log
```

若看到類似以下錯誤，代表 localtunnel 正在重啟中：

```
Error: connection refused: localtunnel.me:XXXXX (check your firewall settings)
[HH:MM:SS] localtunnel 中斷，3 秒後重啟...
```

### 手動重啟（最後手段）

```bash
lsof -ti:8090 | xargs kill -9 2>/dev/null
pkill -f "localtunnel"
cd /Users/zi-jianchen/.openclaw/workspace/projects/japan && ./start.sh
```

網址固定為 `https://japan-zi-jian.loca.lt`，重啟後不變。

---

## 更新紀錄

### 2026-02-19
- **tunnel 工具從 ngrok 改為 localtunnel**
  - 原因：ngrok 免費帳號同時只允許 1 個 active session，japan 和 todo 同時跑會衝突
  - `start.sh` 改用 `npx localtunnel --port 8090`，stdout 導向 `/tmp/japan_lt.log`
  - URL 從 log 以 grep 解析（格式：`https://xxx.loca.lt`）
  - trap cleanup 改為同時 kill server 和 localtunnel 進程，並清理 log 檔
  - localtunnel 首次訪問需通過 Friendly Reminder 頁面（輸入自己的 IP，一次即可）
- **修復 server 單執行緒問題**
  - `server.py` 從 `TCPServer` 改為 `ThreadingTCPServer`
  - 原因：localtunnel 的 keep-alive 連線會卡死單執行緒 server，導致瀏覽器無法連入

### 2026-02-20
- **固定 localtunnel 子域名**
  - `start.sh` 加入 `--subdomain japan-zi-jian`，網址固定為 `https://japan-zi-jian.loca.lt`
  - 重啟後不再需要更新網址，在國外也能直接使用固定網址
- **localtunnel 自動重啟**
  - `start.sh` 改用 while 迴圈包住 localtunnel，崩潰後自動重啟，無需手動介入
  - 正常崩潰（跑超過 10 秒）→ 3 秒後重啟；啟動失敗（子域名被佔等）→ 15 秒後重試，避免多進程湧現
- **修復 start.sh 路徑問題**
  - 原本 `cd "$(dirname "$0")"` 在相對路徑呼叫時無效，導致 `python3 server.py` 靜默失敗
  - 改為硬寫絕對路徑 `SCRIPT_DIR`，確保從任何目錄執行都能正確啟動
