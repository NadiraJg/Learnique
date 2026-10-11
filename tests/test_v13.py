"""Run from the project directory: python -m unittest discover -s tests -v"""
import io
import json
import sys
import unittest
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.request import Request, urlopen
from unittest.mock import patch

import server


class VisualizationParsingTests(unittest.TestCase):
    def test_valid_traversals(self):
        for kind, order in server.ALLOWED_ORDERS.items():
            with self.subTest(kind=kind):
                raw = f'Helpful explanation.\n[[LEARNIQUE_VISUALIZATION]]\n{json.dumps({"visualization_type":"bst_traversal","traversal":kind,"visit_order":order})}\n[[/LEARNIQUE_VISUALIZATION]]'
                clean, viz = server.extract_visualization_request(raw)
                self.assertEqual(clean, 'Helpful explanation.')
                self.assertEqual(viz['traversal'], kind)
                self.assertEqual(viz['visit_order'], order)

    def test_wrong_order_not_accepted(self):
        bad = '[[LEARNIQUE_VISUALIZATION]]{"visualization_type":"bst_traversal","traversal":"preorder","visit_order":[2,4,6,8,10,12,14]}[[/LEARNIQUE_VISUALIZATION]]'
        clean, viz = server.extract_visualization_request('Hi!\n'+bad)
        self.assertEqual(clean, 'Hi!')
        self.assertIsNone(viz)

    def test_malformed_block(self):
        bad = '[[LEARNIQUE_VISUALIZATION]]{oops}[[/LEARNIQUE_VISUALIZATION]]'
        clean, viz = server.extract_visualization_request('Hello '+bad)
        self.assertEqual(clean, 'Hello')
        self.assertIsNone(viz)

    def test_note_and_visualization_together(self):
        raw = ('Hello!\n[[LEARNIQUE_NOTE]]{"text":"Study carefully","simple_text":"Belajar"}[[/LEARNIQUE_NOTE]]'
               '[[LEARNIQUE_VISUALIZATION]]{"visualization_type":"bst_traversal","traversal":"postorder","visit_order":[2,6,4,10,14,12,8]}[[/LEARNIQUE_VISUALIZATION]]')
        text, note=server.extract_note_suggestion(raw)
        text, viz=server.extract_visualization_request(text)
        self.assertEqual(text, 'Hello!')
        self.assertEqual(note['text'], 'Study carefully')
        self.assertEqual(viz['traversal'], 'postorder')


