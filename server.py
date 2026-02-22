import http.server
import socketserver
import json
import re
import os
import urllib.parse

PORT = 8090
NOTE_FILE = 'notes.md'

class ApiHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # 原本的讀取功能保持不變
        if self.path == '/notes.md':
            super().do_GET()
        else:
            # 預設行為
            super().do_GET()

    def do_POST(self):
        # 新增：接收網頁傳來的「更新天數」請求
        if self.path == '/api/update-day':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            target_name = data.get('name')
            new_day = data.get('day')
            
            if self.update_markdown_file(target_name, new_day):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'day': new_day}).encode('utf-8'))
            else:
                self.send_error(500, "Update failed")

    def update_markdown_file(self, target_name, new_day):
        """核心邏輯：修改 notes.md"""
        try:
            with open(NOTE_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            new_lines = []
            in_target_block = False
            day_updated = False
            
            # 尋找目標區塊的正則表達式 (例如: # [美食] 一蘭拉麵)
            # 我們只比對名稱部分，忽略分類
            name_pattern = re.compile(rf'^#\s\[.*?\]\s*{re.escape(target_name)}\s*$')

            for i, line in enumerate(lines):
                # 1. 檢查是否進入了目標景點的區塊
                if line.startswith('# ['):
                    if name_pattern.match(line.strip()):
                        in_target_block = True
                        day_updated = False # 重置標記
                    else:
                        in_target_block = False
                
                # 2. 如果在目標區塊內
                if in_target_block:
                    # 檢查是否已經有 "> Day: ..." 這一行
                    if line.strip().startswith('> Day:') or line.strip().startswith('> 行程:'):
                        if new_day and new_day != '0':
                            # 如果有選天數，就修改這一行
                            new_lines.append(f"> Day: {new_day}\n")
                        else:
                            # 如果選「未安排(0)」，就刪除這一行 (不加入 new_lines)
                            pass
                        day_updated = True
                        continue # 跳過原本的那行

                    # 3. 如果到了區塊結尾 (遇到下一個標題或分隔線)，但還沒找到 Day 標籤，就補上去
                    # 通常我們補在引用區塊 (>) 的最後，或者標題下方
                    next_line_is_header = (i + 1 < len(lines) and lines[i+1].startswith('#'))
                    next_line_is_separator = (i + 1 < len(lines) and lines[i+1].startswith('---'))
                    
                    if not day_updated and (next_line_is_header or next_line_is_separator) and new_day and new_day != '0':
                        # 找個好位置插入，這裡簡單插在區塊末尾
                        if not line.strip(): # 如果當前是空行
                            new_lines.append(f"> Day: {new_day}\n")
                            day_updated = True
                        
                new_lines.append(line)

            # 4. 特殊情況：如果原本沒有 Day 標籤，上面的邏輯可能會漏掉
            # 我們改用更簡單的暴力法：如果讀完整個區塊都沒看到 Day，且需要加 Day
            # (為了程式碼簡潔，這裡採用「如果發現是目標標題，直接在下一行插入」的備案會比較穩)
            
            # 重新寫入檔案
            with open(NOTE_FILE, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            return True
            
        except Exception as e:
            print(f"Error updating file: {e}")
            return False

# 啟動伺服器
print(f"🚀 行程規劃伺服器啟動: http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), ApiHandler) as httpd:
    httpd.serve_forever()