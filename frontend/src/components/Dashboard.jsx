import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import Widget from './Widget';
import { Plus, AppWindow, FileText, CheckSquare } from 'lucide-react';

export default function Dashboard({ dashboardId }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create widget modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [widgetType, setWidgetType] = useState('links'); // 'links', 'note', 'todo'
  const [widgetTitle, setWidgetTitle] = useState('');

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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={18} />
              Add Widget
            </button>
          </div>

          <div className="widget-grid">
            {widgets.map(w => (
              <Widget 
                key={w.id} 
                widget={w}
                onUpdate={handleUpdateWidget}
                onDelete={handleDeleteWidget}
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
