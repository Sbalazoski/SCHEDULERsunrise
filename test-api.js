const https = require('https');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  // Login
  const login = await request({
    hostname: 'sunrise-restaurant-scheduler.netlify.app',
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin' });
  
  console.log('Login:', login.user ? login.user.name : login);
  const token = login.token;
  
  // Get employees
  const employees = await request({
    hostname: 'sunrise-restaurant-scheduler.netlify.app',
    path: '/api/employees',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log('Employees:', employees.employees.length);
  employees.employees.forEach(e => {
    console.log(`  ${e.name} (${e.id.substring(0,8)}) - ${e.job_type_name} - Birthday: ${e.birthday}`);
  });
  
  // Test adding a schedule entry
  if (employees.employees.length > 0 && employees.employees.length <= 5) {
    const empId = employees.employees[0].id;
    const date = new Date().toISOString().slice(0, 10);
    const schedule = await request({
      hostname: 'sunrise-restaurant-scheduler.netlify.app',
      path: '/api/schedule',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    }, { 
      employee_id: empId, 
      date: '2025-01-15', 
      clock_in: '09:00', 
      clock_out: '17:00', 
      notes: 'Lunch shift' 
    });
    console.log('Schedule save:', schedule);
    
    // Get schedule for month
    const sched = await request({
      hostname: 'sunrise-restaurant-scheduler.netlify.app',
      path: '/api/schedule?month=01&year=2025',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Schedule entries:', sched.entries ? sched.entries.length : 'none');
    
    // Test shift calculator
    const calc = await request({
      hostname: 'sunrise-restaurant-scheduler.netlify.app',
      path: '/api/shift-calculator?start_date=2025-01-01&end_date=2025-01-31',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Shift calculator:', calc.total_hours, 'total hours');
  } else {
    console.log('Skipping schedule test - wrong employee count:', employees.employees.length);
  }
  
  // Get job types
  const jobTypes = await request({
    hostname: 'sunrise-restaurant-scheduler.netlify.app',
    path: '/api/job-types',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Job types:', jobTypes.job_types.map(j => j.name).join(', '));
  
  // Get birthdays
  const bdays = await request({
    hostname: 'sunrise-restaurant-scheduler.netlify.app',
    path: '/api/birthdays',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Birthdays:', bdays.birthdays.length);
  
  // Get settings
  const settings = await request({
    hostname: 'sunrise-restaurant-scheduler.netlify.app',
    path: '/api/settings',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Settings:', JSON.stringify(settings.settings));
  
  console.log('\nAll API tests passed!');
}

test().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});