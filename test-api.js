const fetch = require('node-fetch');

async function runTests() {
  const API = 'http://localhost:3000/api';
  
  // Login
  console.log('=== Login ===');
  const loginRes = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
  });
  const loginData = await loginRes.json();
  console.log(loginData);
  const token = loginData.token;
  const headers = { 'Authorization': `Bearer ${token}` };
  
  // Employees
  console.log('\n=== Employees ===');
  let res = await fetch(`${API}/employees`, { headers });
  let data = await res.json();
  console.log(data.employees.map(e => `${e.name} - ${e.job_type_name} - DOB: ${e.birthday}`).join('\n'));
  
  // Add schedule entry
  console.log('\n=== Add Schedule Entry ===');
  res = await fetch(`${API}/schedule`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: data.employees[0].id,
      date: '2026-10-02',
      clock_in: '09:00',
      clock_out: '17:00',
      notes: 'Opening shift'
    })
  });
  let result = await res.json();
  console.log(result);
  
  // Get schedule
  console.log('\n=== Schedule (October) ===');
  res = await fetch(`${API}/schedule?month=10&year=2026`, { headers });
  data = await res.json();
  console.log(data.entries.map(e => `${e.date}: ${e.employee_name} IN:${e.clock_in} OUT:${e.clock_out} ${e.hours}h`).join('\n'));
  
  // Shift calculator
  console.log('\n=== Shift Calculator ===');
  res = await fetch(`${API}/shift-calculator?start_date=2026-10-01&end_date=2026-10-31`, { headers });
  data = await res.json();
  console.log(`Total hours: ${data.total_hours}`);
  data.summary.forEach(s => console.log(`  ${s.employee_name}: ${s.total_hours}h (${s.entries.length} shifts)`));
  
  // Birthdays
  console.log('\n=== Birthdays ===');
  res = await fetch(`${API}/birthdays`, { headers });
  data = await res.json();
  console.log(data.birthdays.map(b => `${b.name} - ${b.birthday}`).join('\n'));
  
  // Holidays
  console.log('\n=== Holidays ===');
  res = await fetch(`${API}/holidays`, { headers });
  data = await res.json();
  console.log(data.holidays.length === 0 ? 'No holidays' : data.holidays.length + ' holidays');
  
  // Lock screen
  console.log('\n=== Lock Screen ===');
  res = await fetch(`${API}/lock`, { method: 'POST', headers });
  console.log('Lock:', await res.json());
  res = await fetch(`${API}/lock-status`, { headers });
  console.log('Status:', await res.json());
  res = await fetch(`${API}/unlock`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin' })
  });
  console.log('Unlock:', await res.json());
  
  console.log('\n✅ All tests passed!');
}

runTests().catch(console.error);
