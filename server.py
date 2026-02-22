import http.server
import socketserver
import json
import re
import time
import uuid
import urllib.parse
import os
import shutil
from datetime import datetime
from http import cookies

# --- 設定區 ---
PORT = 8090
PASSWORD = "0424"
NOTE_FILE = 'notes.md'
MAX_ATTEMPTS = 3
LOCKOUT_TIME = 3600

sessions = set()
login_attempts = {}

# ★★★ 新增：自動備份機制 ★★★
def backup_notes():
    if not os.path.exists(NOTE_FILE): return
    backup_dir = 'backups'
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(backup_dir, f'notes_{timestamp}.md')
    shutil.copy2(NOTE_FILE, backup_path)
    print(f"✅ 已自動備份至: {backup_path}")

class FullHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/login':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(self.get_login_page().encode('utf-8'))
            return
        if not self.check_auth():
            self.redirect_to_login()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/login':
            self.handle_login()
            return
        if not self.check_auth():
            self.send_error(403, "Unauthorized")
            return

        if self.path == '/api/update-day':
            self.handle_update_day()
            return
        if self.path == '/api/update-content':
            self.handle_update_content()
            return
        if self.path == '/api/update-settings':
            self.handle_update_settings()
            return
        if self.path == '/api/update-order':
            self.handle_update_order()
            return

    def check_auth(self):
        if 'Cookie' in self.headers:
            c = cookies.SimpleCookie(self.headers['Cookie'])
            if 'session_id' in c:
                return c['session_id'].value in sessions
        return False

    def redirect_to_login(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(self.get_login_page().encode('utf-8'))

    def handle_login(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        params = urllib.parse.parse_qs(body)
        input_password = params.get('password', [''])[0]
        client_ip = self.client_address[0]

        if self.is_locked_out(client_ip):
            self.send_error(403, "已被鎖定，請稍後再試。")
            return

        if input_password == PASSWORD:
            if client_ip in login_attempts: del login_attempts[client_ip]
            session_id = str(uuid.uuid4())
            sessions.add(session_id)
            self.send_response(302)
            c = cookies.SimpleCookie()
            c['session_id'] = session_id
            c['session_id']['path'] = '/'
            for line in c.output().split('\r\n'):
                self.send_header(line.split(':')[0], line.split(':')[1].strip())
            self.send_header('Location', '/')
            self.end_headers()
        else:
            self.record_fail(client_ip)
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            remaining = MAX_ATTEMPTS - login_attempts.get(client_ip, {}).get('count', 0)
            msg = f"密碼錯誤！剩餘 {remaining} 次" if remaining > 0 else "已鎖定 1 小時"
            self.wfile.write(self.get_login_page(msg).encode('utf-8'))

    def handle_update_settings(self):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            if self.update_markdown_settings(data.get('start_date', ''), str(data.get('total_days', '8'))):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            else:
                self.send_error(500, "Update settings failed")
        except Exception as e:
            self.send_error(500, str(e))

    def update_markdown_settings(self, start_date, total_days):
        try:
            backup_notes() # ★ 觸發備份
            with open(NOTE_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
            settings_block = f"# [設定] 旅遊資訊\n> 開始日期: {start_date}\n> 總天數: {total_days}\n"
            if re.search(r'^# \[設定\] 旅遊資訊', content, flags=re.MULTILINE):
                content = re.sub(r'^# \[設定\] 旅遊資訊.*?(?=\n# \[|\Z)', settings_block.strip() + "\n", content, flags=re.DOTALL | re.MULTILINE)
            else:
                content = settings_block + "\n" + content
            with open(NOTE_FILE, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        except Exception as e:
            return False

    def handle_update_order(self):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            day = data.get('day')
            order_list = data.get('order', [])
            order_str = ",".join(order_list)
            
            backup_notes() # ★ 觸發備份
            with open(NOTE_FILE, 'r', encoding='utf-8') as f:
                content = f.read()

            if not re.search(r'^# \[設定\] 旅遊資訊', content, flags=re.MULTILINE):
                content = f"# [設定] 旅遊資訊\n\n" + content

            settings_match = re.search(r'^# \[設定\] 旅遊資訊.*?(?=\n# \[|\Z)', content, flags=re.DOTALL | re.MULTILINE)
            if settings_match:
                settings_block = settings_match.group(0)
                order_line = f"> {day}_Order: {order_str}"
                
                if re.search(rf'^> {day}_Order:.*', settings_block, flags=re.IGNORECASE | re.MULTILINE):
                    new_settings = re.sub(rf'^> {day}_Order:.*', order_line, settings_block, flags=re.IGNORECASE | re.MULTILINE)
                else:
                    new_settings = settings_block.strip() + f"\n{order_line}\n"
                    
                content = content.replace(settings_block, new_settings)
                
            with open(NOTE_FILE, 'w', encoding='utf-8') as f:
                f.write(content)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
        except Exception as e:
            self.send_error(500, str(e))

    def handle_update_day(self):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            if self.update_markdown_day(data.get('name'), data.get('day')):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            else:
                self.send_error(500, "Update failed logic")
        except Exception as e:
            self.send_error(500, str(e))

    def update_markdown_day(self, target_name, new_day):
        try:
            backup_notes() # ★ 觸發備份
            with open(NOTE_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            new_lines = []
            in_target_block = False
            day_updated = False
            name_pattern = re.compile(rf'^#\s\[.*?\]\s*{re.escape(target_name)}\s*$')

            for i, line in enumerate(lines):
                if line.startswith('# ['):
                    in_target_block = bool(name_pattern.match(line.strip()))
                    day_updated = False if in_target_block else day_updated
                if in_target_block:
                    if re.match(r'^>\s*(Day|行程)[:：]', line.strip(), re.IGNORECASE):
                        if new_day and new_day != '0': new_lines.append(f"> Day: {new_day}\n")
                        day_updated = True
                        continue
                    is_end_of_block = (i + 1 < len(lines) and (lines[i+1].startswith('#') or lines[i+1].startswith('---')))
                    if not day_updated and is_end_of_block and new_day and new_day != '0':
                        if not line.strip(): 
                             new_lines.append(f"> Day: {new_day}\n")
                             day_updated = True
                new_lines.append(line)
            with open(NOTE_FILE, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            return True
        except Exception:
            return False

    def handle_update_content(self):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            if self.update_markdown_content(data.get('name'), data.get('todo', ''), data.get('notes', '')):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode('utf-8'))
            else:
                self.send_error(500, "Update content failed")
        except Exception as e:
            self.send_error(500, str(e))

    def update_markdown_content(self, target_name, new_todo, new_notes):
        try:
            backup_notes() # ★ 觸發備份
            with open(NOTE_FILE, 'r', encoding='utf-8') as f:
                content = f.read()

            blocks = re.split(r'(?=^#\s\[)', content, flags=re.MULTILINE)
            new_blocks = []
            name_pattern = re.compile(rf'^#\s\[.*?\]\s*{re.escape(target_name)}\s*$', re.MULTILINE)

            for block in blocks:
                if not block.strip():
                    new_blocks.append(block)
                    continue

                if name_pattern.search(block):
                    lines = block.splitlines()
                    meta_lines = []
                    other_lines = []
                    current_section = 'meta'
                    
                    for line in lines:
                        if line.startswith('### 想做什麼'): current_section = 'todo'
                        elif line.startswith('### 備註'): current_section = 'notes'
                        elif line.startswith('### ') or line.startswith('#### '):
                            current_section = 'other'
                            other_lines.append(line)
                        else:
                            if current_section == 'meta': meta_lines.append(line)
                            elif current_section == 'other': other_lines.append(line)
                                
                    res = "\n".join(meta_lines).strip() + "\n\n"
                    if new_todo.strip(): res += f"### 想做什麼\n{new_todo.strip()}\n\n"
                    if new_notes.strip(): res += f"### 備註\n{new_notes.strip()}\n\n"
                    if other_lines: res += "\n".join(other_lines).strip() + "\n\n"
                    new_blocks.append(res)
                else:
                    new_blocks.append(block)

            with open(NOTE_FILE, 'w', encoding='utf-8') as f:
                f.write("".join(new_blocks))
            return True
        except Exception as e:
            return False

    def is_locked_out(self, ip):
        record = login_attempts.get(ip)
        if record and time.time() < record.get('lockout_until', 0): return True
        if record and record.get('lockout_until', 0) > 0: del login_attempts[ip]
        return False

    def record_fail(self, ip):
        if ip not in login_attempts: login_attempts[ip] = {'count': 0, 'lockout_until': 0}
        login_attempts[ip]['count'] += 1
        if login_attempts[ip]['count'] >= MAX_ATTEMPTS: login_attempts[ip]['lockout_until'] = time.time() + LOCKOUT_TIME

    def get_login_page(self, error=""):
        return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f4f7f6;}}.box{{background:white;padding:2rem;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1);text-align:center;}}input{{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;box-sizing:border-box;}}button{{width:100%;padding:10px;background:#2c3e50;color:white;border:none;cursor:pointer;}}.error{{color:red;margin-bottom:10px;}}</style></head><body><div class="box"><h2>🔒 九州地圖登入</h2>{f'<div class="error">{error}</div>' if error else ''}<form method="POST" action="/login"><input type="password" name="password" placeholder="密碼" autofocus><button>登入</button></form></div></body></html>"""

print(f"🚀 安全伺服器啟動 Port {PORT} (密碼: {PASSWORD})")
with socketserver.ThreadingTCPServer(("", PORT), FullHandler) as httpd:
    httpd.serve_forever()