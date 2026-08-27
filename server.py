#!/usr/bin/env python3
"""
かんたん3D CAD ― 動作確認用の静的ファイルサーバー。

Three.js を ES Module（importmap）で読み込むため file:// では動かない。
必ずこのサーバー経由で開くこと。

追加エンドポイント:
  /server-ip … このPCのLAN上のIPv4アドレスを返す（スマホで開くQR用）

使い方:
    python server.py [port]   # 省略時は 8080
"""
import http.server
import socket
import sys
from urllib.parse import urlparse


def get_local_ip() -> str:
    """LAN上のIPv4アドレスを取得する（実際には接続しない）"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path == '/server-ip':
            data = get_local_ip().encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def end_headers(self):
        # 開発中に古いHTML/CSSがキャッシュされて混乱しないようにする
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    ip = get_local_ip()
    print(f'Serving HTTP on 0.0.0.0 port {port}')
    print(f'  PC     : http://localhost:{port}/index.html')
    print(f'  スマホ : http://{ip}:{port}/index.html')

    # ThreadingHTTPServer: HTML＋フォント等の同時読み込みで詰まらないようにする
    httpd = http.server.ThreadingHTTPServer(('', port), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
