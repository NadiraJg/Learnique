"""Tiny local web server + optional Langflow proxy (Python standard library only).

Run: python server.py
Never exposes LANGFLOW_API_KEY to the browser or commits it to GitHub.
"""
import json
import os
import re
import sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


def load_dotenv():
    """Small .env parser so students don't need to install pip packages."""
    path = ROOT / '.env'
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


load_dotenv()
LANGFLOW_URL = os.environ.get('LANGFLOW_URL', '').rstrip('/')
FLOW_ID = os.environ.get('LANGFLOW_FLOW_ID', '')
API_KEY = os.environ.get('LANGFLOW_API_KEY', '')
PORT = int(os.environ.get('PORT', '8000'))
LIVE = bool(LANGFLOW_URL and FLOW_ID)


def extract_agent_text(obj):
    """Read typical /api/v1/run/{flow_id} nested Chat Output result.

    Logs safe structural diagnostics to stderr when the response shape is
    unexpected so developers can diagnose Langflow misconfiguration without
    any API keys, tokens, or student content appearing in the output.
    """
    try:
        value = obj['outputs'][0]['outputs'][0]['results']['message']
        if isinstance(value, dict):
            return value.get('text') or value.get('message') or ''
        if isinstance(value, str):
            return value
        # Extraction reached an unexpected leaf type — safe to log its type only.
        print(
            f'[learnique] extract_agent_text: unexpected message value type '
            f'{type(value).__name__!r}. Check the Chat Output node connection.',
            file=sys.stderr,
        )
    except (KeyError, IndexError, TypeError) as exc:
        # Log only the exception type and safe structural hints — never values.
        top_keys = list(obj.keys()) if isinstance(obj, dict) else f'<{type(obj).__name__}>'
        outputs_hint = ''
        if isinstance(obj, dict) and 'outputs' in obj:
            outer = obj['outputs']
            if isinstance(outer, list) and outer:
                inner = outer[0]
                if isinstance(inner, dict):
                    outputs_hint = f', outputs[0] keys={list(inner.keys())}'
        print(
            f'[learnique] extract_agent_text failed ({type(exc).__name__}). '
            f'Top-level keys={top_keys}{outputs_hint}. '
            f'Verify the flow has a Chat Output node connected to the agent.',
            file=sys.stderr,
        )
    return ''


