import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Widget from './Widget';
import { Plus, AppWindow, FileText, CheckSquare, LayoutGrid, Columns } from 'lucide-react';

function useColumns(layoutMode) {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (width <= 768) return 1;

  if (layoutMode === '3col') {
    if (width <= 1024) return 2;
    return 3;
  }

  const padding = width <= 768 ? 32 : 64;
  const containerWidth = width - padding;
  const colWidth = 360;
  const gap = 24;
  const cols = Math.floor((containerWidth + gap) / (colWidth + gap));
  return Math.max(1, cols);
}

function DropZone({ isActive, onDragOver, onDrop }) {
  return (
    <div
      style={{
        height: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: isActive ? '3px' : '0px',
          background: 'var(--primary)',
          borderRadius: '2px',
          transition: 'height 0.1s ease',
          boxShadow: isActive ? '0 0 8px rgba(99, 102, 241, 0.5)' : 'none',
        }}
      />
    </div>
  );
}

export default function Dashboard({ dashboardId }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layoutMode, setLayoutMode] = useState('auto');

  // colLayout: widgetId -> { col: number, order: number }
  const [colLayout, setColLayout] = useState({});

  // Drag state
  const [draggingWidgetId, setDraggingWidgetId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [dragOverPos, setDragOverPos] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [widgetType, setWidgetType] = useState('links');
  const [widgetTitle, setWidgetTitle] = useState('');

  const numColumns = useColumns(layoutMode);

  const handleSetLayoutMode = (mode) => {
    setLayoutMode(mode);
    if (dashboardId) {
      localStorage.setItem(`homescreen_layout_mode_${dashboardId}`, mode);
    }
  };

  const saveLayout = (layout) => {
    if (dashboardId) {
      localStorage.setItem(`homescreen_col_layout_${dashboardId}`, JSON.stringify(layout));
    }
  };

  // Build columns from layout — each widget goes to its assigned col, or falls back to round-robin
  const columns = Array.from({ length: numColumns }, () => []);
  widgets.forEach((widget, idx) => {
    const entry = colLayout[widget.id];
    const col = entry !== undefined ? Math.min(entry.col, numColumns - 1) : idx % numColumns;
    const order = entry !== undefined ? entry.order : widgets.length + idx;
    columns[col].push({ widget, order });
  });
  columns.forEach(col => col.sort((a, b) => a.order - b.order));

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const data = await api.getWidgets(dashboardId);
      setWidgets(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch widgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dashboardId) {
      fetchWidgets();
      const savedMode = localStorage.getItem(`homescreen_layout_mode_${dashboardId}`) || 'auto';
      setLayoutMode(savedMode);
      const savedLayout = localStorage.getItem(`homescreen_col_layout_${dashboardId}`);
      if (savedLayout) {
        try { setColLayout(JSON.parse(savedLayout)); } catch {}
      }
    }
  }, [dashboardId]);

  const handleCreateWidget = async (e) => {
    e.preventDefault();
    if (!widgetTitle.trim()) return;
    setError('');
    let initialProperties = {};
    if (widgetType === 'links') initialProperties = { links: [], viewMode: 'grid' };
    else if (widgetType === 'note') initialProperties = { content: '', color: 'yellow' };
    else if (widgetType === 'todo') initialProperties = { items: [] };

    try {
      const newWidget = await api.createWidget(dashboardId, {
        type: widgetType,
        title: widgetTitle.trim(),
        properties: initialProperties
      });
      setWidgets(prev => [...prev, newWidget]);
      setModalOpen(false);
      setWidgetTitle('');
    } catch (err) {
      setError(err.message || 'Failed to create widget');
    }
  };

  const handleUpdateWidget = async (widgetId, fields) => {
    try {
      const updatedWidget = await api.updateWidget(widgetId, fields);
      setWidgets(prev => prev.map(w => w.id === widgetId ? updatedWidget : w));
    } catch (err) {
      setError(err.message || 'Failed to update widget');
    }
  };

  const handleDeleteWidget = async (widgetId) => {
    try {
      await api.deleteWidget(widgetId);
      setWidgets(prev => prev.filter(w => w.id !== widgetId));
      setColLayout(prev => {
        const next = { ...prev };
        delete next[widgetId];
        saveLayout(next);
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to delete widget');
    }
  };

  const handleDragStart = (e, widgetId) => {
    if (
      e.target.closest('.link-item-grid') ||
      e.target.closest('.link-item-list') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('textarea')
    ) {
      e.preventDefault();
      return;
    }
    setDraggingWidgetId(widgetId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'widget', widgetId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingWidgetId(null);
    setDragOverCol(null);
    setDragOverPos(null);
  };

  const handleDrop = (e, targetCol, insertPos) => {
    e.preventDefault();
    e.stopPropagation();
    const dataStr = e.dataTransfer.getData('text/plain');
    setDraggingWidgetId(null);
    setDragOverCol(null);
    setDragOverPos(null);
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type !== 'widget') return;
      const { widgetId } = data;

      // Find current source column and position
      let sourceCol = 0;
      let sourcePosInCol = 0;
      for (let c = 0; c < columns.length; c++) {
        const pos = columns[c].findIndex(item => item.widget.id === widgetId);
        if (pos !== -1) { sourceCol = c; sourcePosInCol = pos; break; }
      }

      // Skip if dropping in same position: after removing widgetId from sourceCol,
      // inserting at sourcePosInCol gives the identical order
      if (sourceCol === targetCol && insertPos === sourcePosInCol) {
        return;
      }

      const newLayout = { ...colLayout };

      // Build target column items (without the dragged widget), then insert
      const targetColIds = columns[targetCol]
        .filter(item => item.widget.id !== widgetId)
        .map(item => item.widget.id);
      targetColIds.splice(Math.min(insertPos, targetColIds.length), 0, widgetId);
      targetColIds.forEach((id, i) => { newLayout[id] = { col: targetCol, order: i }; });

      // Renumber source column if moving to a different one
      if (sourceCol !== targetCol) {
        const srcColIds = columns[sourceCol]
          .filter(item => item.widget.id !== widgetId)
          .map(item => item.widget.id);
        srcColIds.forEach((id, i) => { newLayout[id] = { col: sourceCol, order: i }; });
      }

      setColLayout(newLayout);
      saveLayout(newLayout);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveLink = async (sourceWidgetId, sourceLinkIndex, targetWidgetId, targetLinkIndex) => {
    const sourceWidget = widgets.find(w => w.id === sourceWidgetId);
    const targetWidget = widgets.find(w => w.id === targetWidgetId);
    if (!sourceWidget || !targetWidget) return;

    const sourceLinks = [...(sourceWidget.properties.links || [])];
    const [movedLink] = sourceLinks.splice(sourceLinkIndex, 1);

    if (sourceWidgetId === targetWidgetId) {
      const updatedLinks = [...(sourceWidget.properties.links || [])];
      const [removed] = updatedLinks.splice(sourceLinkIndex, 1);
      updatedLinks.splice(targetLinkIndex, 0, removed);
      await handleUpdateWidget(sourceWidgetId, {
        properties: { ...sourceWidget.properties, links: updatedLinks }
      });
    } else {
      const targetLinks = [...(targetWidget.properties.links || [])];
      if (targetLinkIndex !== undefined && targetLinkIndex !== null) {
        targetLinks.splice(targetLinkIndex, 0, movedLink);
      } else {
        targetLinks.push(movedLink);
      }
      try {
        setError('');
        const [updatedSource, updatedTarget] = await Promise.all([
          api.updateWidget(sourceWidgetId, {
            properties: { ...sourceWidget.properties, links: sourceLinks }
          }),
          api.updateWidget(targetWidgetId, {
            properties: { ...targetWidget.properties, links: targetLinks }
          })
        ]);
        setWidgets(prev => prev.map(w => {
          if (w.id === sourceWidgetId) return updatedSource;
          if (w.id === targetWidgetId) return updatedTarget;
          return w;
        }));
      } catch (err) {
        setError(err.message || 'Failed to move bookmark');
      }
    }
  };

  return (
    <div className="dashboard-container">
      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
          Loading dashboard elements...
        </div>
      ) : widgets.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-state-title">This dashboard is empty</div>
          <div className="empty-state-desc">Start building your home workspace by creating your first shortcut group, post-it, or checklist.</div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} />
            Create Widget
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="glass-panel" style={{ display: 'flex', padding: '3px', borderRadius: 'var(--radius-full)', background: 'rgba(30, 41, 59, 0.3)', gap: '2px', border: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                className="btn"
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '0.45rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  border: 'none',
                  background: layoutMode === 'auto' ? 'var(--primary)' : 'transparent',
                  color: layoutMode === 'auto' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: layoutMode === 'auto' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer'
                }}
                onClick={() => handleSetLayoutMode('auto')}
                title="Auto Columns"
              >
                <LayoutGrid size={14} />
                <span>Auto</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '0.45rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  border: 'none',
                  background: layoutMode === '3col' ? 'var(--primary)' : 'transparent',
                  color: layoutMode === '3col' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: layoutMode === '3col' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer'
                }}
                onClick={() => handleSetLayoutMode('3col')}
                title="3 Fixed Columns"
              >
                <Columns size={14} />
                <span>3 Columns</span>
              </button>
            </div>

            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={18} />
              Add Widget
            </button>
          </div>

          <div
            className="widget-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
              gap: '1.5rem',
              alignItems: 'start'
            }}
          >
            {columns.map((columnWidgets, colIdx) => (
              <div
                key={colIdx}
                className="widget-column"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '200px'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, colIdx, columnWidgets.length)}
              >
                <DropZone
                  isActive={dragOverCol === colIdx && dragOverPos === 0}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverCol(colIdx); setDragOverPos(0); }}
                  onDrop={(e) => handleDrop(e, colIdx, 0)}
                />

                {columnWidgets.length === 0 && draggingWidgetId && (
                  <div style={{
                    flex: 1,
                    minHeight: '120px',
                    border: '2px dashed rgba(99, 102, 241, 0.35)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.8rem',
                    letterSpacing: '0.03em',
                    pointerEvents: 'none',
                  }}>
                    Drop here
                  </div>
                )}

                {columnWidgets.map(({ widget }, i) => (
                  <React.Fragment key={widget.id}>
                    <Widget
                      widget={widget}
                      onUpdate={handleUpdateWidget}
                      onDelete={handleDeleteWidget}
                      onMoveLink={handleMoveLink}
                      isDragging={draggingWidgetId === widget.id}
                      isDragOver={false}
                      onDragStart={(e) => handleDragStart(e, widget.id)}
                      onDragOver={(e) => {
                        if (!window.__draggingLink) {
                          e.preventDefault();
                          setDragOverCol(colIdx);
                          setDragOverPos(i + 1);
                        }
                      }}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => {
                        if (!window.__draggingLink) {
                          const dataStr = e.dataTransfer.getData('text/plain');
                          try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.type === 'widget' && parsed.widgetId !== widget.id) {
                              handleDrop(e, colIdx, i + 1);
                            } else {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          } catch { e.preventDefault(); e.stopPropagation(); }
                        }
                      }}
                    />
                    <DropZone
                      isActive={dragOverCol === colIdx && dragOverPos === i + 1}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverCol(colIdx); setDragOverPos(i + 1); }}
                      onDrop={(e) => handleDrop(e, colIdx, i + 1)}
                    />
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create Widget</h2>
            </div>

            <form onSubmit={handleCreateWidget}>
              <div className="form-group">
                <label className="form-label">Widget Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '0.5rem 0' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      flexDirection: 'column',
                      padding: '1rem 0.5rem',
                      height: '90px',
                      border: widgetType === 'links' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                      background: widgetType === 'links' ? 'rgba(99, 102, 241, 0.1)' : '',
                      borderRadius: '12px'
                    }}
                    onClick={() => {
                      setWidgetType('links');
                      if (!widgetTitle) setWidgetTitle('Bookmarks');
                    }}
                  >
                    <AppWindow size={20} className="text-secondary" />
                    <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 500 }}>Bookmarks</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      flexDirection: 'column',
                      padding: '1rem 0.5rem',
                      height: '90px',
                      border: widgetType === 'note' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                      background: widgetType === 'note' ? 'rgba(99, 102, 241, 0.1)' : '',
                      borderRadius: '12px'
                    }}
                    onClick={() => {
                      setWidgetType('note');
                      if (!widgetTitle) setWidgetTitle('Post-it');
                    }}
                  >
                    <FileText size={20} className="text-secondary" />
                    <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 500 }}>Post-It</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      flexDirection: 'column',
                      padding: '1rem 0.5rem',
                      height: '90px',
                      border: widgetType === 'todo' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                      background: widgetType === 'todo' ? 'rgba(99, 102, 241, 0.1)' : '',
                      borderRadius: '12px'
                    }}
                    onClick={() => {
                      setWidgetType('todo');
                      if (!widgetTitle) setWidgetTitle('Checklist');
                    }}
                  >
                    <CheckSquare size={20} className="text-secondary" />
                    <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 500 }}>Checklist</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Widget Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="e.g. Work bookmarks, Notes, Tasks"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Widget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
