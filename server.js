const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'scheduler.db');
const db = new sqlite3.Database(dbPath);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'sunrise-scheduler-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Helpers
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// Calculate hours between clock_in and clock_out
function calculateHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const [ih, im] = clockIn.split(':').map(Number);
  const [oh, om] = clockOut.split(':').map(Number);
  let hours = (oh + om/60) - (ih + im/60);
  if (hours < 0) hours += 24; // Overnight shift
  return Math.round(hours * 10) / 10;
}

// ==================== AUTH ====================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;
    res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.session.userId, role: req.session.role, name: req.session.name } });
});

// ==================== EMPLOYEES ====================
app.get('/api/employees', requireAuth, async (req, res) => {
  const rows = await all(`
    SELECT e.*, jt.name as job_type_name, jt.color as job_type_color
    FROM employees e
    LEFT JOIN job_types jt ON e.job_type_id = jt.id
    WHERE e.is_active = 1
    ORDER BY e.name
  `);
  res.json({ employees: rows });
});

app.post('/api/employees', requireAdmin, async (req, res) => {
  const { name, email, phone, job_type_id, birthday, color } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO employees (id, name, email, phone, job_type_id, birthday, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, email, phone, job_type_id, birthday, color || '#3B82F6', now, now]
  );
  res.json({ id, success: true });
});

