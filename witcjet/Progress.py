from TikTokLive import TikTokLiveClient
from TikTokLive.events import GiftEvent
from flask import Flask, jsonify, send_from_directory, abort, request, Response
import re
import urllib.parse
import subprocess
import logging
import sys
import importlib
import shutil
import threading as _threading
import socket
import os
import threading
import time

USERNAME = "danulo.kruz"
# User-preferred default external IP to display
DEFAULT_IP = '159.224.180.180'

gift_data = {"rose": 0, "tiktok": 0}
timer_config = {
    "duration": 120, # 2 minutes
    "pause": 10,     # 10 seconds post-round
    "start_time": time.time(),
    "is_paused": False
}

app = Flask(__name__)

# runtime-configured target (can be set via /set-url)
target_config = {
    'url': None,
    'username': None,
    'type': None  # 'profile' | 'live' | 'short'
}

# Flag to prevent widget/gift processing until tunnel & delay complete
processing_enabled = False

@app.route("/")
def index():
    # Serve the extracted HTML file so widgets can be managed separately
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'prog.html')


@app.route('/prog')
def prog():
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'prog.html')


@app.route('/vip')
def vip():
    base = os.path.abspath(os.path.dirname(__file__))
    return send_from_directory(base, 'vip.html')

@app.route("/api/widget")
def widget():
    global gift_data
    # If processing isn't enabled yet, return neutral/default values so frontend
    # appears idle while the tunnel/warmup completes.
    if not processing_enabled:
        return jsonify({
            "left_percent": 50,
            "right_percent": 50,
            "rose_count": 0,
            "tiktok_count": 0,
            "timer_text": "STARTING...",
            "is_paused": True
        })
    now = time.time()
    elapsed = now - timer_config["start_time"]
    
    # Logic for round reset
    if not timer_config["is_paused"]:
        if elapsed >= timer_config["duration"]:
            timer_config["is_paused"] = True
            timer_config["start_time"] = now
            remaining = 0
        else:
            remaining = max(0, int(timer_config["duration"] - elapsed))
    else:
        if elapsed >= timer_config["pause"]:
            # RESET EVERYTHING
            gift_data = {"rose": 0, "tiktok": 0}
            timer_config["is_paused"] = False
            timer_config["start_time"] = now
            remaining = timer_config["duration"]
        else:
            remaining = 0

    # Format timer text
    if timer_config["is_paused"]:
        timer_text = "FINISH!"
    else:
        mins, secs = divmod(remaining, 60)
        timer_text = f"{mins:02d}:{secs:02d}"

    total = gift_data["rose"] + gift_data["tiktok"]
    if total > 0:
        left_percent = (gift_data["rose"] / total * 100)
        right_percent = 100 - left_percent
    else:
        left_percent = 50
        right_percent = 50
        
    return jsonify({
        "left_percent": left_percent,
        "right_percent": right_percent,
        "rose_count": gift_data["rose"],
        "tiktok_count": gift_data["tiktok"],
        "timer_text": timer_text,
        "is_paused": timer_config["is_paused"]
    })

def start_flask():
    # Silence the werkzeug access logs (GET /api/widget ...) shown at INFO level
    try:
        logging.getLogger('werkzeug').setLevel(logging.WARNING)
    except Exception:
        pass
    app.run(port=5000)


def start_ngrok_tunnel(port=5000):
    """Start an ngrok HTTP tunnel on the given port using pyngrok.

    If pyngrok isn't installed it will be installed automatically.
    Returns the public ngrok URL or None on failure.
    """
    try:
        from pyngrok import ngrok
    except Exception:
        try:
            print('pyngrok not found, installing...')
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyngrok'])
            from pyngrok import ngrok
        except Exception as e:
            print(f'Could not install pyngrok: {e}')
            return None

    try:
        # bind_tls=True creates an https tunnel
        tunnel = ngrok.connect(port, "http", bind_tls=True)
        public_url = tunnel.public_url
        print(f'ngrok tunnel established at: {public_url}')
        target_config['public_url'] = public_url
        return public_url
    except Exception as e:
        print(f'Failed to start ngrok tunnel: {e}')
        return None


