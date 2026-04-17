// renderer/hooks/useDragDrop.js
import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminalStore.js';
import { buildRevealState, highlightNamesForDir, resolveFolderForDrop } from '../utils/explorerPaths.js';

export function useDragDrop(terminalRef) {
  useEffect(() => {
    const setDropzoneActive = (v) => useTerminalStore.getState().setDropzoneActive(v);

    // Listen at document level, NOT on xterm container
    const onDragEnter = (e) => {
      e.preventDefault();
      // Only activate for file drags, not text drags
      if (e.dataTransfer.types.includes('Files')) {
        setDropzoneActive(true);
      }
    };

    const onDragOver = (e) => {
      e.preventDefault(); // REQUIRED to allow drop
      e.dataTransfer.dropEffect = 'copy';
    };

    const onDragLeave = (e) => {
      // Only deactivate if leaving the window entirely
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setDropzoneActive(false);
      }
    };

    const onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDropzoneActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;

      // Build space-separated quoted paths
      const rawPaths = files.map((f) => f.path).filter(Boolean);
      const paths = rawPaths.map((p) => `"${p}"`).join(' ');

      // Write to terminal — inject paths at current cursor position
      if (terminalRef.current) {
        terminalRef.current.paste(paths + ' ');
        terminalRef.current.focus();
      }

      if (rawPaths.length) {
        void (async () => {
          const folder = await resolveFolderForDrop(rawPaths[0]);
          if (!folder) return;
          const profile = typeof window !== 'undefined' ? window.electronAPI?.userProfile || '' : '';
          const { root, expandedPaths, highlightDir } = buildRevealState(profile, folder);
          const highlightNames = highlightNamesForDir(rawPaths, highlightDir);
          useTerminalStore.getState().applyFileExplorerReveal({
            root,
            expandedPaths,
            highlightDir,
            highlightNames,
          });
        })();
      }
    };

    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);

    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [terminalRef]);
}
