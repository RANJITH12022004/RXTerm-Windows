/** Windows-oriented path helpers for the file explorer tree. */

const LS = 'http://127.0.0.1:8765/api/ls';

export function normPath(p) {
  return (p || '').replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

export function joinWin(base, name) {
  if (!base) return name;
  const sep = base.includes('\\') ? '\\' : '/';
  const b = base.replace(/[/\\]+$/, '');
  return `${b}${sep}${name}`;
}

export function dirnameWin(p) {
  if (!p || typeof p !== 'string') return '';
  const s = p.replace(/[/\\]+$/, '');
  const idx = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  if (idx <= 0) return s.length >= 2 && s[1] === ':' ? `${s[0]}:\\` : s;
  const head = s.slice(0, idx);
  if (head.length === 2 && head[1] === ':') return `${head}\\`;
  return head;
}

export function basenameWin(p) {
  if (!p) return '';
  const s = p.replace(/[/\\]+$/, '');
  const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  return i < 0 ? s : s.slice(i + 1);
}

/** True if absTarget is absRoot or a subfolder of absRoot (Windows paths). */
export function isUnderRoot(absRoot, absTarget) {
  const r = normPath(absRoot);
  const t = normPath(absTarget);
  if (!r || !t) return false;
  return t === r || t.startsWith(`${r}\\`);
}

/**
 * Call /api/ls; if path is a directory return it, else return its parent directory.
 */
export async function resolveFolderForDrop(absPath) {
  let p = (absPath || '').replace(/\//g, '\\').replace(/\\+$/, '');
  if (!p) return '';
  try {
    const res = await fetch(`${LS}?path=${encodeURIComponent(p)}`);
    const data = await res.json();
    if (!data.error) return p;
  } catch {
    /* fall through */
  }
  return dirnameWin(p);
}

/**
 * Pick tree root and which folder paths should start expanded so targetDir is visible.
 */
export function buildRevealState(profile, targetDir) {
  const tgt = targetDir.replace(/[/\\]+$/, '');
  if (!tgt) {
    const r = profile || '';
    return { root: r, expandedPaths: r ? [r] : [], highlightDir: r };
  }
  if (profile && isUnderRoot(profile, tgt)) {
    const prof = profile.replace(/[/\\]+$/, '');
    const rest = tgt.slice(prof.length).replace(/^[/\\]/, '');
    const segments = rest.split(/[/\\]/).filter(Boolean);
    const expandedPaths = [];
    let acc = prof;
    expandedPaths.push(acc);
    for (const seg of segments) {
      acc = joinWin(acc, seg);
      expandedPaths.push(acc);
    }
    return { root: prof, expandedPaths, highlightDir: tgt };
  }
  return { root: tgt, expandedPaths: [tgt], highlightDir: tgt };
}

export function highlightNamesForDir(absolutePaths, highlightDir) {
  const hd = normPath(highlightDir);
  const names = [];
  for (const raw of absolutePaths || []) {
    const p = raw.replace(/\//g, '\\');
    const dir = normPath(dirnameWin(p));
    const base = basenameWin(p);
    if (!base) continue;
    if (dir === hd) names.push(base);
  }
  return names;
}
