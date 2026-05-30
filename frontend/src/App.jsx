import React, { useState, useEffect } from 'react';
import { api } from './utils/api';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { 
  LogOut, ShieldAlert, Plus, Edit2, Trash2, Key, 
  Home, ChevronRight, LayoutGrid, CheckSquare, FileText
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('homescreen_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('homescreen_user') || 'null'));
  
  // App views
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'admin'
  const [loading, setLoading] = useState(true);
  
  // Auth Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboardId, setActiveDashboardId] = useState(null);
  
  // Dashboard Modals
  const [createDbOpen, setCreateDbOpen] = useState(false);
  const [renameDbOpen, setRenameDbOpen] = useState(false);
  const [dbName, setDbName] = useState('');

  // Password Modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // Fetch current user and dashboards if token exists
  useEffect(() => {
    const initApp = async () => {
      if (token) {
        try {
          // Verify token is still valid
          const profile = await api.getMe();
          setUser(profile.user);
          localStorage.setItem('homescreen_user', JSON.stringify(profile.user));
          
          // Load dashboards
          await fetchDashboards();
        } catch (err) {
          handleLogout();
        }
      }
      setLoading(false);
    };
    initApp();
  }, [token]);

  const fetchDashboards = async () => {
    try {
      const data = await api.getDashboards();
      setDashboards(data);
      if (data.length > 0) {
        // Set first dashboard active if none selected
        setActiveDashboardId(prev => prev && data.some(d => d.id === prev) ? prev : data[0].id);
      }
    } catch (err) {
      console.error('Failed to load dashboards', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await api.login(loginUsername, loginPassword);
      localStorage.setItem('homescreen_token', data.token);
      localStorage.setItem('homescreen_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('homescreen_token');
    localStorage.removeItem('homescreen_user');
    setToken(null);
    setUser(null);
    setDashboards([]);
    setActiveDashboardId(null);
    setCurrentView('dashboard');
  };

  // Dashboard operations
  const handleCreateDashboard = async (e) => {
    e.preventDefault();
    if (!dbName.trim()) return;

    try {
      const newDb = await api.createDashboard(dbName.trim());
      setDashboards([...dashboards, newDb]);
      setActiveDashboardId(newDb.id);
      setCreateDbOpen(false);
      setDbName('');
    } catch (err) {
      alert(err.message || 'Failed to create dashboard');
    }
  };

  const handleRenameDashboard = async (e) => {
    e.preventDefault();
    if (!dbName.trim() || !activeDashboardId) return;

    try {
      const updated = await api.updateDashboard(activeDashboardId, dbName.trim());
      setDashboards(dashboards.map(d => d.id === activeDashboardId ? updated : d));
      setRenameDbOpen(false);
      setDbName('');
    } catch (err) {
      alert(err.message || 'Failed to rename dashboard');
    }
  };

  const handleDeleteDashboard = async () => {
    if (!activeDashboardId) return;
    if (dashboards.length <= 1) {
      alert("You cannot delete the only remaining dashboard.");
      return;
    }
    
    const activeDb = dashboards.find(d => d.id === activeDashboardId);
    if (!window.confirm(`Are you sure you want to delete dashboard "${activeDb?.name}"? All widgets inside it will be permanently deleted.`)) {
      return;
    }

    try {
      await api.deleteDashboard(activeDashboardId);
      const remaining = dashboards.filter(d => d.id !== activeDashboardId);
      setDashboards(remaining);
      setActiveDashboardId(remaining[0].id);
    } catch (err) {
      alert(err.message || 'Failed to delete dashboard');
    }
  };

  // Password reset operations
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    try {
      await api.changePassword(oldPassword, newPassword);
      setPwdSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => {
        setPwdModalOpen(false);
        setPwdSuccess('');
      }, 1500);
    } catch (err) {
      setPwdError(err.message || 'Failed to update password');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
        Loading HomeScreen dashboard...
      </div>
    );
  }

  // --- LOGIN VIEW ---
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel auth-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <LayoutGrid size={48} className="logo-icon" />
          </div>
          <h1 className="auth-header-title">HomeScreen</h1>
          <p className="auth-subtitle">Self-Hosted Personal Workspace</p>

          {authError && (
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', color: '#fca5a5', fontSize: '0.85rem', textAlign: 'center' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                required
                className="form-input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId);

  // --- MAIN APP PANEL VIEW ---
  return (
    <div>
      {/* App Header */}
      <header className="app-header">
        <div className="logo-section">
          <LayoutGrid size={24} className="logo-icon" />
          <span className="logo-text">HomeScreen</span>
        </div>

        {/* Dashboard Switcher Tabs (Only if we are not in admin view) */}
        {currentView === 'dashboard' && (
          <div className="nav-tabs">
            {dashboards.map(db => (
              <button
                key={db.id}
                className={`nav-tab ${activeDashboardId === db.id ? 'active' : ''}`}
                onClick={() => setActiveDashboardId(db.id)}
              >
                {db.name}
              </button>
            ))}
            <button 
              className="nav-tab" 
              onClick={() => {
                setDbName('');
                setCreateDbOpen(true);
              }}
              title="Create Dashboard"
              style={{ padding: '0.5rem' }}
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        <div className="header-actions">
          {/* Active Dashboard Controls (Only if in dashboard view) */}
          {currentView === 'dashboard' && activeDashboard && (
            <div style={{ display: 'flex', gap: '0.25rem', borderRight: '1px solid var(--border-glass)', paddingRight: '1rem', marginRight: '0.25rem' }}>
              <button 
                className="btn btn-secondary btn-icon" 
                onClick={() => {
                  setDbName(activeDashboard.name);
                  setRenameDbOpen(true);
                }} 
                title="Rename Active Dashboard"
                style={{ padding: '0.45rem' }}
              >
                <Edit2 size={14} />
              </button>
              <button 
                className="btn btn-secondary btn-icon" 
                onClick={handleDeleteDashboard} 
                title="Delete Active Dashboard"
                style={{ padding: '0.45rem', color: 'var(--danger)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {/* Admin panel switch */}
          {user?.role === 'admin' && (
            <button 
              className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentView(prev => prev === 'admin' ? 'dashboard' : 'admin')}
            >
              <ShieldAlert size={16} />
              {currentView === 'admin' ? 'Dashboard' : 'Admin Panel'}
            </button>
          )}

          {/* Change Password button */}
          <button className="btn btn-secondary btn-icon" onClick={() => setPwdModalOpen(true)} title="Change Password">
            <Key size={16} />
          </button>

          {/* Logout button */}
          <button className="btn btn-secondary btn-icon" onClick={handleLogout} title="Log Out" style={{ color: 'var(--danger)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main>
        {currentView === 'admin' ? (
          <AdminPanel onBack={() => setCurrentView('dashboard')} />
        ) : (
          activeDashboardId && <Dashboard dashboardId={activeDashboardId} />
        )}
      </main>

      {/* CREATE DASHBOARD MODAL */}
      {createDbOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create Dashboard</h2>
            </div>
            
            <form onSubmit={handleCreateDashboard}>
              <div className="form-group">
                <label className="form-label">Dashboard Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="e.g. Work, Entertainment, Home"
                  autoFocus
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateDbOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Dashboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME DASHBOARD MODAL */}
      {renameDbOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Rename Dashboard</h2>
            </div>
            
            <form onSubmit={handleRenameDashboard}>
              <div className="form-group">
                <label className="form-label">Dashboard Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="e.g. Work, Entertainment, Home"
                  autoFocus
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRenameDbOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {pwdModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Change Password</h2>
            </div>

            {pwdError && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                {pwdError}
              </div>
            )}
            
            {pwdSuccess && (
              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', color: '#a7f3d0', fontSize: '0.85rem' }}>
                {pwdSuccess}
              </div>
            )}
            
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Old Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter old password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setPwdModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
