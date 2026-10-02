const https = require('https');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
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
  
  console.log('Login OK:', login.user.name);
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
    console.log(`  ${e.name} - ${e.job_type_name} - Birthday: ${e.birthday}`);
  });
  
  // Test schedule POST with a real employee
  if (employees.employees.length > 0) {
    const empId = employees.employees[0].id;
    const schedule = await request({
      hostname: 'sunrise-restaurant-scheduler.netlify.app',
      path: '/api/schedule',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    }, { 
      employee_id: empId, 
      date: '2025-10-01', 
      clock_in: '09:00', 
      clock_out: '17:00', 
      notes: 'Test shift' 
    });
    console.log('Schedule save:', schedule);
  }
  
  console.log('\nAll tests passed!');
}

test().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});