const SQL = require('sql.js').default;
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'scheduler.sql.js');

async function init() {
  const SQLModule = await SQL();
  let db;
  if (fs.existsSync(sqlPath)) {
    const data = new Uint8Array(fs.readFileSync(sqlPath));
    db = new SQLModule.Database(data);
  } else {
    db = new SQLModule.Database();
  }

  console.log('Creating database...');
  
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

  const now = new Date().toISOString();

  // Insert helper
  function dbRun(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.run();
    stmt.free();
  }

  function dbGet(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject();
    stmt.free();
    return row.id !== undefined ? row : null;
  }

  const jobTypes = ['Server', 'Cook', 'Bartender', 'Host/Hostess', 'Dishwasher', 'Busser', 'Manager'];
  jobTypes.forEach(jt => {
    dbRun('INSERT OR IGNORE INTO job_types (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [require('uuid').v4(), jt, '#3B82F6', now]);
  });

  const adminHash = bcrypt.hashSync('admin', 10);
  const serverHash = bcrypt.hashSync('server', 10);
  
  dbRun('INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [require('uuid').v4(), 'admin', adminHash, 'admin', 'Restaurant Admin', now]);
  dbRun('INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [require('uuid').v4(), 'server', serverHash, 'server', 'Head Server', now]);

  const defaultSettings = [
    ['restaurant_name', 'Sunrise Restaurant', 'Restaurant name'],
    ['lock_timeout_minutes', '10', 'Auto-lock timeout'],
    ['overtime_threshold', '40', 'Weekly hours for OT']
  ];
  defaultSettings.forEach(s => {
    dbRun('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)', [s[0], s[1], s[2]]);
  });

  const serverRole = dbGet('SELECT id FROM job_types WHERE name = ?', ['Server']);
  const cookRole = dbGet('SELECT id FROM job_types WHERE name = ?', ['Cook']);

  const employees = [
    ['Alice Johnson', 'alice@sunrise.com', '555-0101', serverRole.id, '1990-05-15', '#3B82F6'],
    ['Bob Martinez', 'bob@sunrise.com', '555-0102', cookRole.id, '1988-11-22', '#EF4444'],
    ['Carol Smith', 'carol@sunrise.com', '555-0103', serverRole.id, '1992-03-08', '#F59E0B']
  ];

  employees.forEach(emp => {
    dbRun('INSERT OR IGNORE INTO employees (id, name, email, phone, job_type_id, birthday, color, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [require('uuid').v4(), emp[0], emp[1], emp[2], emp[3], emp[4], emp[5], now, now]);
  });

  const sqlBuffer = db.export();
  fs.writeFileSync(sqlPath, Buffer.from(sqlBuffer));

  console.log('Database created!');
  console.log('Login: admin/admin OR server/server');
  db.close();
}

init().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});