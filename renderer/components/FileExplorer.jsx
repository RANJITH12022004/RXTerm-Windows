import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  FolderSimple,
  CaretDoubleLeft,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  CaretDown,
} from '@phosphor-icons/react';
import { useTerminalStore } from '../store/terminalStore.js';
import { openSidebar, closeSidebar } from '../animations/gsap-timelines.js';
import { dirnameWin, joinWin, normPath } from '../utils/explorerPaths.js';

const API = 'http://127.0.0.1:8765/api/ls';

function fuzzyRank(query, name) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const s = name.toLowerCase();
  let qi = 0;
  let last = -1;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      last = i;
      qi++;
    }
  }
  if (qi < q.length) return 0;
  return 1000 - (last - q.length);
}

function ExplorerDirRow({
  nodePath,
  name,
  depth,
  expanded,
  onToggle,
  onCd,
  highlightDir,
  onContextMenu,
  children,
}) {
  const isHl = normPath(nodePath) === normPath(highlightDir);
  return (
    <li className="file-explorer-tree-item" style={{ paddingLeft: depth * 14 }}>
      <div className={`file-explorer-tree-row ${isHl ? 'file-explorer-tree-row-highlight' : ''}`}>
        <button
          type="button"
          className="file-explorer-tree-chevron"
          aria-expanded={expanded}
          title={expanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
        </button>
        <button
          type="button"
          className="file-explorer-row file-explorer-dir file-explorer-tree-label"
          title="Double-click to cd into this folder in the terminal"
          onClick={() => onToggle()}
          onContextMenu={(e) => onContextMenu(e, nodePath, true)}
          onDoubleClick={(e) => {
            e.preventDefault();
            onCd(nodePath);
          }}
        >
          {name}
        </button>
      </div>
      {expanded && <ul className="file-explorer-tree-children">{children}</ul>}
    </li>
  );
}

function ExplorerFileRow({ name, depth, fullPath, highlightNames, onContextMenu }) {
  const hl = highlightNames.includes(name);
  return (
    <li className="file-explorer-tree-item" style={{ paddingLeft: depth * 14 + 22 }}>
      <button
        type="button"
        className={`file-explorer-row file-explorer-file file-explorer-tree-file ${hl ? 'file-explorer-tree-row-highlight' : ''}`}
        onContextMenu={(e) => onContextMenu(e, fullPath, false)}
      >
        {name}
      </button>
    </li>
  );
}

function ExplorerSubtree({
  parentPath,
  depth,
  expandedMap,
  toggleExpanded,
  cdTo,
  highlightDir,
  highlightNames,
  onContextMenu,
}) {
  const [dirs, setDirs] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const expanded = !!expandedMap[parentPath];

  useEffect(() => {
    if (!expanded || !parentPath) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API}?path=${encodeURIComponent(parentPath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setDirs([]);
          setFiles([]);
        } else {
          setDirs((data.dirs || []).sort((a, b) => a.localeCompare(b)));
          setFiles((data.files || []).sort((a, b) => a.localeCompare(b)));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e.message || e));
          setDirs([]);
          setFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parentPath, expanded]);

  if (!expanded) return null;

  if (error) {
    return (
      <li className="file-explorer-error file-explorer-tree-item" style={{ paddingLeft: depth * 14 }}>
        {error}
      </li>
    );
  }

  const rows = [];
  for (const d of dirs) {
    const childPath = joinWin(parentPath, d);
    rows.push(
      <ExplorerDirRow
        key={`d:${childPath}`}
        nodePath={childPath}
        name={d}
        depth={depth}
        expanded={!!expandedMap[childPath]}
        onToggle={() => toggleExpanded(childPath)}
        onCd={cdTo}
        highlightDir={highlightDir}
        onContextMenu={onContextMenu}
        children={
          <ExplorerSubtree
            parentPath={childPath}
            depth={depth + 1}
            expandedMap={expandedMap}
            toggleExpanded={toggleExpanded}
            cdTo={cdTo}
            highlightDir={highlightDir}
            highlightNames={highlightNames}
            onContextMenu={onContextMenu}
          />
        }
      />,
    );
  }
  for (const f of files) {
    const fullPath = joinWin(parentPath, f);
    rows.push(
      <ExplorerFileRow
        key={`f:${fullPath}`}
        name={f}
        depth={depth}
        fullPath={fullPath}
        highlightNames={highlightNames}
        onContextMenu={onContextMenu}
      />,
    );
  }

  if (loading && !rows.length) {
    return (
      <li className="file-explorer-loading file-explorer-tree-item" style={{ paddingLeft: depth * 14 }}>
        Loading…
      </li>
    );
  }

  return rows;
}