def start_localtunnel(port=5000, install_if_missing=False):
    """Start localtunnel via `npx localtunnel --port <port>` and return the public URL.

    Requires Node.js and npx available. Returns (public_url, process) or (None, None).
    """
    # Check for node/npx
    npx = shutil.which('npx')
    node = shutil.which('node')
    if not npx or not node:
        print('localtunnel requires Node.js and npx; not found on PATH.')
        return None, None

    try:
        # Start localtunnel via npx; keep process running
        proc = subprocess.Popen([npx, 'localtunnel', '--port', str(port)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    except Exception as e:
        print(f'Failed to start localtunnel via npx: {e}')
        return None, None

    public_url = None

    # Read lines asynchronously until we find a URL or process exits
    def _read_lines():
        nonlocal public_url
        try:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                # localtunnel typically prints the URL; find first http
                if 'http' in line:
                    # extract first http... substring
                    idx = line.find('http')
                    candidate = line[idx:].split()[0]
                    if candidate.startswith('http'):
                        public_url = candidate
                        target_config['public_url'] = public_url
                        print(f'localtunnel established at: {public_url}')
                        break
        except Exception:
            pass

    t = _threading.Thread(target=_read_lines, daemon=True)
    t.start()

    # wait up to 8 seconds for URL
    waited = 0
    while waited < 8 and public_url is None and proc.poll() is None:
        time.sleep(0.5)
        waited += 0.5

    if public_url:
        # We intentionally display the user's preferred IP to avoid showing
        # the tunnel provider's backend IP (e.g., loca.lt). Use DEFAULT_IP.
        print(f'localtunnel established at: {public_url} ({DEFAULT_IP})')
        return public_url, proc
    else:
        # if process is still running but no URL, leave it running but return None
        if proc.poll() is None:
            print('localtunnel started but did not report URL in time.')
        else:
            print('localtunnel process exited without providing URL.')
        return None, proc


@app.route('/images/<path:filename>')
def images(filename):
    # Try static/ first, then project root — accepts images placed next to Progress.py
    base = os.path.abspath(os.path.dirname(__file__))
    static_dir = os.path.join(base, 'static')
    static_path = os.path.join(static_dir, filename)
    root_path = os.path.join(base, filename)
    if os.path.isfile(static_path):
        return send_from_directory(static_dir, filename)
    if os.path.isfile(root_path):
        return send_from_directory(base, filename)
    # Fallback: if requesting "rose.png" try "rosa.png" (common alternate name)
    if filename.lower() == 'rose.png':
        alt = 'rosa.png'
        static_alt = os.path.join(static_dir, alt)
        root_alt = os.path.join(base, alt)
        if os.path.isfile(static_alt):
            return send_from_directory(static_dir, alt)
        if os.path.isfile(root_alt):
            return send_from_directory(base, alt)
    abort(404)


@app.route('/proxy')
def proxy_to_public():
    """Proxy the stored public ngrok/localtunnel URL and add the header
    to skip the ngrok browser warning. Only proxies the saved `target_config['public_url']`.
    """
    pub = target_config.get('public_url')
    if not pub:
        return jsonify({'success': False, 'message': 'No public URL configured'}), 400

    # Only allow proxying to the exact stored public URL to avoid open proxy
    # Accept optional query param 'path' to append to the base public_url
    path = request.args.get('path', '')
    # Build target URL
    if path:
        if not pub.endswith('/') and not path.startswith('/'):
            target = pub + '/' + path
        else:
            target = pub + path
    else:
        target = pub

    # Ensure requests is available
    try:
        requests = importlib.import_module('requests')
    except Exception:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests'])
            requests = importlib.import_module('requests')
        except Exception as e:
            return jsonify({'success': False, 'message': f'requests not available: {e}'}), 500

    headers = {'ngrok-skip-browser-warning': 'true', 'User-Agent': request.headers.get('User-Agent', '')}
    try:
        r = requests.get(target, headers=headers, timeout=10)
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error fetching target: {e}'}), 502

    # Build response with same content-type
    content_type = r.headers.get('Content-Type', 'text/html')
    resp = Response(r.content, status=r.status_code, content_type=content_type)
    return resp


@app.route('/set-url', methods=['GET', 'POST'])
def set_url():
    """Accept a TikTok link via `url` param (GET or POST), validate and store it.

    Returns JSON {success: bool, message: str, username?: str}
    """
    val = request.values.get('url', '')
    if not val:
        return jsonify({'success': False, 'message': 'No url provided'}), 400

    url = val.strip()

    # If a local URL is provided (e.g. http://127.0.0.1:5000/...), allow specifying
    # username via query or form value: ?username=@user or ?target=@user
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname in ('127.0.0.1', 'localhost'):
        # Accept local URLs without requiring a username parameter.
        # If a username is provided via query/form we'll store it; otherwise store the URL.
        qs = urllib.parse.parse_qs(parsed.query)
        uname = None
        if 'username' in qs and qs['username']:
            uname = qs['username'][0]
        if not uname and 'target' in qs and qs['target']:
            uname = qs['target'][0]
        if not uname:
            uname = request.values.get('username') or request.values.get('target')

        target_config['url'] = url
        if uname:
            raw_at = re.match(r'^@?(?P<username>[A-Za-z0-9._-]{2,50})$', uname)
            if raw_at:
                username = raw_at.group('username')
                target_config['username'] = username
                target_config['type'] = 'profile'
                return jsonify({'success': True, 'message': 'Local URL accepted with provided username', 'username': username})
        # No username provided, but accept the local URL anyway
        target_config['username'] = None
        target_config['type'] = 'local'
        return jsonify({'success': True, 'message': 'Local URL accepted', 'username': None})

    # Patterns
    profile_re = re.compile(r'https?://(?:www\.)?tiktok\.com/@(?P<username>[^/?#]+)', re.I)
    live_re = re.compile(r'https?://(?:www\.)?tiktok\.com/@(?P<username>[^/?#]+)/live', re.I)
    short_re = re.compile(r'https?://vm\.tiktok\.com/[^/?#]+', re.I)

    m_live = live_re.search(url)
    m_profile = profile_re.search(url)
    m_short = short_re.search(url)

    if m_live:
        username = m_live.group('username')
        target_config['url'] = url
        target_config['username'] = username
        target_config['type'] = 'live'
        return jsonify({'success': True, 'message': 'Live URL accepted', 'username': username})
    if m_profile:
        username = m_profile.group('username')
        target_config['url'] = url
        target_config['username'] = username
        target_config['type'] = 'profile'
        return jsonify({'success': True, 'message': 'Profile URL accepted', 'username': username})
    if m_short:
        target_config['url'] = url
        target_config['username'] = None
        target_config['type'] = 'short'
        return jsonify({'success': True, 'message': 'Short tiktok URL accepted; may require manual resolution', 'username': None})

    # Also accept raw username (e.g., @username or username)
    raw_at = re.match(r'^@?(?P<username>[A-Za-z0-9._-]{2,50})$', url)
    if raw_at:
        username = raw_at.group('username')
        target_config['url'] = None
        target_config['username'] = username
        target_config['type'] = 'profile'
        return jsonify({'success': True, 'message': 'Username accepted', 'username': username})

    return jsonify({'success': False, 'message': 'Invalid TikTok URL or username format'}), 400

# TikTok Live client
client = TikTokLiveClient(unique_id=USERNAME)

@client.on(GiftEvent)
async def on_gift(event: GiftEvent):
    # Defensive attribute access (some library versions differ)
    name = getattr(event.gift, 'name', '') or ''
    gift_name = name.lower()
    gift_id = getattr(event.gift, 'id', None)
    # count may be 'count' or 'amount' depending on version
    count = getattr(event.gift, 'count', None)
    if count is None:
        count = getattr(event.gift, 'amount', 1)
    # Exact-match keywords (and emoji) for 'rose' and 'tiktok' gifts
    ROSE_KEYWORDS = ['rose', 'роза', 'розы', 'roses', '🌹']
    TIKTOK_KEYWORDS = ['tiktok', 'тикток', 'тик-ток', 'тик ток']

    # Normalize gift name for safe exact matching
    normalized = gift_name.strip().lower()
    # Keep letters/digits/underscore and spaces (retain Cyrillic by including range)
    normalized_alpha = re.sub(r"[^\w\sа-яё]", '', normalized)
    normalized_alpha = re.sub(r"\s+", ' ', normalized_alpha).strip()

    is_rose = False
    is_tiktok = False

    # Emoji exact-match
    if gift_name.strip() == '🌹':
        is_rose = True

    # Exact textual matches (either raw normalized or alpha-only normalized)
    if normalized in ROSE_KEYWORDS or normalized_alpha in ROSE_KEYWORDS:
        is_rose = True
    if normalized in TIKTOK_KEYWORDS or normalized_alpha in TIKTOK_KEYWORDS:
        is_tiktok = True

    # ID override for known rose gift IDs
    if gift_id is not None and gift_id in (1,):
        is_rose = True

    # Only increment counters when there's an exact match to the respective keyword lists.
    if is_rose:
        gift_data["rose"] += count
    elif is_tiktok:
        gift_data["tiktok"] += count
    else:
        # Ignore other gifts (do not classify them as rose or tiktok)
        pass
    # Debug logs removed per user request

if __name__ == "__main__":
    # Запускаем Flask в отдельном потоке
    threading.Thread(target=start_flask, daemon=True).start()

    print("Widget available at: http://127.0.0.1:5000")

    # Try to start a tunnel. Prefer localtunnel (no interstitial); fall back to ngrok.
    public_url = None
    lt_proc = None
    try:
        public_url, lt_proc = start_localtunnel(5000)
    except Exception as e:
        print(f'Error starting localtunnel: {e}')

    if not public_url:
        try:
            public_url = start_ngrok_tunnel(5000)
        except Exception as e:
            print(f'Error starting ngrok: {e}')

    if not public_url:
        print('No public tunnel available. Gifts processing will NOT start until a public URL is present.')
        print('Widget is available locally at http://127.0.0.1:5000')
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            print('Shutting down (no public URL).')
    else:
        # show public url and resolved IP if possible
        try:
            host = urllib.parse.urlparse(public_url).hostname
            host_ip = socket.gethostbyname(host) if host else None
        except Exception:
            host_ip = None
        # Always display the user's preferred external IP to avoid confusion
        print(f'Public URL: {public_url} ({DEFAULT_IP})')

        # wait 10 seconds after tunnel established before starting client
        print('Waiting 10 seconds before starting gift processing...')
        # Ensure frontend shows idle state while we wait
        try:
            target_config['public_url'] = public_url
            if not target_config.get('url'):
                target_config['url'] = public_url
                target_config['type'] = 'public'
        except Exception:
            pass

        time.sleep(10)
        # enable processing and reset the round timer so widget begins fresh
        processing_enabled = True
        try:
            timer_config['is_paused'] = False
            timer_config['start_time'] = time.time()
        except Exception:
            pass

        # Запускаем TikTok Live Client with interactive retry and periodic auto-checks.
        # Behavior:
        # - Try to run `client.run()` once.
        # - If it fails (user offline), prompt the operator to start 3 attempts
        #   spaced 60s apart by answering 'y'. If operator answers 'n', the
        #   script will wait 120s and automatically try again (repeat forever
        #   without exiting the script).
        connected = False
        while True:
            try:
                client.run()
                # If client.run() returns without exception, the client stopped
                # (stream ended or disconnected). Break loop and finish.
                connected = True
                break
            except Exception as e:
                print(f'TikTok Error: {e}')
                print('Could not start TikTok client (user may be offline).')

                # Ask the operator whether to attempt three rapid retries.
                try:
                    resp = input("Start 3 connection attempts (1 minute apart)? (y/n): ").strip().lower()
                except Exception:
                    # If stdin isn't available (e.g., running as a service), fall back
                    # to automatic 2-minute retries.
                    resp = 'n'

                if resp == 'y':
                    # Try up to 3 times, 60s apart
                    for attempt in range(1, 4):
                        print(f'Attempt {attempt}/3 to connect...')
                        try:
                            client.run()
                            connected = True
                            break
                        except Exception as e2:
                            print(f'Attempt {attempt} failed: {e2}')
                            if attempt < 3:
                                print('Waiting 60 seconds before next attempt...')
                                time.sleep(60)
                    if connected:
                        break
                    else:
                        print('All 3 attempts failed. Will resume periodic auto-checks every 2 minutes.')
                        time.sleep(120)
                        continue
                else:
                    # Operator declined manual retries; auto-check every 2 minutes
                    print('Skipping manual attempts. Will auto-check every 2 minutes.')
                    time.sleep(120)
                    continue
