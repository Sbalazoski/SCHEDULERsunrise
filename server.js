const SQL = require('sql.js').default;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'sunrise-scheduler-jwt-secret-2024';
const sqlPath = path.join(__dirname, 'scheduler.sql.js');

let db = null;
let SQLModule = null;

async function getDb() {
  if (db) return db;
  if (!SQLModule) {
    SQLModule = await SQL();
  }
  
  if (fs.existsSync(sqlPath)) {
    const data = new Uint8Array(fs.readFileSync(sqlPath));
    db = new SQLModule.Database(data);
  } else {
    db = new SQLModule.Database();
    initializeDb(db);
  }
  
  return db;
}

function dbRun(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.run();
  stmt.free();
  saveDb();
}

function dbGet(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (!stmt.step()) { stmt.free(); return null; }
  const row = stmt.getAsObject();
  stmt.free();
  return row.id !== undefined ? row : null;
}

function dbAll(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function saveDb() {
  try {
    if (db) {
      const sqlBuffer = db.export();
      fs.writeFileSync(sqlPath, Buffer.from(sqlBuffer));
    }
  } catch (e) {
    // Ignore save errors
  }
}

function initializeDb(db) {
  const now = new Date().toISOString();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'server')), name TEXT NOT NULL, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS job_types (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT '#3B82F6', created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, job_type_id TEXT,
      birthday TEXT, color TEXT DEFAULT '#3B82F6', is_active INTEGER DEFAULT 1,
      created_at TEXT, updated_at TEXT,
      FOREIGN KEY (job_type_id) REFERENCES job_types(id)
    );
    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, date TEXT NOT NULL,
      clock_in TEXT, clock_out TEXT, hours REAL, notes TEXT, is_pto INTEGER DEFAULT 0,
      created_at TEXT, updated_at TEXT, FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS time_off_requests (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, request_type TEXT NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT, status TEXT DEFAULT 'pending',
      requested_at TEXT, reviewed_at TEXT, reviewed_by TEXT, FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS call_ins (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, date TEXT NOT NULL,
      reason TEXT, called_in_at TEXT, FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL,
      is_recurring INTEGER DEFAULT 0, pay_multiplier REAL DEFAULT 1.5, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL,
      entity_id TEXT, old_values TEXT, new_values TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT
    );
  `);

  const jobTypes = ['Server', 'Cook', 'Bartender', 'Host/Hostess', 'Dishwasher', 'Busser', 'Manager'];
  jobTypes.forEach(jt => {
    db.prepare('INSERT OR IGNORE INTO job_types (id, name, color, created_at) VALUES (?, ?, ?, ?)')
      .bind([uuidv4(), jt, '#3B82F6', now]).run();
  });

  const adminHash = bcrypt.hashSync('admin', 10);
  const serverHash = bcrypt.hashSync('server', 10);
  db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind([uuidv4(), 'admin', adminHash, 'admin', 'Restaurant Admin', now]).run();
  db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind([uuidv4(), 'server', serverHash, 'server', 'Head Server', now]).run();

  const settings = [
    ['restaurant_name', 'Sunrise Restaurant', 'Restaurant name'],
    ['lock_timeout_minutes', '10', 'Auto-lock timeout'],
    ['overtime_threshold', '40', 'Weekly hours for OT']
  ];
  settings.forEach(s => {
    db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)')
      .bind([s[0], s[1], s[2]]).run();
  });

  saveDb();
}

const { v4: uuidv4 } = require('uuid');

function calculateHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const [ih, im] = clockIn.split(':').map(Number);
  const [oh, om] = clockOut.split(':').map(Number);
  let hours = (oh + om / 60) - (ih + im / 60);
  if (hours < 0) hours += 24;
  return Math.round(hours * 10) / 10;
}

// ===== Express app =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Initialize DB on startup
async function ensureDb() {
  if (!db) {
    SQLModule = await SQL();
    if (fs.existsSync(sqlPath)) {
      const data = new Uint8Array(fs.readFileSync(sqlPath));
      db = new SQLModule.Database(data);
    } else {
      db = new SQLModule.Database();
      initializeDb(db);
    }
  }
}

ensureDb().then(() => {
  console.log('Database ready');
}).catch(err => {
  console.error('DB init error:', err);
});

// ==================== AUTH ====================
app.post('/api/login', async (req, res) => {
  await ensureDb();
  try {
    const { username, password } = req.body;
    const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, username: user.username }, JWT_SECRET);
    res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name }, token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, role: req.user.role, name: req.user.name } });
});

// ==================== EMPLOYEES ====================
app.get('/api/employees', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll(`
    SELECT e.*, jt.name as job_type_name, jt.color as job_type_color
    FROM employees e
    LEFT JOIN job_types jt ON e.job_type_id = jt.id
    WHERE e.is_active = 1
    ORDER BY e.name
  `);
  res.json({ employees: rows });
});

app.post('/api/employees', requireAdmin, async (req, res) => {
  await ensureDb();
  const { name, email, phone, job_type_id, birthday, color } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  dbRun(
    `INSERT INTO employees (id, name, email, phone, job_type_id, birthday, color, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, name, email, phone, job_type_id, birthday, color || '#3B82F6', now, now]
  );
  res.json({ id, success: true });
});