def extract_note_suggestion(message):
    """Parse an optional agent response directive; never save a note automatically.

    The regular Langflow Run API returns the final Chat Output text, not a
    guaranteed list of tool trace messages. After invoking BUILD_NOTE, the
    agent can include a machine-readable NOTE directive in its final text.
    """
    pattern = r"\[\[LEARNIQUE_NOTE\]\](.*?)\[\[/LEARNIQUE_NOTE\]\]"
    match = re.search(pattern, message, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return message, None

    visible_text = (message[:match.start()] + message[match.end():]).strip()
    try:
        body = json.loads(match.group(1).strip())
        note = body.get('text') if isinstance(body, dict) else None
        simple = body.get('simple_text', '') if isinstance(body, dict) else ''
        if not isinstance(note, str) or not note.strip():
            return visible_text, None
        if not isinstance(simple, str):
            simple = ''
        return visible_text, {
            'text': note.strip()[:500],
            'simple_text': simple.strip()[:500],
            'saved': False,
        }
    except (ValueError, TypeError):
        # Never expose markup or parsing details to students.
        return visible_text, None


# The hackathon MVP visualizes a single known 7-node Binary Search Tree.
# Reject invented or mismatched orders rather than mis-teaching traversal.
ALLOWED_ORDERS = {
    'inorder': [2, 4, 6, 8, 10, 12, 14],
    'preorder': [8, 4, 2, 6, 12, 10, 14],
    'postorder': [2, 6, 4, 10, 14, 12, 8],
}


def extract_visualization_request(message):
    """Parse the optional agent visualization directive in its final answer.

    Like Smart Notes in v1.2, this reads a final-answer marker, not raw tool traces.
    Callers should only trust the request after validating it against our known tree.
    """
    pattern = r"\[\[LEARNIQUE_VISUALIZATION\]\](.*?)\[\[/LEARNIQUE_VISUALIZATION\]\]"
    match = re.search(pattern, message, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return message, None

    # Never expose internal machine-readable markers as regular chat output.
    visible_text = (message[:match.start()] + message[match.end():]).strip()
    try:
        data = json.loads(match.group(1).strip())
        if not isinstance(data, dict):
            return visible_text, None
        if data.get('visualization_type') != 'bst_traversal':
            return visible_text, None
        traversal = data.get('traversal')
        order = data.get('visit_order')
        # Strict equality with expected sequence, including length and order.
        if not isinstance(traversal, str) or traversal not in ALLOWED_ORDERS:
            return visible_text, None
        if not isinstance(order, list) or order != ALLOWED_ORDERS[traversal]:
            return visible_text, None
        if any(type(node) is not int for node in order):
            return visible_text, None
        return visible_text, {
            'visualization_type': 'bst_traversal',
            'traversal': traversal,
            'visit_order': order,
            'interactive': True,
        }
    except (ValueError, TypeError):
        return visible_text, None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/status':
            return self.json_response(200, {'mode': 'langflow' if LIVE else 'demo'})
        # Only expose web assets. Never serve .env, source code, or hidden files,
        # including through encoded paths or traversal attempts.
        public_files = {
            '/': '/static/index.html',
            '/static/index.html': '/static/index.html',
            '/static/app.js': '/static/app.js',
            '/static/styles.css': '/static/styles.css',
        }
        if path not in public_files:
            return self.json_response(404, {'error': 'Not found'})
        self.path = public_files[path]
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != '/api/chat':
            return self.json_response(404, {'error': 'Not found'})
        if not LIVE:
            return self.json_response(503, {'error': 'Langflow is not connected. Use the built-in demo tools.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 20000:
                return self.json_response(400, {'error': 'Invalid request length'})
            body = json.loads(self.rfile.read(length))
            message = body.get('message', '')
            session = body.get('session_id', '')
            if not isinstance(message, str) or not message.strip() or len(message) > 1600:
                return self.json_response(400, {'error': 'Invalid message'})
            if not isinstance(session, str) or len(session) > 120:
                return self.json_response(400, {'error': 'Invalid session ID'})
            # Restrict server URL scheme; never accept a URL from an untrusted request.
            parsed = urlparse(LANGFLOW_URL)
            if parsed.scheme not in ('http', 'https') or not parsed.netloc:
                return self.json_response(500, {'error': 'Invalid LANGFLOW_URL'})
            payload = json.dumps({'input_value': message.strip(), 'session_id': session, 'input_type': 'chat', 'output_type': 'chat'}).encode('utf-8')
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
            if API_KEY:
                headers['x-api-key'] = API_KEY
            req = Request(f'{LANGFLOW_URL}/api/v1/run/{FLOW_ID}', data=payload, headers=headers, method='POST')
            with urlopen(req, timeout=45) as resp:
                result = json.loads(resp.read(1500000))
            text = extract_agent_text(result)
            if not text:
                return self.json_response(502, {'error': 'Flow ran but no Chat Output text was found. Check the flow connections.'})
            text, suggestion = extract_note_suggestion(text)
            text, visualization = extract_visualization_request(text)
            return self.json_response(200, {
                'text': text,
                'note_suggestion': suggestion,
                'visualization_request': visualization,
            })
        except HTTPError as exc:
            return self.json_response(502, {'error': f'Langflow returned HTTP {exc.code}. Check the flow ID, credentials, and flow status.'})
        except (URLError, TimeoutError):
            return self.json_response(502, {'error': 'Langflow is unreachable. Check its URL and whether it is running.'})
        except (ValueError, TypeError, json.JSONDecodeError):
            return self.json_response(400, {'error': 'Invalid JSON request or response'})

    def json_response(self, code, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)


if __name__ == '__main__':
    print('Learnique:', f'http://127.0.0.1:{PORT}')
    print('Mode:', 'LANGFLOW (real API)' if LIVE else 'DEMO (built-in, no API costs)')
    print('Stop server: Ctrl+C')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
