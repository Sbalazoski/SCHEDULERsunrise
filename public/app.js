// Sunrise Scheduler - Simplified Frontend with JWT Auth
class SchedulerApp {
  constructor() {
    this.user = null;
    this.token = null;
    this.currentView = 'scheduler';
    this.currentMonth = new Date();
    this.employees = [];
    this.jobTypes = [];
    this.scheduleEntries = [];
    this.timeOffRequests = [];
    this.callIns = [];
    this.holidays = [];
    this.settings = {};

    this.init();
  }

  async init() {
    // Check if we have a saved token
    const savedToken = localStorage.getItem('scheduler_token');
    const savedUser = localStorage.getItem('scheduler_user');
    if (savedToken && savedUser) {
      this.token = savedToken;
      this.user = JSON.parse(savedUser);
      await this.loadAllData();
      this.showApp();
      this.render();
    } else {
      this.showLogin();
    }
    this.bindEvents();
  }

  bindEvents() {
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      await this.login(username, password);
    });

    // Unlock
    document.getElementById('unlock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('unlock-password').value;
      await this.unlock(password);
    });

    // Lock button
    document.getElementById('lock-btn')?.addEventListener('click', () => this.lockScreen());

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

    // Navigation
    document.querySelectorAll('.bottom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bottom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.navigateTo(btn.dataset.view);
      });
    });
  }

  async login(username, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('scheduler_token', this.token);
        localStorage.setItem('scheduler_user', JSON.stringify(this.user));
        await this.loadAllData();
        this.showApp();
        this.render();
      } else {
        this.showToast(data.error || 'Invalid credentials', 'error');
      }
    } catch {
      this.showToast('Login failed', 'error');
    }
  }

  async logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('scheduler_token');
    localStorage.removeItem('scheduler_user');
    this.showLogin();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }

  async unlock(password) {
    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        document.getElementById('lock-screen').classList.add('hidden');
        this.resetLockTimer();
      } else {
        this.showToast('Incorrect password', 'error');
      }
    } catch {
      this.showToast('Unlock failed', 'error');
    }
  }

  lockScreen() {
    document.getElementById('lock-screen').classList.remove('hidden');
    document.getElementById('unlock-password').value = '';
    document.getElementById('unlock-password').focus();
    fetch('/api/lock', { method: 'POST', headers: { 'Authorization': `Bearer ${this.token}` } });
    this.scheduleLock();
  }

  scheduleLock() {
    clearTimeout(this.lockTimer);
    const timeout = parseInt(this.settings.lock_timeout_minutes || 10) * 60 * 1000;
    this.lockTimer = setTimeout(() => this.lockScreen(), timeout);
  }

  resetLockTimer() {
    clearTimeout(this.lockTimer);
    const timeout = parseInt(this.settings.lock_timeout_minutes || 10) * 60 * 1000;
    this.lockTimer = setTimeout(() => this.lockScreen(), timeout);
  }

  showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('lock-screen').classList.add('hidden');
  }

  showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-name').textContent = this.user.name;
    document.getElementById('lock-restaurant').textContent = this.settings.restaurant_name || 'Restaurant';
  }

  // ==================== DATA LOADING ====================
  async loadAllData() {
    const headers = { 'Authorization': `Bearer ${this.token}` };
    await Promise.all([
      this.loadSettings(),
      this.loadEmployees(),
      this.loadJobTypes(),
      this.loadSchedule(),
      this.loadTimeOff(),
      this.loadCallIns(),
      this.loadHolidays()
    ]);
  }

  async loadSettings() {
    try {
      const res = await fetch('/api/settings', { headers: { 'Authorization': `Bearer ${this.token}` } });
      const data = await res.json();
      this.settings = data.settings;
      document.getElementById('restaurant-name').textContent = data.settings.restaurant_name || 'Restaurant';
      document.getElementById('lock-restaurant').textContent = data.settings.restaurant_name || 'Restaurant';
      this.scheduleLock();
    } catch (e) { console.error('Settings error:', e); }
  }

  async loadEmployees() {
    const res = await fetch('/api/employees', { headers: { 'Authorization': `Bearer ${this.token}` } });
    const data = await res.json();
    this.employees = data.employees || [];
  }

  async loadJobTypes() {
    const res = await fetch('/api/job-types', { headers: { 'Authorization': `Bearer ${this.token}` } });
    const data = await res.json();
    this.jobTypes = data.job_types || [];
  }

  async loadSchedule() {
    const month = String(this.currentMonth.getMonth() + 1).padStart(2, '0');
    const year = this.currentMonth.getFullYear();
    const res = await fetch(`/api/schedule?month=${month}&year=${year}`, { headers: { 'Authorization': `Bearer ${this.token}` } });
    const data = await res.json();
    this.scheduleEntries = data.entries || [];
  }

  async loadTimeOff() {
    const res = await fetch('/api/time-off', { headers: { 'Authorization': `Bearer ${this.token}` } });
    const data = await res.json();
    this.timeOffRequests = data.requests || [];
  }

  async loadCallIns() {
    const res = await fetch('/api/call-ins', { headers: { 'Authorization': `Bearer ${this.token}` } });
    const data = await res.json();
    this.callIns = data.callIns || [];
  }

  async loadHolidays() {
    const res = await fetch('/api/holidays', { headers: { 'Authorization': `Bearer ${this.token}` } });
    const data = await res.json();
    this.holidays = data.holidays || [];
  }

  // ==================== NAVIGATION ====================
  navigateTo(view) {
    this.currentView = view;
    const titles = {
      scheduler: 'Schedule',
      employees: 'Employees',
      calculator: 'Calculator',
      reports: 'Reports'
    };
    document.querySelector('#view-title').textContent = titles[view] || view;
    this.render();
  }

  // ==================== RENDER ====================
  render() {
    const content = document.getElementById('content');
    if (!content) return;

    switch (this.currentView) {
      case 'scheduler':
        content.innerHTML = this.renderScheduler();
        break;
      case 'employees':
        content.innerHTML = this.renderEmployees();
        break;
      case 'calculator':
        content.innerHTML = this.renderCalculator();
        break;
      case 'reports':
        content.innerHTML = this.renderReports();
        break;
    }
  }

  // ==================== SCHEDULER ====================
  renderScheduler() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[this.currentMonth.getMonth()];
    const year = this.currentMonth.getFullYear();
    const days = this.getCalendarDays();

    return `
      <div class="card">
        <div class="card-header">
          <div class="date-nav">
            <button class="btn btn-secondary btn-icon" onclick="scheduler.prevMonth()">
              <i class="fas fa-chevron-left"></i>
            </button>
            <span class="current-month">${month} ${year}</span>
            <button class="btn btn-secondary btn-icon" onclick="scheduler.nextMonth()">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-success" onclick="scheduler.postToSchedule()">
              <i class="fas fa-upload"></i> POST TO SCHEDULE
            </button>
          </div>
        </div>
        <div class="schedule-container">
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Job Type</th>
                ${days.map(d => `<th class="${d.isToday ? 'today-header' : ''}">${d.dayName}<br><span class="day-num">${d.dayNum}</span></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${this.renderEmployeeRows(days)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  getCalendarDays() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get first day of month (Sunday = 0)
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isToday: d.toISOString().split('T')[0] === todayStr
      });
    }
    return days;
  }

  renderEmployeeRows(days) {
    if (this.employees.length === 0) {
      return '<tr><td colspan="9" style="padding:2rem;text-align:center;">No employees. Add staff in the Employees tab.</td></tr>';
    }

    return this.employees.filter(e => e.is_active).map(emp => {
      const empColor = emp.color || '#3B82F6';
      const avatar = emp.name.charAt(0).toUpperCase();
      
      return `
        <tr>
          <td class="employee-row-header" style="border-left: 3px solid ${empColor};">
            <div class="employee-avatar" style="background: ${empColor};">${avatar}</div>
            ${emp.name}
          </td>
          <td style="font-size: 0.8rem; color: var(--gray-600);">
            ${emp.job_type_name || '<span style="color: var(--danger);">No role</span>'}
          </td>
          ${days.map(day => {
            const entry = this.scheduleEntries.find(e => e.employee_id === emp.id && e.date === day.date);
            if (entry) {
              return `
                <td class="has-shift" onclick="scheduler.editCell('${emp.id}', '${day.date}')">
                  <div class="in-out-display">
                    <div class="in-time">IN: ${entry.clock_in || '--'}</div>
                    <div class="out-time">OUT: ${entry.clock_out || '--'}</div>
                    <div class="hours-display">${entry.hours || 0}h</div>
                  </div>
                </td>
              `;
            }
            if (day.isCurrentMonth) {
              return `<td onclick="scheduler.editCell('${emp.id}', '${day.date}')"></td>`;
            }
            return '<td class="other-month"></td>';
          }).join('')}
        </tr>
      `;
    }).join('');
  }

  editCell(employeeId, date) {
    const emp = this.employees.find(e => e.id === employeeId);
    const entry = this.scheduleEntries.find(e => e.employee_id === employeeId && e.date === date);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${entry ? 'Edit' : 'Add'} Shift - ${emp.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <form id="shift-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" name="date" class="form-control" value="${date}" readonly>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Clock IN</label>
                <input type="time" name="clock_in" class="form-control" value="${entry?.clock_in || ''}" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Clock OUT</label>
                <input type="time" name="clock_out" class="form-control" value="${entry?.clock_out || ''}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea name="notes" class="form-control" rows="3">${entry?.notes || ''}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">${entry ? 'Update' : 'Add'} Shift</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // Auto-focus and allow quick keyboard entry
    modal.querySelector('[name="clock_in"]').focus();
    modal.querySelector('[name="clock_in"]').select();

    document.getElementById('shift-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        employee_id: employeeId,
        date: date,
        clock_in: formData.get('clock_in'),
        clock_out: formData.get('clock_out'),
        notes: formData.get('notes')
      };
      
      try {
        await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
          body: JSON.stringify(data)
        });
        await this.loadSchedule();
        this.render();
        modal.remove();
        this.showToast('Shift saved', 'success');
      } catch {
        this.showToast('Save failed', 'error');
      }
    });
  }

  prevMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.loadSchedule().then(() => this.render());
  }

  nextMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.loadSchedule().then(() => this.render());
  }

  async postToSchedule() {
    try {
      const res = await fetch('/api/schedule/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
        body: JSON.stringify({ entries: this.scheduleEntries })
      });
      if (res.ok) {
        this.showToast('Schedule posted successfully!', 'success');
        await this.loadSchedule();
        this.render();
      }
    } catch {
      this.showToast('Failed to post schedule', 'error');
    }
  }

  // ==================== EMPLOYEES ====================
  renderEmployees() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-users"></i> Employees</h3>
          ${this.user.role === 'admin' ? '<button class="btn btn-primary" onclick="scheduler.showEmployeeModal()"><i class="fas fa-plus"></i> Add</button>' : ''}
        </div>
        <div class="card-body">
          ${this.renderEmployeeList()}
        </div>
      </div>
    `;
  }

  renderEmployeeList() {
    if (this.employees.length === 0) {
      return '<p style="text-align: center; padding: 2rem;">No employees yet.</p>';
    }
    return this.employees.filter(e => e.is_active).map(e => {
      const avatar = e.name.charAt(0).toUpperCase();
      const color = e.color || '#3B82F6';
      const isBirthday = e.birthday && new Date(e.birthday).toISOString().slice(5, 10) === 
                        new Date().toISOString().slice(5, 10);
      
      return `
        <div class="employee-item">
          <div class="employee-avatar" style="background: ${color};">${avatar}</div>
          <div class="employee-details">
            <div><strong>${e.name}</strong> ${isBirthday ? '<span class="birthday-badge">Birthday Today!</span>' : ''}</div>
            <div class="employee-role">${e.job_type_name || 'No role'} | ${e.birthday ? 'DOB: ' + new Date(e.birthday).toLocaleDateString() : ''}</div>
            ${e.phone ? `<div style="font-size: 0.75rem; color: var(--gray-500);">${e.phone}</div>` : ''}
          </div>
          ${this.user.role === 'admin' ? `
            <div class="employee-actions">
              <button class="btn btn-ghost btn-icon" onclick="scheduler.showEmployeeModal('${e.id}')"><i class="fas fa-edit"></i></button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  showEmployeeModal(employeeId = null) {
    const isEdit = employeeId !== null;
    const emp = this.employees.find(e => e.id === employeeId);
    const roleOptions = this.jobTypes.map(jt => 
      `<option value="${jt.id}" ${emp?.job_type_id === jt.id ? 'selected' : ''}>${jt.name}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? 'Edit' : 'Add'} Employee</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <form id="employee-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input type="text" name="name" class="form-control" value="${emp?.name || ''}" required>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Email</label>
                <input type="email" name="email" class="form-control" value="${emp?.email || ''}">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Phone</label>
                <input type="tel" name="phone" class="form-control" value="${emp?.phone || ''}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Job Type</label>
              <select name="job_type_id" class="form-control">${roleOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Birthday</label>
              <input type="date" name="birthday" class="form-control" value="${emp?.birthday || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Color</label>
              <input type="color" name="color" class="form-control" style="height:40px;padding:0;" value="${emp?.color || '#3B82F6'}">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add'} Employee</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('employee-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        job_type_id: formData.get('job_type_id'),
        birthday: formData.get('birthday'),
        color: formData.get('color'),
        is_active: true
      };
      
      const url = isEdit ? `/api/employees/${employeeId}` : '/api/employees';
      const method = isEdit ? 'PUT' : 'POST';
      
      try {
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
          body: JSON.stringify(data)
        });
        await this.loadEmployees();
        modal.remove();
        this.render();
        this.showToast(`Employee ${isEdit ? 'updated' : 'added'}`, 'success');
      } catch {
        this.showToast('Save failed', 'error');
      }
    });
  }

  // ==================== CALCULATOR ====================
  renderCalculator() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-calculator"></i> Shift Calculator</h3>
        </div>
        <div class="card-body">
          <form id="calc-form" style="margin-bottom: 1.5rem;">
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Employee</label>
                <select name="employee_id" class="form-control">
                  <option value="">All Employees</option>
                  ${this.employees.filter(e => e.is_active).map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Start Date</label>
                <input type="date" name="start_date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">End Date</label>
                <input type="date" name="end_date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group" style="display: flex; align-items: flex-end;">
                <button type="button" class="btn btn-primary" onclick="scheduler.calcCalculate()">Calculate</button>
              </div>
            </div>
          </form>
          <div id="calc-results"></div>
        </div>
      </div>
    `;
  }

  async calcCalculate() {
    const form = document.getElementById('calc-form');
    const formData = new FormData(form);
    
    const params = new URLSearchParams({
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date')
    });
    if (formData.get('employee_id')) params.append('employee_id', formData.get('employee_id'));

    try {
      const res = await fetch(`/api/shift-calculator?${params}`, { headers: { 'Authorization': `Bearer ${this.token}` } });
      const data = await res.json();
      
      let html = '';
      if (data.summary.length > 0) {
        html += `<div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${data.total_hours.toFixed(1)}</div><div class="stat-label">TOTAL HOURS</div></div>
          <div class="stat-card"><div class="stat-value">${data.summary.length}</div><div class="stat-label">EMPLOYEES</div></div>
        </div>`;
        
        html += '<table class="table"><thead><tr><th>Employee</th><th>Job Type</th><th>Hours</th><th>Shifts</th><th>History</th></tr></thead><tbody>';
        
        // Sort by hours descending
        data.summary.sort((a, b) => b.total_hours - a.total_hours);
        
        for (const emp of data.summary) {
          const otBadge = emp.total_hours > 40 ? `<span class="badge badge-pending">${(emp.total_hours - 40).toFixed(1)}h OT</span>` : '';
          html += `<tr>
            <td><strong>${emp.employee_name}</strong></td>
            <td>${emp.job_type_name || 'N/A'}</td>
            <td><strong>${emp.total_hours.toFixed(1)}h</strong> ${otBadge}</td>
            <td>${emp.entries.length}</td>
            <td><button class="btn btn-ghost btn-icon" onclick="scheduler.showHistory('${emp.employee_id}', '${formData.get('start_date')}', '${formData.get('end_date')}')"><i class="fas fa-history"></i></button></td>
          </tr>`;
        }
        html += '</tbody></table>';
      } else {
        html = '<p style="color: var(--gray-600);">No schedule entries found for this period.</p>';
      }
      
      document.getElementById('calc-results').innerHTML = html;
    } catch {
      this.showToast('Calculation failed', 'error');
    }
  }

  async showHistory(employeeId, startDate, endDate) {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return;

    try {
      const res = await fetch(`/api/shift-calculator?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`, 
        { headers: { 'Authorization': `Bearer ${this.token}` } });
      const data = await res.json();
      
      let rows = '';
      data.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      for (const e of data.entries) {
        const d = new Date(e.date);
        const isToday = e.date === new Date().toISOString().split('T')[0];
        rows += `<tr class="${isToday ? 'today-row' : ''}">
          <td>${e.date}</td>
          <td>${d.toLocaleDateString('en-US', { weekday: 'short' })}</td>
          <td>${e.clock_in || '--'}</td>
          <td>${e.clock_out || '--'}</td>
          <td><strong>${e.hours ? e.hours.toFixed(1) + 'h' : '--'}</strong></td>
          <td>${e.notes || ''}</td>
        </tr>`;
      }
      
      const html = `
        <div class="modal" onclick="this.remove()">
          <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title"><i class="fas fa-history"></i> ${emp.name} - Work History</h3>
              <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <p style="margin-bottom: 1rem;"><strong>Total Hours:</strong> ${data.total_hours.toFixed(1)}h over ${data.entries.length} shifts</p>
              <table class="table">
                <thead><tr><th>Date</th><th>Day</th><th>Clock IN</th><th>Clock OUT</th><th>Hours</th><th>Notes</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      
      // Actually, let's make the modal not close on outside click for better UX
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = html;
      document.body.appendChild(modal);
    } catch (err) {
      this.showToast('Failed to load history', 'error');
    }
  }

  // ==================== REPORTS ====================
  renderReports() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-chart-bar"></i> Reports</h3>
        </div>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${this.scheduleEntries.length}</div><div class="stat-label">Schedule Entries</div></div>
            <div class="stat-card"><div class="stat-value">${this.timeOffRequests.filter(r => r.status === 'pending').length}</div><div class="stat-label">Pending Time-Off</div></div>
            <div class="stat-card"><div class="stat-value">${this.callIns.length}</div><div class="stat-label">Call-Ins</div></div>
            <div class="stat-card"><div class="stat-value">${this.holidays.length}</div><div class="stat-label">Holidays</div></div>
          </div>

          <div style="margin-top: 2rem;">
            <h4><i class="fas fa-birthday-cake"></i> Upcoming Birthdays</h4>
            ${this.renderBirthdays()}
          </div>

          <div style="margin-top: 2rem;">
            <h4><i class="fas fa-file-export"></i> Data Export</h4>
            <button class="btn btn-secondary" onclick="scheduler.exportData()">
              <i class="fas fa-download"></i> Export All Data
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderBirthdays() {
    if (this.employees.length === 0) return '<p>No employees</p>';
    
    const today = new Date();
    const upcoming = this.employees.filter(e => e.birthday).map(e => {
      const bday = new Date(e.birthday);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
      
      if (thisYear >= today && thisYear <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        return { emp: e, date: thisYear };
      }
      if (nextYear <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        return { emp: e, date: nextYear };
      }
      return null;
    }).filter(Boolean);
    
    upcoming.sort((a, b) => a.date - b.date);
    
    if (upcoming.length === 0) return '<p>No birthdays in next 30 days</p>';
    
    return upcoming.map(u => {
      const daysDiff = Math.ceil((u.date - today) / (24 * 60 * 60 * 1000));
      const color = u.emp.color || '#3B82F6';
      const avatar = u.emp.name.charAt(0).toUpperCase();
      return `
        <div class="employee-item">
          <div class="employee-avatar" style="background: ${color};">${avatar}</div>
          <div class="employee-details">
            <strong>${u.emp.name}</strong> - ${u.emp.birthday ? new Date(u.emp.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
          </div>
          <span class="badge badge-pending" style="margin-left: auto;">${daysDiff === 0 ? 'Today!' : daysDiff === 1 ? 'Tomorrow' : daysDiff + ' days'}</span>
        </div>
      `;
    }).join('');
  }

  exportData() {
    const data = {
      employees: this.employees,
      schedule_entries: this.scheduleEntries,
      job_types: this.jobTypes,
      time_off_requests: this.timeOffRequests,
      call_ins: this.callIns,
      holidays: this.holidays
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduler-export.json';
    a.click();
    this.showToast('Data exported', 'success');
  }

  // ==================== UTILITIES ====================
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
}

let scheduler;
document.addEventListener('DOMContentLoaded', () => {
  scheduler = new SchedulerApp();
});
window.scheduler = scheduler;