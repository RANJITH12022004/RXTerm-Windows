# backend/ai_bridge.py
import hashlib
import json
import asyncio
import os

import aiosqlite
from dotenv import load_dotenv
from google import generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))


def use_demo_nl_mode() -> bool:
    flag = os.getenv('RXTERM_NL_DEMO', '').strip().lower() in ('1', 'true', 'yes')
    key = (os.getenv('GEMINI_API_KEY') or '').strip()
    return flag or not key


class AIBridge:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        self._tokens = 15  # free tier: 15 req/min
        self._lock = asyncio.Lock()
        self._token_reset_task = None

    def _ensure_reset_task_started(self):
        if self._token_reset_task is not None:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        self._token_reset_task = loop.create_task(self._reset_tokens())

    async def _reset_tokens(self):
        while True:
            await asyncio.sleep(60)
            async with self._lock:
                self._tokens = 15

    async def _cached_call(self, fn_name: str, prompt: str) -> dict:
        self._ensure_reset_task_started()

        key = hashlib.sha256(f'{fn_name}:{prompt}'.encode()).hexdigest()
        async with aiosqlite.connect('rxterm.db') as db:
            await db.execute('CREATE TABLE IF NOT EXISTS ai_cache (key TEXT PRIMARY KEY, result TEXT)')
            row = await (await db.execute('SELECT result FROM ai_cache WHERE key=?', (key,))).fetchone()
            if row:
                return json.loads(row[0])

        async with self._lock:
            if self._tokens <= 0:
                await asyncio.sleep(4)
            self._tokens -= 1

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, lambda: self.model.generate_content(prompt))
        text = (response.text or '').strip().lstrip('```json').rstrip('```').strip()
        result = json.loads(text)

        async with aiosqlite.connect('rxterm.db') as db:
            await db.execute('INSERT OR REPLACE INTO ai_cache VALUES (?,?)', (key, json.dumps(result)))
            await db.commit()
        return result

    async def nl_to_command(self, query: str, context: dict) -> dict:
        if use_demo_nl_mode():
            from nl_demo import nl_to_command_demo

            return await nl_to_command_demo(query, context)
        from nl_demo import INTENT_STATUS, build_ai_transcript

        prompt = (
            f'You are a Windows shell expert. '
            f"OS: {context.get('os_version', 'Windows 11')}. "
            f"Shell: {context.get('shell_name', 'PowerShell')}. "
            f"CWD: {context.get('cwd', '.')}. "
            f"Recent: {context.get('recent_history', '')}. "
            f'Convert to single shell command. '
            f'Also set intent to a short human-readable label (e.g. Directory Analysis, Network Diagnostics) '
            f'and intent_status to one dramatic status line (e.g. Scanning directory structure...). '
            f'JSON only, no markdown: {{"command":"...","explanation":"...","intent":"...","intent_status":"..."}}. '
            f'Request: {query}'
        )
        result = await self._cached_call('nl_to_command', prompt)
        intent = (result.get('intent') or '').strip() or 'Unknown'
        ist = (result.get('intent_status') or '').strip() or INTENT_STATUS.get(
            intent, 'Processing request...'
        )
        result['intent'] = intent
        result['intent_status'] = ist
        if not (result.get('ai_transcript') or '').strip():
            result['ai_transcript'] = build_ai_transcript(intent, ist)
        return result

    async def explain_error(self, command: str, exit_code: int, stderr: str, context: dict) -> dict:
        prompt = (
            f'Windows shell command failed: {command}. '
            f'Exit code: {exit_code}. Stderr: {stderr[:500]}. '
            f'Explain in 2 sentences and provide one corrected command. '
            f'JSON only: {{"explanation":"...","suggested_command":"..."}}'
        )
        return await self._cached_call('explain_error', prompt)

    async def explain_command(self, command: str) -> dict:
        prompt = (
            f'Explain this Windows shell command flag by flag: {command}. '
            f'JSON: {{"breakdown":"...","example_output":"...","common_mistakes":"..."}}'
        )
        return await self._cached_call('explain_command', prompt)

    async def suggest_completion(self, query: str, context: dict) -> dict:
        query = (query or '').strip()
        if not query:
            return {'query': '', 'items': []}
        if use_demo_nl_mode():
            hints = []
            low = query.lower()
            if low.startswith('git '):
                hints = ['git status', 'git diff', 'git log --oneline']
            elif low.startswith('cd '):
                hints = ['cd ..', 'cd ~', 'cd .']
            elif low.startswith('ip'):
                hints = ['ipconfig', 'ipconfig /all', 'ipconfig /flushdns']
            else:
                hints = ['dir', 'whoami', 'systeminfo', 'tasklist']
            return {'query': query, 'items': [{'value': h, 'source': 'ai'} for h in hints]}

        prompt = (
            f"You are a Windows shell autocomplete engine. "
            f"OS: {context.get('os_version', 'Windows 11')}. "
            f"Shell: {context.get('shell_name', 'PowerShell')}. "
            f"CWD: {context.get('cwd', '.')}. "
            f"Recent: {context.get('recent_history', '')}. "
            f'Given partial command: "{query}" '
            f'Return JSON only: {{"items":[{{"value":"...","source":"ai"}}]}} with max 5 items.'
        )
        result = await self._cached_call('suggest_completion', prompt)
        items = result.get('items') if isinstance(result, dict) else []
        if not isinstance(items, list):
            items = []
        clean = []
        for it in items[:5]:
            if isinstance(it, dict):
                v = str(it.get('value', '')).strip()
                if v:
                    clean.append({'value': v, 'source': 'ai'})
            elif isinstance(it, str) and it.strip():
                clean.append({'value': it.strip(), 'source': 'ai'})
        return {'query': query, 'items': clean}