app.put('/api/employees/:id', requireAdmin, async (req, res) => {
  const { name, email, phone, job_type_id, birthday, color, is_active } = req.body;
  await run(
    `UPDATE employees SET name=?, email=?, phone=?, job_type_id=?, birthday=?, color=?, is_active=?, updated_at=? WHERE id=?`,
    [name, email, phone, job_type_id, birthday, color, is_active ? 1 : 0, new Date().toISOString(), req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/employees/:id', requireAdmin, async (req, res) => {
  await run('UPDATE employees SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==================== JOB TYPES ====================
app.get('/api/job-types', requireAuth, async (req, res) => {
  const rows = await all('SELECT * FROM job_types ORDER BY name');
  res.json({ job_types: rows });
});

app.post('/api/job-types', requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  const id = uuidv4();
  await run('INSERT INTO job_types (id, name, color, created_at) VALUES (?, ?, ?, ?)',
    [id, name, color || '#3B82F6', new Date().toISOString()]);
  res.json({ id, success: true });
});

// ==================== SCHEDULE ====================
// Get schedule for a month - returns entries with IN/OUT times
app.get('/api/schedule', requireAuth, async (req, res) => {
  const { month, year } = req.query;
  const datePrefix = `${year}-${month.padStart(2, '0')}`;
  const rows = await all(`
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

// Add or update a schedule entry (clock in/out)
app.post('/api/schedule', requireAuth, async (req, res) => {
  const { employee_id, date, clock_in, clock_out, notes } = req.body;
  const hours = calculateHours(clock_in, clock_out);
  const id = uuidv4();
  const now = new Date().toISOString();
  
  // Check if entry exists for this employee/date
  const existing = await get('SELECT id FROM schedule_entries WHERE employee_id = ? AND date = ?', [employee_id, date]);
  
  if (existing) {
    await run(
      `UPDATE schedule_entries SET clock_in=?, clock_out=?, hours=?, notes=?, updated_at=? WHERE id=?`,
      [clock_in, clock_out, hours, notes, now, existing.id]
    );
  } else {
    await run(
      `INSERT INTO schedule_entries (id, employee_id, date, clock_in, clock_out, hours, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, employee_id, date, clock_in, clock_out, hours, notes, now, now]
    );
  }
  
  res.json({ success: true });
});

// Bulk update - POST TO SCHEDULE
app.post('/api/schedule/bulk', requireAuth, async (req, res) => {
  const { entries } = req.body;
  const now = new Date().toISOString();
  
  for (const entry of entries) {
    const { employee_id, date, clock_in, clock_out, notes } = entry;
    const hours = calculateHours(clock_in, clock_out);
    const existing = await get('SELECT id FROM schedule_entries WHERE employee_id = ? AND date = ?', [employee_id, date]);
    
    if (existing) {
      await run(
        `UPDATE schedule_entries SET clock_in=?, clock_out=?, hours=?, notes=?, updated_at=? WHERE id=?`,
        [clock_in, clock_out, hours, notes, now, existing.id]
      );
    } else {
      await run(
        `INSERT INTO schedule_entries (id, employee_id, date, clock_in, clock_out, hours, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), employee_id, date, clock_in, clock_out, hours, notes, now, now]
      );
    }
  }
  
  res.json({ success: true, count: entries.length });
});

// Delete a schedule entry
app.delete('/api/schedule/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM schedule_entries WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==================== SHIFT CALCULATOR ====================
app.get('/api/shift-calculator', requireAuth, async (req, res) => {
  const { employee_id, start_date, end_date } = req.query;
  
  let rows;
  if (employee_id) {
    rows = await all(`
      SELECT se.*, e.name as employee_name
      FROM schedule_entries se
      JOIN employees e ON se.employee_id = e.id
      WHERE se.employee_id = ? AND se.date >= ? AND se.date <= ?
      ORDER BY se.date
    `, [employee_id, start_date, end_date]);
  } else {
    rows = await all(`
      SELECT se.*, e.name as employee_name, jt.name as job_type_name
      FROM schedule_entries se
      JOIN employees e ON se.employee_id = e.id
      LEFT JOIN job_types jt ON e.job_type_id = jt.id
      WHERE se.date >= ? AND se.date <= ?
      ORDER BY se.date, e.name
    `, [start_date, end_date]);
  }
  
  // Group by employee and sum hours
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
  const rows = await all(`
    SELECT tor.*, e.name as employee_name
    FROM time_off_requests tor
    JOIN employees e ON tor.employee_id = e.id
    ORDER BY tor.requested_at DESC
  `);
  res.json({ requests: rows });
});

app.post('/api/time-off', requireAuth, async (req, res) => {
  const { employee_id, request_type, start_date, end_date, reason } = req.body;
  const id = uuidv4();
  await run(
    `INSERT INTO time_off_requests (id, employee_id, request_type, start_date, end_date, reason, status, requested_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [id, employee_id, request_type, start_date, end_date, reason, new Date().toISOString()]
  );
  res.json({ id, success: true });
});

app.put('/api/time-off/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  await run(
    `UPDATE time_off_requests SET status=?, reviewed_at=? WHERE id=?`,
    [status, new Date().toISOString(), req.params.id]
  );
  res.json({ success: true });
});

// ==================== CALL-INS ====================
app.get('/api/call-ins', requireAuth, async (req, res) => {
  const rows = await all(`
    SELECT ci.*, e.name as employee_name
    FROM call_ins ci
    JOIN employees e ON ci.employee_id = e.id
    ORDER BY ci.called_in_at DESC
  `);
  res.json({ callIns: rows });
});

app.post('/api/call-ins', requireAuth, async (req, res) => {
  const { employee_id, date, reason } = req.body;
  const id = uuidv4();
  await run(
    `INSERT INTO call_ins (id, employee_id, date, reason, called_in_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, employee_id, date, reason, new Date().toISOString()]
  );
  res.json({ id, success: true });
});

// ==================== HOLIDAYS ====================
app.get('/api/holidays', requireAuth, async (req, res) => {
  const rows = await all('SELECT * FROM holidays ORDER BY date');
  res.json({ holidays: rows });
});

app.post('/api/holidays', requireAdmin, async (req, res) => {
  const { name, date, is_recurring, pay_multiplier } = req.body;
  const id = uuidv4();
  await run(
    `INSERT INTO holidays (id, name, date, is_recurring, pay_multiplier, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, date, is_recurring ? 1 : 0, pay_multiplier || 1.5, new Date().toISOString()]
  );
  res.json({ id, success: true });
});

app.delete('/api/holidays/:id', requireAdmin, async (req, res) => {
  await run('DELETE FROM holidays WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ==================== BIRTHDAYS ====================
app.get('/api/birthdays', requireAuth, async (req, res) => {
  const { month } = req.query;
  const rows = await all(`
    SELECT id, name, birthday, job_type_name, color
    FROM employees 
    WHERE is_active = 1
    ${month ? `AND strftime('%m', birthday) = '${month.padStart(2, '0')}'` : ''}
    ORDER BY birthday
  `);
  res.json({ birthdays: rows });
});

// Settings endpoint to include birthdays setting
app.get('/api/settings', requireAuth, async (req, res) => {
  const rows = await all('SELECT * FROM settings');
  res.json({ settings: Object.fromEntries(rows.map(s => [s.key, s.value])) });
});

app.put('/api/settings/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  res.json({ success: true });
});

// ==================== LOCK SCREEN ====================
app.post('/api/lock', requireAuth, (req, res) => {
  req.session.locked = true;
  res.json({ success: true });
});

app.post('/api/unlock', async (req, res) => {
  const { password } = req.body;
  if (!req.session.userId) return res.status(401).json({ error: 'No session' });
  const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  req.session.locked = false;
  res.json({ success: true });
});

app.get('/api/lock-status', requireAuth, (req, res) => {
  res.json({ locked: req.session.locked === true });
});

// ==================== Audit Log ====================
app.get('/api/audit-log', requireAdmin, async (req, res) => {
  const rows = await all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100');
  res.json({ logs: rows });
});

// Serve frontend - only for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});