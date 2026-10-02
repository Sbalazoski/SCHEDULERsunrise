# Sunrise Scheduler - Restaurant Employee Scheduler

An easy-to-use employee scheduling application designed for restaurant managers and head servers with no technical experience.

## Quick Start

```bash
node init-db.js    # Initialize database
node server.js     # Start server
# Open http://localhost:3000 in browser
```

Login credentials:
- **Admin**: `admin` / `admin`
- **Head Server**: `server` / `server`

## What It Does

The app has 4 main screens:

### 1. Schedule (Main View)
- Monthly view showing all employees as **rows** and **calendar days as columns**
- Click any cell to add/edit a shift with Clock IN and Clock OUT times
- Hours are calculated automatically
- "POST TO SCHEDULE" button saves changes
- Navigate months with arrow buttons
- Today's date is highlighted

### 2. Employees
- View all staff members with their job type and birthday
- Add/edit employees (admin only)
- Each employee gets a color-coded circle
- Birthdays are highlighted when they're today

### 3. Calculator
- Calculate total hours for any employee(s) over any date range
- Shows total hours worked, shift count
- Overtime flagged when > 40 hours/week
- View detailed work history per employee

### 4. Reports
- Summary stats (total schedule entries, pending time-offs, call-ins, holidays)
- Upcoming birthdays in next 30 days
- Export all data to JSON file

## Key Features

| Feature | Description |
|---|---|
| Lock Screen | Auto-lock with password protection, manual lock button |
| Birthday Tracking | Employee birthdays shown with alerts |
| Job Types | Server, Cook, Bartender, Host, Dishwasher, Busser, Manager |
| Time-Off Requests | Submit, approve/deny requests |
| Call-In Tracking | Record sick calls and absences |
| Holidays | Define holidays with pay multipliers |
| Audit Log | All changes tracked (admin only) |
| Print Schedule | Directly print from browser |
| CSV Export | Export schedule to CSV |
| Mobile-Friendly | Large touch targets, bottom navigation |
| Shift Calculator | Sum hours across any date range |
| History View | Search historical schedule data |

## Project Structure

```
sunrise-scheduler/
├── server.js          # Express backend + API
├── init-db.js         # Database initialization
├── package.json       # Node.js dependencies
├── scheduler.db       # SQLite database (auto-created)
├── README.md
└── public/
    ├── index.html     # Main UI
    ├── styles.css     # All styling
    └── app.js         # Frontend JavaScript
```

## Technology

- **Backend**: Node.js + Express
- **Database**: SQLite (file-based, no extra setup)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Authentication**: bcrypt + express-session

## For Deployment (Cloud Access)

### Deploy to Render
1. Push to GitHub
2. Create a Web Service on render.com
3. Build command: `npm install && node init-db.js`
4. Start command: `node server.js`

### Deploy to Railway
1. Push to GitHub
2. Create project on railway.app from GitHub repo
3. Auto-detects Node.js

## Support

Call 555-0100 for help.