class ApiTests(unittest.TestCase):
    def test_hidden_files_not_exposed(self):
        from urllib.error import HTTPError
        httpd=ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread=Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            for path in ['/server.py','/.env','/%2Eenv','/langflow/SETUP.md']:
                with self.subTest(path=path):
                    with self.assertRaises(HTTPError) as ctx:
                        urlopen(f'http://127.0.0.1:{httpd.server_port}{path}', timeout=5)
                    self.assertEqual(ctx.exception.code,404)
        finally:
            httpd.shutdown()
            thread.join(timeout=3)
            httpd.server_close()

    def test_response_structure_end_to_end(self):
        agent_output = ('Try visiting the root first.\n'
                        '[[LEARNIQUE_NOTE]]{"text":"Preorder root first","simple_text":"Root dulu"}[[/LEARNIQUE_NOTE]]'
                        '[[LEARNIQUE_VISUALIZATION]]{"visualization_type":"bst_traversal","traversal":"preorder","visit_order":[8,4,2,6,12,10,14]}[[/LEARNIQUE_VISUALIZATION]]')
        raw = json.dumps({'outputs':[{'outputs':[{'results':{'message':{'text':agent_output}}}]}]}).encode()

        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, *_): return raw

        httpd = ThreadingHTTPServer(('127.0.0.1',0), server.Handler)
        thread = Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        old = server.LIVE, server.FLOW_ID, server.LANGFLOW_URL, server.API_KEY
        try:
            server.LIVE=True
            server.FLOW_ID='testflow'
            server.LANGFLOW_URL='http://127.0.0.1:7860'
            server.API_KEY='test-key-do-not-use'
            with patch.object(server, 'urlopen', return_value=FakeResponse()) as mocked:
                req = Request(f'http://127.0.0.1:{httpd.server_port}/api/chat',
                              data=json.dumps({'message':'show preorder','session_id':'test'}).encode(),
                              headers={'Content-Type':'application/json'}, method='POST')
                with urlopen(req, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    body=json.load(response)
                self.assertEqual(body['text'], 'Try visiting the root first.')
                self.assertEqual(body['note_suggestion']['text'], 'Preorder root first')
                self.assertEqual(body['visualization_request']['visit_order'], [8,4,2,6,12,10,14])
                sent=mocked.call_args.args[0]
                self.assertEqual(sent.headers['X-api-key'], 'test-key-do-not-use')
        finally:
            server.LIVE, server.FLOW_ID, server.LANGFLOW_URL, server.API_KEY=old
            httpd.shutdown()
            thread.join(timeout=3)
            httpd.server_close()

class ExtractAgentTextTests(unittest.TestCase):
    """Verify extract_agent_text return values and safe stderr diagnostics."""

    def _valid_response(self, text):
        """Build the canonical Langflow /api/v1/run response shape."""
        return {'outputs': [{'outputs': [{'results': {'message': {'text': text}}}]}]}

    # ------------------------------------------------------------------ #
    # Successful extraction — no stderr output expected                   #
    # ------------------------------------------------------------------ #

    def test_valid_text_field(self):
        result = server.extract_agent_text(self._valid_response('Hello world'))
        self.assertEqual(result, 'Hello world')

    def test_valid_message_field_fallback(self):
        """When 'text' is absent the function falls back to 'message'."""
        obj = {'outputs': [{'outputs': [{'results': {'message': {'message': 'Fallback'}}}]}]}
        self.assertEqual(server.extract_agent_text(obj), 'Fallback')

    def test_valid_string_message(self):
        """Plain string at message position is returned directly."""
        obj = {'outputs': [{'outputs': [{'results': {'message': 'Plain string'}}]}]}
        self.assertEqual(server.extract_agent_text(obj), 'Plain string')

    # ------------------------------------------------------------------ #
    # Missing / mismatched keys — should return '' and log to stderr      #
    # ------------------------------------------------------------------ #

    def test_missing_outputs_key_returns_empty(self):
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            result = server.extract_agent_text({'wrong_key': []})
        self.assertEqual(result, '')

    def test_missing_outputs_key_logs_top_level_keys(self):
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            server.extract_agent_text({'wrong_key': [], 'also_wrong': 1})
        log = buf.getvalue()
        self.assertIn('[learnique]', log)
        self.assertIn('wrong_key', log)
        self.assertIn('also_wrong', log)
        self.assertNotIn('student', log.lower())   # no conversation content

    def test_empty_outputs_list_returns_empty(self):
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            result = server.extract_agent_text({'outputs': []})
        self.assertEqual(result, '')
        self.assertIn('[learnique]', buf.getvalue())

    def test_missing_results_key_logs_inner_keys(self):
        """Logs outputs[0] keys so the developer can see which node is missing."""
        obj = {'outputs': [{'outputs': [{'no_results_here': {}}]}]}
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            server.extract_agent_text(obj)
        log = buf.getvalue()
        self.assertIn('outputs[0] keys', log)

    def test_non_dict_response_returns_empty(self):
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            result = server.extract_agent_text([1, 2, 3])
        self.assertEqual(result, '')
        self.assertIn('<list>', buf.getvalue())

    def test_none_response_returns_empty(self):
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            result = server.extract_agent_text(None)
        self.assertEqual(result, '')
        self.assertIn('[learnique]', buf.getvalue())

    def test_unexpected_message_type_logs_type_name(self):
        """A non-string, non-dict message value logs its type without its content."""
        obj = {'outputs': [{'outputs': [{'results': {'message': 42}}]}]}
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            result = server.extract_agent_text(obj)
        self.assertEqual(result, '')
        log = buf.getvalue()
        self.assertIn('int', log)
        # The raw value (42) must not appear so we can be sure content isn't logged.
        self.assertNotIn('42', log)

    def test_no_stderr_on_success(self):
        """Successful extraction must produce zero stderr output."""
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            server.extract_agent_text(self._valid_response('All good'))
        self.assertEqual(buf.getvalue(), '')

    def test_log_never_contains_api_key_shaped_content(self):
        """Even with a fabricated key-like structure in response, keys stay out of logs."""
        obj = {'outputs': [{'outputs': [{'results': {'message': {'api_key': 'sk-secret'}}}]}]}
        buf = io.StringIO()
        with patch('sys.stderr', buf):
            server.extract_agent_text(obj)
        # Success path: no stderr at all (the key is in 'text'/'message' fallback
        # position, but the dict has neither 'text' nor 'message' so returns '').
        # Either way the raw value 'sk-secret' must not reach stderr.
        self.assertNotIn('sk-secret', buf.getvalue())


if __name__ == '__main__':
    unittest.main()
