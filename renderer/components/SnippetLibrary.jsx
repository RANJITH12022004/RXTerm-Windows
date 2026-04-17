import { useCallback, useEffect, useMemo, useState } from 'react';
import { DownloadSimple, FloppyDisk, Plus, Trash } from '@phosphor-icons/react';
import { useTerminalStore } from '../store/terminalStore.js';

const API = 'http://127.0.0.1:8765/api/snippets';

const EMPTY_FORM = {
  id: null,
  title: '',
  command: '',
  description: '',
  tags: '',
};

export default function SnippetLibrary() {
  const snippets = useTerminalStore((s) => s.snippets);
  const snippetsLoading = useTerminalStore((s) => s.snippetsLoading);
  const snippetSearch = useTerminalStore((s) => s.snippetSearch);
  const setSnippetSearch = useTerminalStore((s) => s.setSnippetSearch);
  const setSnippets = useTerminalStore((s) => s.setSnippets);
  const setSnippetsLoading = useTerminalStore((s) => s.setSnippetsLoading);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const terminalApis = useTerminalStore((s) => s.terminalApis);

  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(
    async (query = '') => {
      setSnippetsLoading(true);
      try {
        const url = `${API}?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();
        setSnippets(data.items || []);
      } catch {
        setSnippets([]);
      }
    },
    [setSnippets, setSnippetsLoading],
  );

  useEffect(() => {
    load(snippetSearch);
  }, [load, snippetSearch]);

  const saveSnippet = useCallback(async () => {
    const payload = {
      title: form.title.trim(),
      command: form.command,
      description: form.description,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    if (!payload.title || !payload.command.trim()) return;
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/${form.id}` : API;
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setForm(EMPTY_FORM);
    load(snippetSearch);
  }, [form, load, snippetSearch]);

  const deleteSnippet = useCallback(
    async (id) => {
      await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (form.id === id) setForm(EMPTY_FORM);
      load(snippetSearch);
    },
    [form.id, load, snippetSearch],
  );

  const exportJson = useCallback(async () => {
    const res = await fetch('http://127.0.0.1:8765/api/snippets_export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data.items || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rxterm-snippets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importJson = useCallback(
    async (file) => {
      if (!file) return;
      const text = await file.text();
      let items = [];
      try {
        items = JSON.parse(text);
      } catch {
        return;
      }
      if (!Array.isArray(items)) return;
      await fetch('http://127.0.0.1:8765/api/snippets_import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets: items }),
      });
      load(snippetSearch);
    },
    [load, snippetSearch],
  );

  const insertSnippet = useCallback(
    (command) => {
      const api = activeTabId ? terminalApis[activeTabId] : null;
      api?.paste?.(command);
      api?.focus?.();
    },
    [activeTabId, terminalApis],
  );

  const editingLabel = useMemo(() => (form.id ? 'Update snippet' : 'Create snippet'), [form.id]);

  return (
    <section className="snippet-view" aria-label="Snippet library">
      <div className="view-header">
        <div>
          <div className="view-eyebrow">Reusable commands</div>
          <h2 className="view-title">Snippet Library</h2>
        </div>
        <div className="snippet-toolbar">
          <button type="button" className="toolbar-pill" onClick={() => setForm(EMPTY_FORM)}>
            <Plus size={14} />
            New
          </button>
          <button type="button" className="toolbar-pill" onClick={exportJson}>
            <DownloadSimple size={14} />
            Export
          </button>
          <label className="toolbar-pill file-pill">
            Import
            <input
              type="file"
              accept="application/json"
              onChange={(e) => importJson(e.target.files?.[0])}
              hidden
            />
          </label>
        </div>
      </div>

      <div className="snippet-layout">
        <div className="snippet-list-pane panel">
          <input
            className="view-search"
            value={snippetSearch}
            onChange={(e) => setSnippetSearch(e.target.value)}
            placeholder="Fuzzy search title, command, description, tags"
          />
          <div className="snippet-list">
            {snippetsLoading && <div className="history-timeline-empty">Loading snippets...</div>}
            {!snippetsLoading && snippets.length === 0 && (
              <div className="history-timeline-empty">No snippets found.</div>
            )}
            {snippets.map((snippet) => (
              <article key={snippet.id} className="snippet-card">
                <div className="snippet-card-head">
                  <div className="snippet-card-title">{snippet.title}</div>
                  <div className="snippet-card-actions">
                    <button type="button" className="icon-btn" onClick={() => setForm({
                      id: snippet.id,
                      title: snippet.title,
                      command: snippet.command,
                      description: snippet.description || '',
                      tags: (snippet.tags || []).join(', '),
                    })}>
                      <FloppyDisk size={14} />
                    </button>
                    <button type="button" className="icon-btn danger" onClick={() => deleteSnippet(snippet.id)}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
                <code className="snippet-command">{snippet.command}</code>
                {snippet.description ? <div className="snippet-description">{snippet.description}</div> : null}
                <div className="snippet-tags">
                  {(snippet.tags || []).map((tag) => (
                    <span key={tag} className="history-entry-badge duration">
                      {tag}
                    </span>
                  ))}
                </div>
                <button type="button" className="snippet-insert-btn" onClick={() => insertSnippet(snippet.command)}>
                  Insert into terminal
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="snippet-form-pane panel">
          <div className="snippet-form-title">{editingLabel}</div>
          <input
            className="snippet-input"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Title"
          />
          <textarea
            className="snippet-textarea"
            value={form.command}
            onChange={(e) => setForm((prev) => ({ ...prev, command: e.target.value }))}
            placeholder="Command"
          />
          <textarea
            className="snippet-textarea"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
          />
          <input
            className="snippet-input"
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="Tags, comma separated"
          />
          <div className="snippet-form-actions">
            <button type="button" className="snippet-insert-btn" onClick={saveSnippet}>
              Save
            </button>
            <button type="button" className="toolbar-pill" onClick={() => setForm(EMPTY_FORM)}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
