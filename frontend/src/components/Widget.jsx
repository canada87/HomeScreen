import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { 
  Settings, Trash2, Plus, Grid, List, ExternalLink, 
  Check, Edit3, Save, CheckSquare, Square, 
  Globe, Server, Cpu, Terminal, Database, Cloud, Link, Upload
} from 'lucide-react';

const PRESET_ICONS = {
  globe: Globe,
  server: Server,
  cpu: Cpu,
  terminal: Terminal,
  database: Database,
  cloud: Cloud,
  link: Link
};

export default function Widget({ 
  widget, 
  index, 
  onUpdate, 
  onDelete, 
  onMoveLink, 
  isDragging, 
  isDragOver, 
  onDragStart, 
  onDragOver, 
  onDragEnd, 
  onDrop 
}) {
  const [editingWidget, setEditingWidget] = useState(false);
  const [widgetTitle, setWidgetTitle] = useState(widget.title);
  const [noteColor, setNoteColor] = useState(widget.properties.color || 'yellow');
  
  // Link widget states
  const [viewMode, setViewMode] = useState(widget.properties.viewMode || 'grid');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null); // null for new link, or link object
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [iconType, setIconType] = useState('favicon'); // 'favicon', 'preset', 'upload'
  const [iconValue, setIconValue] = useState('globe'); // preset name or base64 data
  
  // Link dragging local states
  const [dragOverLinkIndex, setDragOverLinkIndex] = useState(null);
  const [isLinkDragOver, setIsLinkDragOver] = useState(false);

  // Note widget states
  const [noteContent, setNoteContent] = useState(widget.properties.content || '');
  const noteTimeoutRef = useRef(null);

  // Todo widget states
  const [newTodoText, setNewTodoText] = useState('');

  // Link Drag and Drop Handlers
  const handleLinkDragStart = (e, lnkIndex) => {
    e.stopPropagation();
    window.__draggingLink = { sourceWidgetId: widget.id, linkIndex: lnkIndex };
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'link',
      sourceWidgetId: widget.id,
      linkIndex: lnkIndex
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLinkDragEnd = () => {
    window.__draggingLink = null;
  };

  const handleLinkDragOver = (e, lnkIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.__draggingLink) {
      setDragOverLinkIndex(lnkIndex);
    }
  };

  const handleLinkDragLeave = () => {
    setDragOverLinkIndex(null);
  };

  const handleLinkDrop = (e, targetLnkIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverLinkIndex(null);
    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'link') {
        onMoveLink(data.sourceWidgetId, data.linkIndex, widget.id, targetLnkIndex);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBodyDragOverForLink = (e) => {
    if (widget.type === 'links' && window.__draggingLink) {
      e.preventDefault();
      e.stopPropagation();
      setIsLinkDragOver(true);
    }
  };

  const handleBodyDragLeaveForLink = () => {
    setIsLinkDragOver(false);
  };

  const handleBodyDropForLink = (e) => {
    if (widget.type === 'links' && window.__draggingLink) {
      e.preventDefault();
      e.stopPropagation();
      setIsLinkDragOver(false);
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      try {
        const data = JSON.parse(dataStr);
        if (data.type === 'link') {
          onMoveLink(data.sourceWidgetId, data.linkIndex, widget.id, null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCardDrop = (e) => {
    if (widget.type === 'links' && window.__draggingLink) {
      handleBodyDropForLink(e);
    } else {
      onDrop(e);
    }
  };

  const handleCardDragOver = (e) => {
    if (widget.type === 'links' && window.__draggingLink) {
      handleBodyDragOverForLink(e);
    } else {
      onDragOver(e);
    }
  };

  const handleCardDragLeave = (e) => {
    if (widget.type === 'links' && window.__draggingLink) {
      handleBodyDragLeaveForLink(e);
    }
  };

  // Update notes with debouncing
  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNoteContent(val);
    
    if (noteTimeoutRef.current) {
      clearTimeout(noteTimeoutRef.current);
    }
    
    noteTimeoutRef.current = setTimeout(() => {
      onUpdate(widget.id, {
        properties: {
          ...widget.properties,
          content: val
        }
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (noteTimeoutRef.current) {
        clearTimeout(noteTimeoutRef.current);
      }
    };
  }, []);

  // Save general widget configuration
  const handleSaveWidgetConfig = (e) => {
    e.preventDefault();
    const updatedProps = { ...widget.properties };
    if (widget.type === 'note') {
      updatedProps.color = noteColor;
    } else if (widget.type === 'links') {
      updatedProps.viewMode = viewMode;
    }
    
    onUpdate(widget.id, {
      title: widgetTitle,
      properties: updatedProps
    });
    setEditingWidget(false);
  };

  // --- BOOKMARKS (LINKS) WIDGET FUNCTIONS ---
  const handleOpenAddLink = () => {
    setEditingLink(null);
    setLinkName('');
    setLinkUrl('');
    setIconType('favicon');
    setIconValue('globe');
    setLinkModalOpen(true);
  };

  const handleOpenEditLink = (lnk, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingLink(lnk);
    setLinkName(lnk.name);
    setLinkUrl(lnk.url);
    setIconType(lnk.iconType || 'favicon');
    setIconValue(lnk.iconValue || 'globe');
    setLinkModalOpen(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setIconValue(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLink = (e) => {
    e.preventDefault();
    const links = widget.properties.links || [];
    let updatedLinks = [];

    const linkData = {
      id: editingLink ? editingLink.id : Date.now().toString(),
      name: linkName,
      url: linkUrl,
      iconType,
      iconValue: iconType === 'favicon' ? '' : iconValue
    };

    if (editingLink) {
      updatedLinks = links.map(l => l.id === editingLink.id ? linkData : l);
    } else {
      updatedLinks = [...links, linkData];
    }

    onUpdate(widget.id, {
      properties: {
        ...widget.properties,
        links: updatedLinks
      }
    });

    setLinkModalOpen(false);
  };

  const handleDeleteLink = (linkId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this bookmark?")) return;

    const links = widget.properties.links || [];
    const updatedLinks = links.filter(l => l.id !== linkId);
    
    onUpdate(widget.id, {
      properties: {
        ...widget.properties,
        links: updatedLinks
      }
    });
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    onUpdate(widget.id, {
      properties: {
        ...widget.properties,
        viewMode: newMode
      }
    });
  };

  // --- TODO WIDGET FUNCTIONS ---
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const items = widget.properties.items || [];
    const newItem = {
      id: Date.now().toString(),
      text: newTodoText.trim(),
      completed: false
    };

    onUpdate(widget.id, {
      properties: {
        ...widget.properties,
        items: [...items, newItem]
      }
    });

    setNewTodoText('');
  };

  const handleToggleTodo = (todoId) => {
    const items = widget.properties.items || [];
    const updatedItems = items.map(item => 
      item.id === todoId ? { ...item, completed: !item.completed } : item
    );

    onUpdate(widget.id, {
      properties: {
        ...widget.properties,
        items: updatedItems
      }
    });
  };

  const handleDeleteTodo = (todoId) => {
    const items = widget.properties.items || [];
    const updatedItems = items.filter(item => item.id !== todoId);

    onUpdate(widget.id, {
      properties: {
        ...widget.properties,
        items: updatedItems
      }
    });
  };

  // Render icons for links
  const renderLinkIcon = (lnk) => {
    if (lnk.iconType === 'upload' && lnk.iconValue) {
      return <img src={lnk.iconValue} alt="" className="link-icon-img" onError={(e) => { e.target.src = ''; }} />;
    }
    
    if (lnk.iconType === 'preset' && lnk.iconValue) {
      const IconComponent = PRESET_ICONS[lnk.iconValue] || Globe;
      return <IconComponent size={20} className="text-secondary" />;
    }

    // Default to favicon proxy
    return (
      <img 
        src={api.getFaviconUrl(lnk.url)} 
        alt="" 
        className="link-icon-img"
        onError={(e) => {
          e.target.style.display = 'none';
          const sibling = e.target.nextSibling;
          if (sibling) sibling.style.display = 'block';
        }}
      />
    );
  };

  const renderFallbackIcon = () => (
    <div className="link-icon-placeholder" style={{ display: 'none' }}>
      <Globe size={18} />
    </div>
  );

  // Todo completed status calculations
  const todoItems = widget.properties.items || [];
  const completedCount = todoItems.filter(i => i.completed).length;
  const totalCount = todoItems.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div 
      draggable="true"
      onDragStart={onDragStart}
      onDragOver={handleCardDragOver}
      onDragLeave={handleCardDragLeave}
      onDragEnd={onDragEnd}
      onDrop={handleCardDrop}
      className={`glass-panel widget-card ${widget.type === 'note' ? `note-${noteColor}` : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isLinkDragOver ? 'link-drag-over' : ''}`}
      style={{ cursor: 'grab' }}
    >
      {/* Widget Header */}
      <div className="widget-header">
        <h3 className="widget-title" title={widget.title}>{widget.title}</h3>
        
        <div className="widget-actions">
          {widget.type === 'links' && (
            <button className="btn btn-secondary btn-icon" onClick={toggleViewMode} title="Toggle View Mode" style={{ padding: '0.35rem' }}>
              {viewMode === 'grid' ? <List size={14} /> : <Grid size={14} />}
            </button>
          )}
          {widget.type === 'links' && (
            <button className="btn btn-secondary btn-icon" onClick={handleOpenAddLink} title="Add Bookmark" style={{ padding: '0.35rem' }}>
              <Plus size={14} />
            </button>
          )}
          <button className="btn btn-secondary btn-icon" onClick={() => setEditingWidget(true)} title="Widget Settings" style={{ padding: '0.35rem' }}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Widget Body */}
      <div className="widget-body">
        {/* LINKS FOLDER WIDGET */}
        {widget.type === 'links' && (
          <>
            {(!widget.properties.links || widget.properties.links.length === 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No bookmarks yet.
                <button className="btn btn-secondary" onClick={handleOpenAddLink} style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                  Add Bookmark
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="links-grid">
                {widget.properties.links.map((lnk, lnkIdx) => (
                  <div 
                    key={lnk.id} 
                    style={{ position: 'relative' }}
                    draggable="true"
                    onDragStart={(e) => handleLinkDragStart(e, lnkIdx)}
                    onDragEnd={handleLinkDragEnd}
                    onDragOver={(e) => handleLinkDragOver(e, lnkIdx)}
                    onDragLeave={handleLinkDragLeave}
                    onDrop={(e) => handleLinkDrop(e, lnkIdx)}
                    className={`${dragOverLinkIndex === lnkIdx ? 'drag-over' : ''}`}
                  >
                    <a 
                      href={lnk.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="link-item-grid"
                    >
                      <div className="link-icon-container">
                        {renderLinkIcon(lnk)}
                        {renderFallbackIcon()}
                      </div>
                      <span className="link-name-grid">{lnk.name}</span>
                    </a>
                    
                    {/* Inline edit button for bookmarks */}
                    <button 
                      onClick={(e) => handleOpenEditLink(lnk, e)}
                      style={{ position: 'absolute', top: 0, right: 0, border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', padding: '0.2rem', cursor: 'pointer', display: 'flex', opacity: 0 }}
                      className="bookmark-edit-trigger"
                    >
                      <Edit3 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="links-list">
                {widget.properties.links.map((lnk, lnkIdx) => (
                  <a 
                    key={lnk.id} 
                    href={lnk.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`link-item-list ${dragOverLinkIndex === lnkIdx ? 'drag-over' : ''}`}
                    draggable="true"
                    onDragStart={(e) => handleLinkDragStart(e, lnkIdx)}
                    onDragEnd={handleLinkDragEnd}
                    onDragOver={(e) => handleLinkDragOver(e, lnkIdx)}
                    onDragLeave={handleLinkDragLeave}
                    onDrop={(e) => handleLinkDrop(e, lnkIdx)}
                  >
                    <div className="link-icon-container-list">
                      {renderLinkIcon(lnk)}
                      {renderFallbackIcon()}
                    </div>
                    <span className="link-name-list">{lnk.name}</span>
                    <span className="link-url-list">{lnk.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button 
                        onClick={(e) => handleOpenEditLink(lnk, e)} 
                        className="btn btn-secondary btn-icon" 
                        style={{ padding: '0.2rem', color: 'var(--text-secondary)' }}
                        title="Edit"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteLink(lnk.id, e)} 
                        className="btn btn-secondary btn-icon" 
                        style={{ padding: '0.2rem', color: 'var(--danger)' }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {/* POST-IT (STICKY NOTE) WIDGET */}
        {widget.type === 'note' && (
          <textarea
            className="note-textarea"
            placeholder="Start typing your note here..."
            value={noteContent}
            onChange={handleNoteChange}
          />
        )}

        {/* TODO LIST WIDGET */}
        {widget.type === 'todo' && (
          <div className="todo-container">
            {totalCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Progress</span>
                  <span>{completedCount}/{totalCount} Completed ({percentComplete}%)</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${percentComplete}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            <div className="todo-list">
              {todoItems.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No tasks in this list.
                </div>
              ) : (
                todoItems.map(item => (
                  <div key={item.id} className={`todo-item ${item.completed ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      className="todo-checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleTodo(item.id)}
                    />
                    <span className="todo-text">{item.text}</span>
                    <button className="todo-delete-btn" onClick={() => handleDeleteTodo(item.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddTodo} className="todo-input-form">
              <input
                type="text"
                className="todo-input"
                placeholder="Add task..."
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.75rem' }}>
                Add
              </button>
            </form>
          </div>
        )}
      </div>

      {/* STYLE TOGGLE FOR SHOWING BOOKMARK EDIT TRIGGER */}
      <style>{`
        .widget-card:hover .bookmark-edit-trigger {
          opacity: 1 !important;
        }
      `}</style>

      {/* WIDGET GENERAL CONFIGURATION MODAL */}
      {editingWidget && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2 className="modal-title">Configure Widget</h2>
            </div>
            
            <form onSubmit={handleSaveWidgetConfig}>
              <div className="form-group">
                <label className="form-label">Widget Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={widgetTitle}
                  onChange={(e) => setWidgetTitle(e.target.value)}
                  placeholder="Widget Title"
                />
              </div>

              {widget.type === 'note' && (
                <div className="form-group">
                  <label className="form-label">Post-it Color</label>
                  <div className="color-picker-grid">
                    {['yellow', 'blue', 'green', 'pink', 'purple', 'dark'].map(c => (
                      <div
                        key={c}
                        className={`color-option color-${c} ${noteColor === c ? 'selected' : ''}`}
                        onClick={() => setNoteColor(c)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {widget.type === 'links' && (
                <div className="form-group">
                  <label className="form-label">Default View Mode</label>
                  <select 
                    className="form-select"
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                  >
                    <option value="grid">Grid (Large Icons)</option>
                    <option value="list">List (Rows)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this widget?")) {
                      onDelete(widget.id);
                      setEditingWidget(false);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Delete Widget
                </button>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingWidget(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOOKMARK ADD / EDIT MODAL */}
      {linkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingLink ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
            </div>
            
            <form onSubmit={handleSaveLink}>
              <div className="form-group">
                <label className="form-label">Bookmark Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="e.g. My Server UI"
                />
              </div>

              <div className="form-group">
                <label className="form-label">URL</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="e.g. https://my-service.local"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Icon Source</label>
                <select 
                  className="form-select"
                  value={iconType}
                  onChange={(e) => setIconType(e.target.value)}
                >
                  <option value="favicon">Automatic Favicon (Resolves automatically)</option>
                  <option value="preset">Preset Icon (Choose a style)</option>
                  <option value="upload">Upload Custom Image (PNG/JPEG)</option>
                </select>
              </div>

              {iconType === 'preset' && (
                <div className="form-group">
                  <label className="form-label">Select Icon</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {Object.keys(PRESET_ICONS).map(iconKey => {
                      const IconComp = PRESET_ICONS[iconKey];
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            padding: '0.5rem',
                            border: iconValue === iconKey ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                            borderRadius: '8px',
                            background: iconValue === iconKey ? 'rgba(99, 102, 241, 0.1)' : ''
                          }}
                          onClick={() => setIconValue(iconKey)}
                        >
                          <IconComp size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {iconType === 'upload' && (
                <div className="form-group">
                  <label className="form-label">Upload PNG / JPEG (max 2MB)</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    className="form-input"
                    onChange={handleFileUpload}
                    style={{ fontSize: '0.85rem' }}
                  />
                  {iconValue && iconValue.startsWith('data:image') && (
                    <div className="image-upload-preview">
                      <span className="form-label" style={{ fontSize: '0.75rem' }}>Selected Preview:</span>
                      <img src={iconValue} alt="Preview" className="uploaded-preview-img" />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: editingLink ? 'space-between' : 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                {editingLink && (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={(e) => {
                      handleDeleteLink(editingLink.id, e);
                      setLinkModalOpen(false);
                    }}
                  >
                    Delete
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setLinkModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Bookmark
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
