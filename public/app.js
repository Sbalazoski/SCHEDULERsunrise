// Sunrise Scheduler - Simplified Frontend
class SchedulerApp {
  constructor() {
    this.user = null;
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
    this.bindEvents();
    await this.checkAuth();
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

  async checkAuth() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        await this.loadAllData();
        this.showApp();
        this.render();
      } else {
        this.showLogin();
      }
    } catch {
      this.showLogin();
    }
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
        this.user = data.user;
        await this.loadAllData();
        this.showApp();
        this.render();
      } else {
        this.showToast('Invalid credentials', 'error');
      }
    } catch {
      this.showToast('Login failed', 'error');
    }
  }

  async logout() {
    await fetch('/api/logout', { method: 'POST' });
    this.user = null;
    this.showLogin();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }

  async unlock(password) {
    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        document.getElementById('lock-screen').classList.add('hidden');
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
    fetch('/api/lock', { method: 'POST' });
  }

  async loadAllData() {
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
      const res = await fetch('/api/settings');
      const data = await res.json();
      this.settings = data.settings;
      document.getElementById('restaurant-name').textContent = data.settings.restaurant_name || 'Restaurant';
      document.getElementById('lock-restaurant').textContent = data.settings.restaurant_name || 'Restaurant';
    } catch (e) { console.error('Settings error:', e); }
  }

  async loadEmployees() {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      this.employees = data.employees || [];
    } catch (e) { console.error('Employees error:', e); }
  }

  async loadJobTypes() {
    try {
      const res = await fetch('/api/job-types');
      const data = await res.json();
      this.jobTypes = data.job_types || [];
    } catch (e) { console.error('Job types error:', e); }
  }

  async loadSchedule() {
    const month = String(this.currentMonth.getMonth() + 1).padStart(2, '0');
    const year = this.currentMonth.getFullYear();
    try {
      const res = await fetch(`/api/schedule?month=${month}&year=${year}`);
      const data = await res.json();
      this.scheduleEntries = data.entries || [];
    } catch (e) { console.error('Schedule error:', e); }
  }

  async loadTimeOff() {
    try {
      const res = await fetch('/api/time-off');
      const data = await res.json();
      this.timeOffRequests = data.requests || [];
    } catch (e) { console.error('Time off error:', e); }
  }

  async loadCallIns() {
    try {
      const res = await fetch('/api/call-ins');
      const data = await res.json();
      this.callIns = data.callIns || [];
    } catch (e) { console.error('Call-ins error:', e); }
  }

  async loadHolidays() {
    try {
      const res = await fetch('/api/holidays');
      const data = await res.json();
      this.holidays = data.holidays || [];
    } catch (e) { console.error('Holidays error:', e); }
  }

  navigateTo(view) {
    this.currentView = view;
    const titles = {
      scheduler: 'Schedule',
      employees: 'Employees',
      calculator: 'Shift Calculator',
      reports: 'Reports & History'
    };
    document.querySelector('#view-title').textContent = titles[view] || view;
  }

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
    const days = this.getMonthDays();
    const today = new Date().toISOString().split('T')[0];

    return `
      <div class="card">
        <div class="card-header">
          <div class="date-nav">
            <button class="btn btn-secondary btn-icon" onclick="scheduler.prevMonth()"><i class="fas fa-chevron-left"></i></button>
            <span class="current-month">${this.currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button class="btn btn-secondary btn-icon" onclick="scheduler.nextMonth()"><i class="fas fa-chevron-right"></i></button>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-success" onclick="scheduler.postToSchedule()">
              <i class="fas fa-upload"></i> POST TO SCHEDULE
            </button>
          </div>
        </div>

        <div class="schedule-container">
          <div class="schedule-grid">
            <!-- Header row: Time + Day headers -->
            <div class="time-header">EMPLOYEE</div>
            ${days.map(d => `
              <div class="day-header ${d.date === today ? 'today' : ''}">
                <div class="day-name">${d.dayName}</div>
                <div class="day-date">${d.dayNumber}</div>
              </div>
            `).join('')}

            ${this.renderEmployeeRows(days, today)}
          </div>
        </div>
      </div>
    `;
  }

  getMonthDays() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay() + 1); // Sunday
    
    const days = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      if (d.getMonth() > month && i > 7) break;
      if (d.getMonth() < month && d.getMonth() !== month - 1) continue;
      
      const monthDate = d.getMonth() === month;
      days.push({
        date: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        monthDate,
        fullDate: d
      });
    }
    return days.slice(0, 35);
  }

  renderEmployeeRows(days, today) {
    if (this.employees.length === 0) return '<div style="padding:2rem;text-align:center;grid-column:1/-1;">No employees added</div>';

    return this.employees.filter(e => e.is_active).map(emp => {
      const empColor = emp.color || '#3B82F6';
      
      return `
        <div class="employee-row-header" style="border-left-color: ${empColor};">
          <div class="employee-avatar" style="background: ${empColor};">${emp.name.charAt(0)}</div>
          <div>
            <div>${emp.name}</div>
            <div style="font-size:0.7rem; color: var(--gray-500);">${this.getJobTypeName(emp.job_type_id)}</div>
          </div>
        </div>
        ${days.map(day => {
          const entry = this.scheduleEntries.find(e => e.employee_id === emp.id && e.date === day.date);
          const isToday = day.date === today;
          
          if (entry) {
            return `
              <div class="schedule-cell ${isToday ? 'today-cell' : ''}" 
                   data-employee="${emp.id}" data-date="${day.date}"
                   onclick="scheduler.editCell('${emp.id}', '${day.date}')">
                <div class="in-out-display">
                  <div class="in-time">IN: ${entry.clock_in || '--'}</div>
                  <div class="out-time">OUT: ${entry.clock_out || '--'}</div>
                  ${entry.hours ? `<div class="hours-display">${entry.hours}h</div>` : ''}
                </div>
              </div>
            `;
          }
          
          return `
            <div class="schedule-cell ${isToday ? 'today-cell' : ''}" 
                 data-employee="${emp.id}" data-date="${day.date}"
                 onclick="scheduler.editCell('${emp.id}', '${day.date}', '${day.date}')">
              <div class="cell-placeholder" style="font-size: 0.7rem; color: var(--gray-400);">+</div>
            </div>
          `;
        }).join('')}
      `;
    }).join('');
  }

  editCell(employeeId, date, cellDate = null) {
    const entry = this.scheduleEntries.find(e => e.employee_id === employeeId && e.date === date);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">${entry ? 'Edit' : 'Add'} Shift</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <form id="cell-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" name="date" class="form-control" value="${date}" readonly>
            </div>
            <div class="form-row" style="display:flex; gap:1rem;">
              <div class="form-group" style="flex:1;">
                <label class="form-label">Clock IN</label>
                <input type="time" name="clock_in" class="form-control" value="${entry?.clock_in || ''}">
              </div>
              <div class="form-group" style="flex:1;">
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
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cell-form').addEventListener('submit', async (e) => {
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        await this.loadSchedule();
        this.render();
        modal.remove();
        this.showToast('Schedule updated', 'success');
      } catch (err) {
        this.showToast('Failed to update schedule', 'error');
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
    // This is the "POST TO SCHEDULE" action - save all changes
    try {
      // The entries are already saved individually, just show confirmation
      this.showToast('Schedule posted!', 'success');
      await this.loadSchedule();
    } catch (err) {
      this.showToast('Failed to post schedule', 'error');
    }
  }

  getJobTypeName(id) {
    const jt = this.jobTypes.find(j => j.id === id);
    return jt ? jt.name : 'No role';
  }

  // ==================== EMPLOYEES ====================
  renderEmployees() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-users"></i> Employees</h3>
          ${this.user.role === 'admin' ? '<button class="btn btn-primary" onclick="scheduler.showEmployeeModal()"><i class="fas fa-plus"></i> Add Employee</button>' : ''}
        </div>
        <div class="card-body">
          <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
            ${this.renderEmployeeList()}
          </div>
        </div>
      </div>
    `;
  }

  renderEmployeeList() {
    if (this.employees.length === 0) {
      return '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">No employees yet.</p>';
    }
    return this.employees.filter(e => e.is_active).map(e => {
      const avatar = e.name.charAt(0).toUpperCase();
      const color = e.color || '#3B82F6';
      const birthday = e.birthday ? new Date(e.birthday) : null;
      let birthdayBadge = '';
      if (birthday) {
        const now = new Date();
        if (birthday.getMonth() === now.getMonth() && birthday.getDate() === now.getDate()) {
          birthdayBadge = '<span class="badge badge-pending">Birthday Today!</span>';
        }
      }
      
      return `
        <div class="employee-item">
          <div class="employee-avatar" style="background: ${color};">${avatar}</div>
          <div class="employee-details">
            <div><strong>${e.name}</strong> ${birthdayBadge}</div>
            <div class="employee-role">${this.getJobTypeName(e.job_type_id)} ${e.birthday ? '| DOB: ' + new Date(e.birthday).toLocaleDateString() : ''}</div>
            ${e.phone ? `<div style="font-size: 0.75rem; color: var(--gray-600);">${e.phone}</div>` : ''}
          </div>
          ${this.user.role === 'admin' ? `
            <div class="employee-actions">
              <button class="btn btn-ghost btn-icon" onclick="scheduler.showEmployeeModal('${e.id}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
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
              <label class="form-label">Full Name *</label>
              <input type="text" name="name" class="form-control" value="${emp?.name || ''}" required>
            </div>
            <div class="form-row" style="display:flex; gap:1rem;">
              <div class="form-group" style="flex:1;">
                <label class="form-label">Email</label>
                <input type="email" name="email" class="form-control" value="${emp?.email || ''}">
              </div>
              <div class="form-group" style="flex:1;">
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
              <input type="color" name="color" class="form-control" style="height: 40px; padding: 0;" value="${emp?.color || '#3B82F6'}">
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
      const labelMethod = isEdit ? 'Update' : 'Add';
      
      try {
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        await this.loadEmployees();
        modal.remove();
        this.render();
        this.showToast(`Employee ${labelMethod}ed`, 'success');
      } catch (err) {
        this.showToast('Failed to save employee', 'error');
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
            <div class="form-row" style="display:flex; gap:1rem; align-items: flex-end;">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Employee</label>
                <select name="employee_id" class="form-control" onchange="scheduler.calcFilterChanged()">
                  <option value="">All Employees</option>
                  ${this.employees.filter(e => e.is_active).map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Start Date</label>
                <input type="date" name="start_date" class="form-control" onchange="scheduler.calcFilterChanged()" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group" style="flex: 1;">
                <label class="form-label">End Date</label>
                <input type="date" name="end_date" class="form-control" onchange="scheduler.calcFilterChanged()" value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <button type="button" class="btn btn-primary" onclick="scheduler.calcCalculate()">Calculate</button>
              </div>
            </div>
          </form>

          <div id="calc-results">
            <p style="color: var(--gray-600);">Enter dates and click Calculate to see hours worked.</p>
          </div>
        </div>
      </div>
    `;
  }

  calcFilterChanged() {
    // No-op - just need dates to be set
  }

  async calcCalculate() {
    const form = document.getElementById('calc-form');
    const formData = new FormData(form);
    const employeeId = formData.get('employee_id');
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');

    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (employeeId) params.append('employee_id', employeeId);
      
      const res = await fetch(`/api/shift-calculator?${params}`);
      const data = await res.json();
      
      let html = '';
      
      if (data.summary.length > 0) {
        html += `<div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.total_hours.toFixed(1)}</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.summary.length}</div>
            <div class="stat-label">Employees</div>
          </div>
        </div>`;
        
        html += '<table class="table"><thead><tr><th>Employee</th><th>Job Type</th><th>Total Hours</th><th>Shifts</th><th></th></tr></thead><tbody>';
        
        // Sort by total hours descending
        data.summary.sort((a, b) => b.total_hours - a.total_hours);
        
        for (const emp of data.summary) {
          const overtime = emp.total_hours > 40 ? `<span class="badge badge-pending">${(emp.total_hours - 40).toFixed(1)}h OT</span>` : '';
          html += `<tr>
            <td><strong>${emp.employee_name}</strong></td>
            <td>${emp.job_type_name || 'N/A'}</td>
            <td><strong>${emp.total_hours.toFixed(1)}h</strong> ${overtime}</td>
            <td>${emp.entries.length}</td>
            <td><button class="btn btn-ghost btn-icon" onclick="scheduler.showEmployeeHistory('${emp.employee_id}', '${startDate}', '${endDate}')"><i class="fas fa-history"></i></button></td>
          </tr>`;
        }
        html += '</tbody></table>';
      } else {
        html = '<p style="color: var(--gray-600);">No schedule entries found for this period.</p>';
      }
      
      document.getElementById('calc-results').innerHTML = html;
    } catch (err) {
      this.showToast('Calculation failed', 'error');
    }
  }

  async showEmployeeHistory(employeeId, startDate, endDate) {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return;

    const res = await fetch(`/api/shift-calculator?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`);
    const data = await res.json();

    let html = '<h4 style="margin-bottom: 1rem;">' + emp.name + ' - Work History</h4>';
    html += '<table class="table"><thead><tr><th>Date</th><th>Day</th><th>Clock IN</th><th>Clock OUT</th><th>Hours</th><th>Notes</th></tr></thead><tbody>';
    
    data.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const entry of data.entries) {
      const d = new Date(entry.date);
      const isToday = entry.date === new Date().toISOString().split('T')[0];
      const hoursStr = entry.hours ? this.calculateDisplay(entry.hours) : '--';
      html += `<tr class="${isToday ? 'today-row' : ''}">
        <td>${entry.date}</td>
        <td>${d.toLocaleDateString('en-US', { weekday: 'short' })}</td>
        <td>${entry.clock_in || '--'}</td>
        <td>${entry.clock_out || '--'}</td>
        <td><strong>${hoursStr}</strong></td>
        <td>${entry.notes || ''}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    
    const totalEl = '<div style="margin-top: 1rem; padding: 1rem; background: var(--gray-100); border-radius: 12px;"><strong>Total Hours: ' + data.total_hours.toFixed(1) + 'h</strong></div>';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-history"></i> ${emp.name} - Work History</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">${html}${totalEl}</div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ==================== REPORTS ====================
  renderReports() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-chart-bar"></i> Reports & History</h3>
        </div>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${this.scheduleEntries.length}</div>
              <div class="stat-label">Total Schedule Entries</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.timeOffRequests.filter(r => r.status === 'pending').length}</div>
              <div class="stat-label">Pending Time-Off</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.callIns.length}</div>
              <div class="stat-label">Call-Ins</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.holidays.length}</div>
              <div class="stat-label">Holidays</div>
            </div>
          </div>

          <div style="margin-top: 2rem;">
            <h4 style="margin-bottom: 1rem;"><i class="fas fa-birthday-cake"></i> Upcoming Birthdays</h4>
            <div id="birthdays-list" style="background: white; padding: 1rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              ${this.renderBirthdays()}
            </div>
          </div>

          <div style="margin-top: 2rem;">
            <h4 style="margin-bottom: 1rem;"><i class="fas fa-chart-pie"></i> Hours Summary</h4>
            <button class="btn btn-secondary" onclick="scheduler.exportAllData()">
              <i class="fas fa-file-export"></i> Export All Data
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderBirthdays() {
    if (this.employees.length === 0) return '<p>No employees to show birthdays</p>';
    
    const today = new Date();
    const upcoming = [];
    
    for (const emp of this.employees.filter(e => e.is_active)) {
      if (!emp.birthday) continue;
      const bday = new Date(emp.birthday);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
      
      if (thisYear >= today && thisYear <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        upcoming.push({ emp, date: thisYear });
      } else if (nextYear <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        upcoming.push({ emp, date: nextYear });
      }
    }
    
    if (upcoming.length === 0) return '<p style="color: var(--gray-600);">No birthdays in the next 30 days</p>';
    
    upcoming.sort((a, b) => a.date - b.date);
    
    return upcoming.map(u => {
      const daysDiff = Math.ceil((u.date - today) / (24 * 60 * 60 * 1000));
      return `
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--gray-200);">
          <div class="employee-avatar" style="background: ${u.emp.color || '#3B82F6'}">${u.emp.name.charAt(0)}</div>
          <div>
            <strong>${u.emp.name}</strong> - ${u.emp.birthday ? new Date(u.emp.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'N/A'}
          </div>
          <span class="badge badge-pending" style="margin-left: auto;">${daysDiff === 0 ? 'Today!' : daysDiff === 1 ? 'Tomorrow' : daysDiff + ' days'}</span>
        </div>
      `;
    }).join('');
  }

  exportAllData() {
    const data = {
      employees: this.employees,
      schedule_entries: this.scheduleEntries,
      job_types: this.jobTypes,
      time_off_requests: this.timeOffRequests,
      call_ins: this.callIns,
      holidays: this.holidays,
      settings: this.settings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduler-data.json';
    a.click();
  }

  // ==================== UTILITIES ====================
  calculateDisplay(hours) {
    return hours.toFixed(1) + 'h';
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async refreshData() {
    await this.loadAllData();
    this.render();
  }
}

let scheduler;
document.addEventListener('DOMContentLoaded', () => {
  scheduler = new SchedulerApp();
});

// Make scheduler globally available for inline onclick handlers
window.scheduler = scheduler;