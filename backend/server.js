import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, query, run, get } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'homescreen-super-secret-key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // support base64 icons in JSON
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve built frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin Only Middleware
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator permissions required' });
  }
  next();
};

// Initialize DB on Startup
initDb().then(() => {
  console.log('Database initialized successfully.');
}).catch((err) => {
  console.error('Failed to initialize database:', err);
});

// --- AUTHENTICATION API ---

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = await bcryptjs.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT id, username, role FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change Password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }

  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcryptjs.compare(oldPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid old password' });
    }

    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(newPassword, salt);
    
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN API (Users Management) ---

// List Users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await query('SELECT id, username, role FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create User
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);
    const result = await run(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hash, role]
    );

    res.status(201).json({ id: result.id, username, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update User (Admin can update role and optionally password)
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new username is taken
    if (username && username !== user.username) {
      const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const updatedUsername = username || user.username;
    const updatedRole = role || user.role;
    let updatedHash = user.password_hash;

    if (password) {
      const salt = await bcryptjs.genSalt(10);
      updatedHash = await bcryptjs.hash(password, salt);
    }

    await run(
      'UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?',
      [updatedUsername, updatedHash, updatedRole, id]
    );

    res.json({ id: parseInt(id), username: updatedUsername, role: updatedRole });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account' });
  }

  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DASHBOARD API ---

// Get User's Dashboards
app.get('/api/dashboards', authenticateToken, async (req, res) => {
  try {
    const dashboards = await query(
      'SELECT * FROM dashboards WHERE user_id = ? ORDER BY order_index ASC',
      [req.user.id]
    );

    // If user has zero dashboards, create a default one for them
    if (dashboards.length === 0) {
      const defaultDashboard = await run(
        'INSERT INTO dashboards (user_id, name, order_index) VALUES (?, ?, ?)',
        [req.user.id, 'Home', 0]
      );
      
      // Seed default widgets for this new dashboard
      const defaultWidgets = [
        {
          type: 'links',
          title: 'HomeLab Services',
          properties: JSON.stringify({
            viewMode: 'grid',
            links: [
              { id: '1', name: 'Google', url: 'https://google.com', iconType: 'favicon' },
              { id: '2', name: 'GitHub', url: 'https://github.com', iconType: 'favicon' }
            ]
          }),
          x: 0, y: 0, w: 4, h: 3, order_index: 0
        },
        {
          type: 'note',
          title: 'Sticky Note',
          properties: JSON.stringify({
            content: 'Welcome to your HomeScreen dashboard! Click edit on any card to configure or drag to rearrange.',
            color: 'yellow'
          }),
          x: 4, y: 0, w: 4, h: 3, order_index: 1
        },
        {
          type: 'todo',
          title: 'Daily Checklist',
          properties: JSON.stringify({
            items: [
              { id: 't1', text: 'Set up custom bookmarks', completed: false },
              { id: 't2', text: 'Configure custom icon image', completed: false },
              { id: 't3', text: 'Explore admin panel settings', completed: false }
            ]
          }),
          x: 8, y: 0, w: 4, h: 3, order_index: 2
        }
      ];

      for (const w of defaultWidgets) {
        await run(
          'INSERT INTO widgets (dashboard_id, type, title, properties, x, y, w, h, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [defaultDashboard.id, w.type, w.title, w.properties, w.x, w.y, w.w, w.h, w.order_index]
        );
      }

      const created = await query('SELECT * FROM dashboards WHERE user_id = ?', [req.user.id]);
      return res.json(created);
    }

    res.json(dashboards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Dashboard
app.post('/api/dashboards', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Dashboard name is required' });
  }

  try {
    const maxOrderRow = await get('SELECT MAX(order_index) as maxOrder FROM dashboards WHERE user_id = ?', [req.user.id]);
    const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

    const result = await run(
      'INSERT INTO dashboards (user_id, name, order_index) VALUES (?, ?, ?)',
      [req.user.id, name, nextOrder]
    );
    res.status(201).json({ id: result.id, name, user_id: req.user.id, order_index: nextOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Dashboard (Name / Order)
app.put('/api/dashboards/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, order_index } = req.body;

  try {
    const dashboard = await get('SELECT * FROM dashboards WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    const updatedName = name !== undefined ? name : dashboard.name;
    const updatedOrder = order_index !== undefined ? order_index : dashboard.order_index;

    await run(
      'UPDATE dashboards SET name = ?, order_index = ? WHERE id = ?',
      [updatedName, updatedOrder, id]
    );

    res.json({ id: parseInt(id), name: updatedName, order_index: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Dashboard
app.delete('/api/dashboards/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const dashboard = await get('SELECT * FROM dashboards WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    await run('DELETE FROM dashboards WHERE id = ?', [id]);
    res.json({ message: 'Dashboard deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- WIDGET API ---

// Get Widgets for Dashboard
app.get('/api/dashboards/:dashboardId/widgets', authenticateToken, async (req, res) => {
  const { dashboardId } = req.params;

  try {
    const dashboard = await get('SELECT id FROM dashboards WHERE id = ? AND user_id = ?', [dashboardId, req.user.id]);
    if (!dashboard) {
      return res.status(403).json({ error: 'Dashboard access denied' });
    }

    const widgets = await query(
      'SELECT * FROM widgets WHERE dashboard_id = ? ORDER BY order_index ASC',
      [dashboardId]
    );

    // Parse JSON properties
    const parsedWidgets = widgets.map(w => ({
      ...w,
      properties: JSON.parse(w.properties)
    }));

    res.json(parsedWidgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Widget in Dashboard
app.post('/api/dashboards/:dashboardId/widgets', authenticateToken, async (req, res) => {
  const { dashboardId } = req.params;
  const { type, title, properties, x, y, w, h } = req.body;

  if (!type || !title) {
    return res.status(400).json({ error: 'Widget type and title are required' });
  }

  try {
    const dashboard = await get('SELECT id FROM dashboards WHERE id = ? AND user_id = ?', [dashboardId, req.user.id]);
    if (!dashboard) {
      return res.status(403).json({ error: 'Dashboard access denied' });
    }

    const maxOrderRow = await get('SELECT MAX(order_index) as maxOrder FROM widgets WHERE dashboard_id = ?', [dashboardId]);
    const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

    const propsStr = JSON.stringify(properties || {});
    const result = await run(
      'INSERT INTO widgets (dashboard_id, type, title, properties, x, y, w, h, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [dashboardId, type, title, propsStr, x || 0, y || 0, w || 4, h || 3, nextOrder]
    );

    res.status(201).json({
      id: result.id,
      dashboard_id: parseInt(dashboardId),
      type,
      title,
      properties: properties || {},
      x: x || 0,
      y: y || 0,
      w: w || 4,
      h: h || 3,
      order_index: nextOrder
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Widget properties/position
app.put('/api/widgets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, properties, x, y, w, h, order_index } = req.body;

  try {
    // Verify widget belongs to user's dashboard
    const widget = await get(
      'SELECT w.* FROM widgets w JOIN dashboards d ON w.dashboard_id = d.id WHERE w.id = ? AND d.user_id = ?',
      [id, req.user.id]
    );

    if (!widget) {
      return res.status(404).json({ error: 'Widget not found or access denied' });
    }

    const updatedTitle = title !== undefined ? title : widget.title;
    const updatedProps = properties !== undefined ? JSON.stringify(properties) : widget.properties;
    const updatedX = x !== undefined ? x : widget.x;
    const updatedY = y !== undefined ? y : widget.y;
    const updatedW = w !== undefined ? w : widget.w;
    const updatedH = h !== undefined ? h : widget.h;
    const updatedOrder = order_index !== undefined ? order_index : widget.order_index;

    await run(
      'UPDATE widgets SET title = ?, properties = ?, x = ?, y = ?, w = ?, h = ?, order_index = ? WHERE id = ?',
      [updatedTitle, updatedProps, updatedX, updatedY, updatedW, updatedH, updatedOrder, id]
    );

    res.json({
      id: parseInt(id),
      dashboard_id: widget.dashboard_id,
      type: widget.type,
      title: updatedTitle,
      properties: properties !== undefined ? properties : JSON.parse(widget.properties),
      x: updatedX,
      y: updatedY,
      w: updatedW,
      h: updatedH,
      order_index: updatedOrder
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Widget
app.delete('/api/widgets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verify ownership
    const widget = await get(
      'SELECT w.id FROM widgets w JOIN dashboards d ON w.dashboard_id = d.id WHERE w.id = ? AND d.user_id = ?',
      [id, req.user.id]
    );

    if (!widget) {
      return res.status(404).json({ error: 'Widget not found or access denied' });
    }

    await run('DELETE FROM widgets WHERE id = ?', [id]);
    res.json({ message: 'Widget deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FAVICON PROXY ---
app.get('/api/favicon', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Make sure we have a protocol
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    const parsed = new URL(targetUrl);
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;

    const response = await fetch(googleFaviconUrl);
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      res.setHeader('Content-Type', contentType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (err) {
    // Fail silently to default
  }

  // Fallback: Return a transparent 1x1 png or simple placeholder
  res.status(404).send('Favicon not found');
});

// Fallback all non-API paths to serve the index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HomeScreen server running on http://0.0.0.0:${PORT}`);
});
