import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTerminalStore } from '../store/terminalStore.js';
import { animateTabClose, animateTabOpen, animateTabReorder } from '../animations/gsap-timelines.js';

export default function TabBar() {
  const tabBarRef = useRef(null);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const reorderTabs = useTerminalStore((s) => s.reorderTabs);

  const handleNewTab = () => {
    const prevLen = tabs.length;
    addTab();
    requestAnimationFrame(() => {
      if (tabBarRef.current?.querySelectorAll('.tab-item').length > prevLen) {
        const items = tabBarRef.current.querySelectorAll('.tab-item');
        const el = items[items.length - 1];
        if (el) animateTabOpen(el);
      }
    });
  };

  const handleCloseTab = (e, id) => {
    e.stopPropagation();
    const el = e.currentTarget.closest('.tab-item');
    if (!el) {
      closeTab(id);
      return;
    }
    animateTabClose(el, () => closeTab(id));
  };

  const onDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e, toIndex) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    const el = tabBarRef.current;
    if (!el) {
      reorderTabs(fromIndex, toIndex);
      return;
    }
    animateTabReorder(el, () => {
      flushSync(() => {
        reorderTabs(fromIndex, toIndex);
      });
    });
  };

  return (
    <div className="tab-bar">
      <div ref={tabBarRef} className="tab-items-track">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            role="tab"
            tabIndex={0}
            draggable
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, index)}
            aria-selected={tab.id === activeTabId}
          >
            <span className={`tab-status-dot ${tab.status === 'running' ? 'running' : tab.status === 'error' ? 'error' : 'idle'}`} />
            <span className="tab-title">{tab.title}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="tab-new-btn" aria-label="New tab" title="New tab" onClick={handleNewTab}>
        +
      </button>
    </div>
  );
}