export default function FileExplorer() {
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const open = useTerminalStore((s) => s.fileExplorerOpen);
  const toggleFileExplorer = useTerminalStore((s) => s.toggleFileExplorer);
  const searchNonce = useTerminalStore((s) => s.fileExplorerSearchNonce);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const terminalApis = useTerminalStore((s) => s.terminalApis);
  const terminalCwdByTabId = useTerminalStore((s) => s.terminalCwdByTabId);
  const fileExplorerTreeRoot = useTerminalStore((s) => s.fileExplorerTreeRoot);
  const setFileExplorerTreeRoot = useTerminalStore((s) => s.setFileExplorerTreeRoot);
  const fileExplorerExpanded = useTerminalStore((s) => s.fileExplorerExpanded);
  const toggleFileExplorerExpanded = useTerminalStore((s) => s.toggleFileExplorerExpanded);
  const fileExplorerHighlightDir = useTerminalStore((s) => s.fileExplorerHighlightDir);
  const fileExplorerHighlightNames = useTerminalStore((s) => s.fileExplorerHighlightNames);
  const clearFileExplorerHighlights = useTerminalStore((s) => s.clearFileExplorerHighlights);
  const setFileExplorerExpandedMany = useTerminalStore((s) => s.setFileExplorerExpandedMany);

  const cwd = terminalCwdByTabId[activeTabId] ?? '';

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menu, setMenu] = useState(null);
  const [searchDirs, setSearchDirs] = useState([]);
  const [searchFiles, setSearchFiles] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const treeRoot = fileExplorerTreeRoot;
  const expandedMap = fileExplorerExpanded;

  const userProfile = typeof window !== 'undefined' ? window.electronAPI?.userProfile || '' : '';

  useEffect(() => {
    if (treeRoot || !userProfile) return;
    setFileExplorerTreeRoot(userProfile);
    setFileExplorerExpandedMany([userProfile], true);
  }, [treeRoot, userProfile, setFileExplorerTreeRoot, setFileExplorerExpandedMany]);

  const cdTo = useCallback(
    (targetPath) => {
      const api = activeTabId ? terminalApis[activeTabId] : null;
      const escaped = targetPath.replace(/'/g, "''");
      api?.paste?.(`Set-Location -LiteralPath '${escaped}'\r`);
      api?.focus?.();
    },
    [activeTabId, terminalApis],
  );

  const goTreeRootUp = useCallback(() => {
    if (!treeRoot) return;
    const parent = dirnameWin(treeRoot);
    if (!parent || normPath(parent) === normPath(treeRoot)) return;
    clearFileExplorerHighlights();
    setFileExplorerTreeRoot(parent);
    setFileExplorerExpandedMany([parent], true);
  }, [treeRoot, setFileExplorerTreeRoot, setFileExplorerExpandedMany, clearFileExplorerHighlights]);

  const onContextMenu = (e, fullPath, isDir) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, path: fullPath, isDir });
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  useEffect(() => {
    if (!searchOpen || !treeRoot) return;
    let cancelled = false;
    setSearchLoading(true);
    fetch(`${API}?path=${encodeURIComponent(treeRoot)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setSearchDirs([]);
          setSearchFiles([]);
        } else {
          setSearchDirs(data.dirs || []);
          setSearchFiles(data.files || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchDirs([]);
          setSearchFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchOpen, treeRoot]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    const entries = [
      ...searchDirs.map((d) => ({ name: d, isDir: true })),
      ...searchFiles.map((f) => ({ name: f, isDir: false })),
    ];
    if (!q) return entries;
    return entries
      .map((e) => ({ ...e, rank: fuzzyRank(q, e.name) }))
      .filter((e) => e.rank > 0)
      .sort((a, b) => b.rank - a.rank);
  }, [searchDirs, searchFiles, searchQuery]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.set(el, { width: 0, overflow: 'hidden' });
    if (open) {
      openSidebar(el);
    } else {
      el.style.pointerEvents = 'none';
      gsap.set(el, { width: 0 });
    }
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (open) openSidebar(el);
    else closeSidebar(el);
  }, [open]);

  useEffect(() => {
    if (searchNonce === 0) return;
    if (!open) toggleFileExplorer();
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchNonce, open, toggleFileExplorer]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && searchOpen) {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [searchOpen]);

  const onDirClickFromSearch = (name) => {
    const path = joinWin(treeRoot, name);
    clearFileExplorerHighlights();
    setFileExplorerExpandedMany([treeRoot, path].filter(Boolean), true);
  };

  return (
    <>
      <aside
        ref={rootRef}
        className="sidebar sidebar-left file-explorer"
        data-expanded-width="300"
        aria-label="File explorer"
      >
        <div className="file-explorer-header">
          <FolderSimple size={18} className="file-explorer-header-icon" aria-hidden />
          <span className="file-explorer-title">Files</span>
          <button
            type="button"
            className="file-explorer-icon-btn"
            title="Tree root: parent folder"
            onClick={goTreeRootUp}
            disabled={!treeRoot || normPath(dirnameWin(treeRoot)) === normPath(treeRoot)}
          >
            <CaretLeft size={18} />
          </button>
          <button type="button" className="file-explorer-icon-btn" title="Forward" disabled>
            <CaretRight size={18} />
          </button>
          <button
            type="button"
            className="file-explorer-icon-btn"
            title="Search (Ctrl+P)"
            onClick={() => {
              setSearchOpen(true);
              requestAnimationFrame(() => searchInputRef.current?.focus());
            }}
          >
            <MagnifyingGlass size={18} />
          </button>
          <button
            type="button"
            className="file-explorer-icon-btn"
            title="Collapse"
            onClick={() => toggleFileExplorer()}
          >
            <CaretDoubleLeft size={18} />
          </button>
        </div>
        <div className="file-explorer-cwd" title={treeRoot || '—'}>
          <span className="file-explorer-cwd-label">Tree</span> {treeRoot || '…'}
        </div>
        <div className="file-explorer-shell-cwd" title={cwd || '—'}>
          <span className="file-explorer-cwd-label">Shell</span> {cwd || '…'}
        </div>
        <ul className="file-explorer-list file-explorer-tree-root">
          {treeRoot && (
            <ExplorerSubtree
              parentPath={treeRoot}
              depth={0}
              expandedMap={expandedMap}
              toggleExpanded={(p) => toggleFileExplorerExpanded(p)}
              cdTo={cdTo}
              highlightDir={fileExplorerHighlightDir}
              highlightNames={fileExplorerHighlightNames}
              onContextMenu={onContextMenu}
            />
          )}
        </ul>
      </aside>

      {searchOpen && (
        <div
          className="file-explorer-search-overlay"
          role="dialog"
          aria-label="Fuzzy file search"
          onMouseDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}
        >
          <div className="file-explorer-search-panel">
            <input
              ref={searchInputRef}
              className="file-explorer-search-input"
              placeholder="Filter files & folders in tree root…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchLoading && <div className="file-explorer-loading">Loading…</div>}
            <ul className="file-explorer-search-results">
              {filtered.slice(0, 40).map((e) => (
                <li key={`${e.isDir ? 'd' : 'f'}:${e.name}`}>
                  <button
                    type="button"
                    className="file-explorer-search-item"
                    onClick={() => {
                      if (e.isDir) onDirClickFromSearch(e.name);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <span className={e.isDir ? 'tag-dir' : 'tag-file'}>{e.isDir ? 'DIR' : 'FILE'}</span>
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {menu && (
        <div
          className="file-explorer-ctx"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            className="file-explorer-ctx-item"
            onClick={() => {
              navigator.clipboard?.writeText?.(menu.path);
              setMenu(null);
            }}
          >
            Copy path
          </button>
          {menu.isDir && (
            <button
              type="button"
              className="file-explorer-ctx-item"
              onClick={() => {
                window.electronAPI?.openPath?.(menu.path);
                setMenu(null);
              }}
            >
              Open in Explorer
            </button>
          )}
        </div>
      )}
    </>
  );
}
