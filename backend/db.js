import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcryptjs from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure the data directory exists
const dbDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'homescreen.db');
const db = new sqlite3.Database(dbPath);

export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const initDb = async () => {
  // Enable foreign keys
  await run('PRAGMA foreign_keys = ON');

  // Create Users table
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
  )`);

  // Create Dashboards table
  await run(`CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Create Widgets table
  await run(`CREATE TABLE IF NOT EXISTS widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    order_index INTEGER DEFAULT 0,
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    w INTEGER DEFAULT 4,
    h INTEGER DEFAULT 3,
    FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
  )`);

  // Verify and create default admin
  const adminUser = await get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash('adminadmin', salt);
    await run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    console.log('--- DEFAULT ADMIN CREATED ---');
    console.log('Username: admin');
    console.log('Password: adminadmin');
    console.log('Please change this password immediately after logging in.');
    console.log('-----------------------------');
  }
};
