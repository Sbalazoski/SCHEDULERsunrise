# Sunrise Scheduler - Restaurant Employee Scheduler

An easy-to-use employee scheduling application for restaurants.

## Quick Start (Local)

```bash
node init-db.js    # Initialize database (first time only)
node server.js     # Start server
# Open http://localhost:3000 in browser
```

**Login:** `admin` / `admin` or `server` / `server`

## How It Works

### Schedule View (Main Screen)
- **Rows** = Employees
- **Columns** = Calendar days (month view)
- Click any cell to add/edit Clock IN / Clock OUT times
- Hours are calculated automatically
- **POST TO SCHEDULE** button saves all changes
- Navigate months with arrow buttons
- Today's date is highlighted

### Other Screens
1. **Employees** - Add/edit staff, set birthdays, job types, colors
2. **Calculator** - Sum hours across any date range, view work history
3. **Reports** - Stats, upcoming birthdays, export data

### Key Features
- Lock screen with password (auto-lock timer)
- Birthdays tracked with alerts
- Job types: Server, Cook, Bartender, Host, Dishwasher, Busser, Manager
- Time-off requests (admin approve/deny)
- Call-in tracking
- Holiday management
- Audit log (admin only)
- Print/export to CSV
- Mobile-friendly interface

## Deployment

### Option 1: Render (Recommended)
```bash
# Push to GitHub, then:
# 1. Create a Web Service on render.com
# 2. Build command: node init-db.js
# 3. Start command: node server.js
```

### Option 2: Railway
```bash
railway init
railway up
```

### Option 3: Local Network
```bash
node server.js
# Access from any device: http://{your-ip}:3000
```

### Option 4: Docker
```bash
docker build -t sunrise-scheduler .
docker run -p 3000:3000 sunrise-scheduler
```

## Project Structure
```
.
├── server.js       # Backend API (Express)
├── init-db.js      # Database setup
├── package.json    # Dependencies
├── scheduler.db    # SQLite database
├── Dockerfile
├── netlify.toml    # Netlify config (if deploying there)
├── README.md
└── public/
    ├── index.html  # Frontend
    ├── styles.css  # Styling
    └── app.js      # UI logic
```

## Support
Call 555-0100 for help.