app.put('/api/employees/:id', requireAdmin, async (req, res) => {
  await ensureDb();
  const { name, email, phone, job_type_id, birthday, color, is_active } = req.body;
  dbRun(
    `UPDATE employees SET name=?, email=?, phone=?, job_type_id=?, birthday=?, color=?, is_active=?, updated_at=? WHERE id=?`,
    [name, email, phone, job_type_id, birthday, color, is_active ? 1 : 0, new Date().toISOString(), req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/employees/:id', requireAdmin, async (req, res) => {
  await ensureDb();
  dbRun('UPDATE employees SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==================== JOB TYPES ====================
app.get('/api/job-types', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll('SELECT * FROM job_types ORDER BY name');
  res.json({ job_types: rows });
});

app.post('/api/job-types', requireAdmin, async (req, res) => {
  await ensureDb();
  const { name, color } = req.body;
  const id = uuidv4();
  dbRun('INSERT OR IGNORE INTO job_types (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    [id, name, color || '#3B82F6', new Date().toISOString()]);
  res.json({ id, success: true });
});

// ==================== SCHEDULE ====================
app.get('/api/schedule', requireAuth, async (req, res) => {
  await ensureDb();
  const { month, year } = req.query;
  const datePrefix = `${year}-${month.padStart(2, '0')}`;
  const rows = dbAll(`
    SELECT se.*, e.name as employee_name, e.color as employee_color,
           jt.name as job_type_name, jt.color as job_type_color
    FROM schedule_entries se
    JOIN employees e ON se.employee_id = e.id
    LEFT JOIN job_types jt ON e.job_type_id = jt.id
    WHERE se.date LIKE '${datePrefix}%'
    ORDER BY se.date, e.name
  `);
  res.json({ entries: rows });
});

app.post('/api/schedule', requireAuth, async (req, res) => {
  await ensureDb();
  const { employee_id, date, clock_in, clock_out, notes } = req.body;
  const hours = calculateHours(clock_in, clock_out);
  const now = new Date().toISOString();
  const existing = dbGet('SELECT id FROM schedule_entries WHERE employee_id = ? AND date = ?', [employee_id, date]);
  
  if (existing) {
    dbRun(
      `UPDATE schedule_entries SET clock_in=?, clock_out=?, hours=?, notes=?, updated_at=? WHERE id=?`,
      [clock_in, clock_out, hours, notes, now, existing.id]
    );
  } else {
    dbRun(
      `INSERT INTO schedule_entries (id, employee_id, date, clock_in, clock_out, hours, notes, is_pto, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [uuidv4(), employee_id, date, clock_in, clock_out, hours, notes, now, now]
    );
  }
  res.json({ success: true });
});

app.post('/api/schedule/bulk', requireAuth, async (req, res) => {
  await ensureDb();
  const { entries } = req.body;
  const now = new Date().toISOString();
  
  entries.forEach(entry => {
    const { employee_id, date, clock_in, clock_out, notes } = entry;
    const hours = calculateHours(clock_in, clock_out);
    const existing = dbGet('SELECT id FROM schedule_entries WHERE employee_id = ? AND date = ?', [employee_id, date]);
    
    if (existing) {
      dbRun(
        `UPDATE schedule_entries SET clock_in=?, clock_out=?, hours=?, notes=?, updated_at=? WHERE id=?`,
        [clock_in, clock_out, hours, notes, now, existing.id]
      );
    } else {
      dbRun(
        `INSERT INTO schedule_entries (id, employee_id, date, clock_in, clock_out, hours, notes, is_pto, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [uuidv4(), employee_id, date, clock_in, clock_out, hours, notes, now, now]
      );
    }
  });
  res.json({ success: true, count: entries.length });
});

app.delete('/api/schedule/:id', requireAuth, async (req, res) => {
  await ensureDb();
  dbRun('DELETE FROM schedule_entries WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==================== SHIFT CALCULATOR ====================
app.get('/api/shift-calculator', requireAuth, async (req, res) => {
  await ensureDb();
  const { employee_id, start_date, end_date } = req.query;
  
  let rows;
  if (employee_id) {
    rows = dbAll(`
      SELECT se.*, e.name as employee_name
      FROM schedule_entries se
      JOIN employees e ON se.employee_id = e.id
      WHERE se.employee_id = '${employee_id}' AND se.date >= '${start_date}' AND se.date <= '${end_date}'
      ORDER BY se.date DESC
    `);
  } else {
    rows = dbAll(`
      SELECT se.*, e.name as employee_name, jt.name as job_type_name
      FROM schedule_entries se
      JOIN employees e ON se.employee_id = e.id
      LEFT JOIN job_types jt ON e.job_type_id = jt.id
      WHERE se.date >= '${start_date}' AND se.date <= '${end_date}'
      ORDER BY se.date DESC, e.name
    `);
  }

  const byEmployee = {};
  rows.forEach(r => {
    if (!byEmployee[r.employee_id]) {
      byEmployee[r.employee_id] = {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        job_type_name: r.job_type_name,
        total_hours: 0,
        entries: []
      };
    }
    byEmployee[r.employee_id].total_hours += r.hours || 0;
    byEmployee[r.employee_id].entries.push(r);
  });

  const result = Object.values(byEmployee).map(d => ({
    ...d,
    total_hours: Math.round(d.total_hours * 10) / 10
  }));

  res.json({ 
    entries: rows, 
    summary: result,
    total_hours: result.reduce((sum, e) => sum + e.total_hours, 0)
  });
});

// ==================== TIME OFF ====================
app.get('/api/time-off', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll(`
    SELECT tor.*, e.name as employee_name
    FROM time_off_requests tor
    JOIN employees e ON tor.employee_id = e.id
    ORDER BY tor.requested_at DESC
  `);
  res.json({ requests: rows });
});

app.post('/api/time-off', requireAuth, async (req, res) => {
  await ensureDb();
  const { employee_id, request_type, start_date, end_date, reason } = req.body;
  const id = uuidv4();
  dbRun(
    `INSERT INTO time_off_requests (id, employee_id, request_type, start_date, end_date, reason, status, requested_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [id, employee_id, request_type, start_date, end_date, reason, new Date().toISOString()]
  );
  res.json({ id, success: true });
});

app.put('/api/time-off/:id', requireAdmin, async (req, res) => {
  await ensureDb();
  const { status } = req.body;
  dbRun(
    `UPDATE time_off_requests SET status=?, reviewed_at=? WHERE id=?`,
    [status, new Date().toISOString(), req.params.id]
  );
  res.json({ success: true });
});

// ==================== CALL-INS ====================
app.get('/api/call-ins', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll(`
    SELECT ci.*, e.name as employee_name
    FROM call_ins ci
    JOIN employees e ON ci.employee_id = e.id
    ORDER BY ci.called_in_at DESC
  `);
  res.json({ callIns: rows });
});

app.post('/api/call-ins', requireAuth, async (req, res) => {
  await ensureDb();
  const { employee_id, date, reason } = req.body;
  const id = uuidv4();
  dbRun(
    `INSERT INTO call_ins (id, employee_id, date, reason, called_in_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, employee_id, date, reason, new Date().toISOString()]
  );
  res.json({ id, success: true });
});

// ==================== HOLIDAYS ====================
app.get('/api/holidays', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll('SELECT * FROM holidays ORDER BY date');
  res.json({ holidays: rows });
});

app.post('/api/holidays', requireAdmin, async (req, res) => {
  await ensureDb();
  const { name, date, is_recurring, pay_multiplier } = req.body;
  const id = uuidv4();
  dbRun(
    `INSERT INTO holidays (id, name, date, is_recurring, pay_multiplier, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, date, is_recurring ? 1 : 0, pay_multiplier || 1.5, new Date().toISOString()]
  );
  res.json({ id, success: true });
});

app.delete('/api/holidays/:id', requireAdmin, async (req, res) => {
  await ensureDb();
  dbRun('DELETE FROM holidays WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==================== BIRTHDAYS ====================
app.get('/api/birthdays', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll(`
    SELECT e.id, e.name, e.birthday, e.color,
           jt.name as job_type_name
    FROM employees e
    LEFT JOIN job_types jt ON e.job_type_id = jt.id
    WHERE e.birthday IS NOT NULL
    ORDER BY e.birthday
  `);
  res.json({ birthdays: rows });
});

// ==================== SETTINGS ====================
app.get('/api/settings', requireAuth, async (req, res) => {
  await ensureDb();
  const rows = dbAll('SELECT * FROM settings');
  res.json({ settings: Object.fromEntries(rows.map(s => [s.key, s.value])) });
});

app.put('/api/settings/:key', requireAdmin, async (req, res) => {
  await ensureDb();
  const { key } = req.params;
  const { value } = req.body;
  dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  res.json({ success: true });
});

// ==================== AUDIT LOG ====================
app.get('/api/audit-log', requireAdmin, async (req, res) => {
  await ensureDb();
  const rows = dbAll('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100');
  res.json({ logs: rows });
});

// ==================== LOCK SCREEN ====================
app.post('/api/lock', requireAuth, (req, res) => {
  res.json({ success: true });
});

app.post('/api/unlock', requireAuth, async (req, res) => {
  await ensureDb();
  const { password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  res.json({ success: true });
});

// Serve frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.ensureDb = ensureDb;