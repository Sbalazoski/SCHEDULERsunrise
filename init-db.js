const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = path.join(__dirname, 'scheduler.db');
const db = new sqlite3.Database(dbPath);

console.log('Creating database...');

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function init() {
  const now = new Date().toISOString();

  // Users (admin and head server)
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'server')),
      name TEXT NOT NULL,
      created_at TEXT
    )
  `);

  // Job Types (server, cook, bartender, etc.)
  await run(`
    CREATE TABLE IF NOT EXISTS job_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#3B82F6',
      created_at TEXT
    )
  `);

  // Employees (with birthday!)
  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      job_type_id TEXT,
      birthday TEXT,
      color TEXT DEFAULT '#3B82F6',
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (job_type_id) REFERENCES job_types(id)
    )
  `);

  // Schedule entries - one row per employee/day with IN/OUT
  await run(`
    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT,
      clock_out TEXT,
      hours REAL,
      notes TEXT,
      is_pto INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Time-off requests
  await run(`
    CREATE TABLE IF NOT EXISTS time_off_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      requested_at TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Call-ins (sick calls)
  await run(`
    CREATE TABLE IF NOT EXISTS call_ins (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      reason TEXT,
      called_in_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  // Holidays
  await run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      is_recurring INTEGER DEFAULT 0,
      pay_multiplier REAL DEFAULT 1.5,
      created_at TEXT
    )
  `);

  // Audit log
  await run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings
  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    )
  `);

  // Default job types
  const jobTypes = ['Server', 'Cook', 'Bartender', 'Host/Hostess', 'Dishwasher', 'Busser', 'Manager'];
  for (const jt of jobTypes) {
    await run('INSERT OR IGNORE INTO job_types (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), jt, '#3B82F6', now]);
  }

  // Default users
  const adminHash = bcrypt.hashSync('admin', 10);
  const serverHash = bcrypt.hashSync('server', 10);
  await run('INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'admin', adminHash, 'admin', 'Restaurant Admin', now]);
  await run('INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'server', serverHash, 'server', 'Head Server', now]);

  // Default settings
  const settings = [
    ['restaurant_name', 'Sunrise Restaurant', 'Restaurant name'],
    ['lock_timeout_minutes', '10', 'Auto-lock timeout'],
    ['overtime_threshold', '40', 'Weekly hours for OT']
  ];
  for (const [k, v, d] of settings) {
    await run('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)', [k, v, d]);
  }

  // Sample employees with birthdays
  const serverRole = await get('SELECT id FROM job_types WHERE name = ?', ['Server']);
  const cookRole = await get('SELECT id FROM job_types WHERE name = ?', ['Cook']);

  await run(
    'INSERT OR IGNORE INTO employees (id, name, email, phone, job_type_id, birthday, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'Alice Johnson', 'alice@sunrise.com', '555-0101', serverRole.id, '1990-05-15', '#3B82F6', now, now]);
  await run(
    'INSERT OR IGNORE INTO employees (id, name, email, phone, job_type_id, birthday, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'Bob Martinez', 'bob@sunrise.com', '555-0102', cookRole.id, '1988-11-22', '#EF4444', now, now]);
  await run(
    'INSERT OR IGNORE INTO employees (id, name, email, phone, job_type_id, birthday, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'Carol Smith', 'carol@sunrise.com', '555-0103', serverRole.id, '1992-03-08', '#F59E0B', now, now]);

  console.log('Database created!');
  console.log('Login: admin/admin OR server/server');
  db.close();
}

init().catch(err => {
  console.error('Error:', err);
  db.close();
});