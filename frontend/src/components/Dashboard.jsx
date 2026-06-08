import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Widget from './Widget';
import { Plus, AppWindow, FileText, CheckSquare, LayoutGrid, Columns } from 'lucide-react';

export default function Dashboard({ dashboardId }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Layout mode state: 'auto' or '3col'
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('homescreen_layout_mode') || 'auto';
  });

  const handleSetLayoutMode = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('homescreen_layout_mode', mode);
  };
  
  // Create widget modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [widgetType, setWidgetType] = useState('links'); // 'links', 'note', 'todo'
  const [widgetTitle, setWidgetTitle] = useState('');

  // Drag and drop states
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

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
    }
  }, [dashboardId]);

  const handleCreateWidget = async (e) => {
    e.preventDefault();
    if (!widgetTitle.trim()) return;

    setError('');
    let initialProperties = {};
    if (widgetType === 'links') {
      initialProperties = { links: [], viewMode: 'grid' };
    } else if (widgetType === 'note') {
      initialProperties = { content: '', color: 'yellow' };
    } else if (widgetType === 'todo') {
      initialProperties = { items: [] };
    }

    try {
      const newWidget = await api.createWidget(dashboardId, {
        type: widgetType,
        title: widgetTitle.trim(),
        properties: initialProperties
      });
      setWidgets([...widgets, newWidget]);
      setModalOpen(false);
      setWidgetTitle('');
    } catch (err) {
      setError(err.message || 'Failed to create widget');
    }
  };

  const handleUpdateWidget = async (widgetId, fields) => {
    try {
      const updatedWidget = await api.updateWidget(widgetId, fields);
      setWidgets(widgets.map(w => w.id === widgetId ? updatedWidget : w));
    } catch (err) {
      setError(err.message || 'Failed to update widget');
    }
  };

  const handleDeleteWidget = async (widgetId) => {
    try {
      await api.deleteWidget(widgetId);
      setWidgets(widgets.filter(w => w.id !== widgetId));
    } catch (err) {
      setError(err.message || 'Failed to delete widget');
    }
  };

  // Widget Drag and Drop Handlers
  const handleDragStart = (e, index) => {
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
    setDraggingIndex(index);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'widget', index }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggingIndex !== null && draggingIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('text/plain');
    setDraggingIndex(null);
    setDragOverIndex(null);
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'widget') {
        const sourceIndex = data.index;
        if (sourceIndex === targetIndex) return;

        const reordered = [...widgets];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);

        setWidgets(reordered);

        // Save layout configuration to DB in background
        reordered.forEach((w, i) => {
          api.updateWidget(w.id, { order_index: i }).catch(err => console.error(err));
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Link Drag and Drop Handler (moves link icons inside/between folders)
  const handleMoveLink = async (sourceWidgetId, sourceLinkIndex, targetWidgetId, targetLinkIndex) => {
    const sourceWidget = widgets.find(w => w.id === sourceWidgetId);
    const targetWidget = widgets.find(w => w.id === targetWidgetId);
    if (!sourceWidget || !targetWidget) return;

    const sourceLinks = [...(sourceWidget.properties.links || [])];
    const [movedLink] = sourceLinks.splice(sourceLinkIndex, 1);

    if (sourceWidgetId === targetWidgetId) {
      // Reorder same folder
      const updatedLinks = [...(sourceWidget.properties.links || [])];
      const [removed] = updatedLinks.splice(sourceLinkIndex, 1);
      updatedLinks.splice(targetLinkIndex, 0, removed);

      await handleUpdateWidget(sourceWidgetId, {
        properties: {
          ...sourceWidget.properties,
          links: updatedLinks
        }
      });
    } else {
      // Transfer between folders
      const targetLinks = [...(targetWidget.properties.links || [])];
      if (targetLinkIndex !== undefined && targetLinkIndex !== null) {
        targetLinks.splice(targetLinkIndex, 0, movedLink);
      } else {
        targetLinks.push(movedLink);
      }

      await handleUpdateWidget(sourceWidgetId, {
        properties: {
          ...sourceWidget.properties,
          links: sourceLinks
        }
      });

      await handleUpdateWidget(targetWidgetId, {
        properties: {
          ...targetWidget.properties,
          links: targetLinks
        }
      });
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
            {/* Layout Mode Toggle */}
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

          <div className={`widget-grid ${layoutMode === '3col' ? 'grid-3col' : ''}`}>
            {widgets.map((w, idx) => (
              <Widget 
                key={w.id} 
                widget={w}
                onUpdate={handleUpdateWidget}
                onDelete={handleDeleteWidget}
                onMoveLink={handleMoveLink}
                isDragging={draggingIndex === idx}
                isDragOver={dragOverIndex === idx}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
              />
            ))}
          </div>
        </>
      )}

      {/* CREATE WIDGET MODAL */}
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
