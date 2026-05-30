import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { ArrowLeft, UserPlus, Shield, User, Trash2, Edit2, Key } from 'lucide-react';

export default function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'password'
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.adminGetUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setModalType('create');
    setUsername('');
    setPassword('');
    setRole('user');
    setSelectedUser(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setModalType('edit');
    setUsername(user.username);
    setRole(user.role);
    setPassword(''); // leave empty to not change
    setSelectedUser(user);
    setModalOpen(true);
  };

  const handleOpenPassword = (user) => {
    setModalType('password');
    setPassword('');
    setSelectedUser(user);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (modalType === 'create') {
        await api.adminCreateUser(username, password, role);
      } else if (modalType === 'edit') {
        await api.adminUpdateUser(selectedUser.id, username, password || undefined, role);
      } else if (modalType === 'password') {
        if (!password) {
          setError('Password is required');
          return;
        }
        await api.adminUpdateUser(selectedUser.id, undefined, password, undefined);
      }
      
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Operation failed');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }
    
    try {
      await api.adminDeleteUser(user.id);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-icon" onClick={onBack} title="Back to Dashboard">
            <ArrowLeft size={18} />
          </button>
          <h1 className="logo-text" style={{ fontSize: '1.75rem' }}>User Administration</h1>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <UserPlus size={18} />
          Create User
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading users list...
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none' }}>
                    <div style={{ padding: '0.35rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-full)' }}>
                      <User size={16} className="text-secondary" />
                    </div>
                    <span style={{ fontWeight: 500 }}>{u.username}</span>
                  </td>
                  <td>
                    {u.role === 'admin' ? (
                      <span className="badge badge-admin">
                        <Shield size={10} style={{ marginRight: 4, display: 'inline' }} />
                        Admin
                      </span>
                    ) : (
                      <span className="badge badge-user">User</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-icon" onClick={() => handleOpenEdit(u)} title="Edit User">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-secondary btn-icon" onClick={() => handleOpenPassword(u)} title="Reset Password">
                        <Key size={14} />
                      </button>
                      <button 
                        className="btn btn-secondary btn-icon" 
                        onClick={() => handleDelete(u)} 
                        title="Delete User"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2 className="modal-title">
                {modalType === 'create' && 'Create User'}
                {modalType === 'edit' && `Edit "${selectedUser?.username}"`}
                {modalType === 'password' && `Change password for "${selectedUser?.username}"`}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit}>
              {modalType !== 'password' && (
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                  />
                </div>
              )}

              {modalType !== 'edit' && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    required={modalType === 'create' || modalType === 'password'}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={modalType === 'create' ? 'Enter password' : 'Enter new password'}
                  />
                </div>
              )}

              {modalType !== 'password' && (
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="user">User (Standard)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalType === 'create' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
