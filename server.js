const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Google Client ID (Set this to your Google Developer Console OAuth Client ID)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ── Database setup ──────────────────────────────────────────
// Support Render persistent disk by pointing to process.env.DATABASE_URL
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'trades.db');
const db = new sqlite3.Database(DB_PATH);

// Promisified DB helpers for async/await support
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize DB and Seed Data
db.serialize(async () => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      email   TEXT PRIMARY KEY,
      name    TEXT,
      picture TEXT,
      api_key TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create trades table
  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT    NOT NULL DEFAULT 'admin@tradingjournal.com',
      type       TEXT    NOT NULL DEFAULT 'backtest',
      pair       TEXT    NOT NULL DEFAULT 'MNQ',
      dir        TEXT    NOT NULL,
      day        TEXT    NOT NULL,
      date       TEXT    NOT NULL,
      entry_time TEXT    NOT NULL,
      exit_time  TEXT    NOT NULL,
      risk       REAL    NOT NULL DEFAULT 30,
      poi        TEXT    NOT NULL,
      result     TEXT    NOT NULL,
      profit     REAL    NOT NULL DEFAULT 0,
      sl         REAL    NOT NULL DEFAULT 15,
      rr         REAL    NOT NULL DEFAULT 0,
      notes      TEXT    DEFAULT '',
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);

  // Safely alter existing table to add 'type' column if it was created without it
  db.run("ALTER TABLE trades ADD COLUMN type TEXT NOT NULL DEFAULT 'backtest'", (err) => {
    // Ignore error if column already exists
  });

  // Safely alter existing table to add 'user_email' column if it was created without it
  db.run("ALTER TABLE trades ADD COLUMN user_email TEXT NOT NULL DEFAULT 'admin@tradingjournal.com'", (err) => {
    // Ignore error if column already exists
  });

  // Seed sample data if empty
  try {
    const countRow = await dbGet('SELECT COUNT(*) as cnt FROM trades');
    if (countRow && countRow.cnt === 0) {
      console.log('🌱 Seeding sample trades into database...');
      const seedTrades = [
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Friday',    date:'10/24/2025', entry_time:'10:30AM', exit_time:'10:30AM', risk:30, poi:'15M OB',  result:'Win',  profit:90,   sl:15, rr:3,     notes:'Ran to 4.1R' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Tuesday',   date:'10/28/2025', entry_time:'11:30AM', exit_time:'11:30AM', risk:30, poi:'15M FVG', result:'Loss', profit:-30,  sl:15, rr:-1,    notes:'Would have worked with 25pt stop for 8.2R' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Thursday',  date:'01/22/2026', entry_time:'2:15AM',  exit_time:'6:00AM',  risk:30, poi:'15M FVG', result:'Win',  profit:445,  sl:15, rr:14.77, notes:'' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Short', day:'Friday',    date:'01/23/2026', entry_time:'12:00PM', exit_time:'12:45PM', risk:30, poi:'15M OB',  result:'Win',  profit:225,  sl:15, rr:7.53,  notes:'' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Friday',    date:'01/23/2026', entry_time:'9:00AM',  exit_time:'10:45AM', risk:30, poi:'15M FVG', result:'Win',  profit:530,  sl:15, rr:17.77, notes:'' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Short', day:'Friday',    date:'01/23/2026', entry_time:'9:30AM',  exit_time:'9:45AM',  risk:30, poi:'15M FVG', result:'Win',  profit:160,  sl:15, rr:5.28,  notes:'' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Monday',    date:'01/26/2026', entry_time:'8:45AM',  exit_time:'12:00PM', risk:30, poi:'15M FVG', result:'Win',  profit:500,  sl:15, rr:16.93, notes:'' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Short', day:'Wednesday', date:'01/28/2026', entry_time:'9:45AM',  exit_time:'11:45AM', risk:30, poi:'15M FVG', result:'Win',  profit:400,  sl:15, rr:13.2,  notes:'FOMC' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Wednesday', date:'01/28/2026', entry_time:'12:30PM', exit_time:'2:45PM',  risk:30, poi:'15M OB',  result:'Win',  profit:180,  sl:15, rr:5.9,   notes:'FOMC' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Short', day:'Friday',    date:'01/29/2026', entry_time:'12:45PM', exit_time:'1:15PM',  risk:30, poi:'15M FVG', result:'Win',  profit:-30,  sl:15, rr:12.4,  notes:'Entered on 3rd tap, wick closure was very close to edge' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Long',  day:'Friday',    date:'01/30/2026', entry_time:'8:30AM',  exit_time:'8:30AM',  risk:30, poi:'15M FVG', result:'Loss', profit:-30,  sl:15, rr:-1,    notes:'PPI. Would have worked with 25pt stop for 5.8R' },
        { type: 'backtest', user_email: 'admin@tradingjournal.com', pair:'MNQ', dir:'Short', day:'Thursday',  date:'01/30/2026', entry_time:'5:30AM',  exit_time:'5:30AM',  risk:30, poi:'15M FVG', result:'Loss', profit:-30,  sl:15, rr:-1,    notes:'PPI. Would have worked with 25pt stop for 25.4R' },
      ];

      for (const t of seedTrades) {
        await dbRun(`
          INSERT INTO trades (user_email, type, pair, dir, day, date, entry_time, exit_time, risk, poi, result, profit, sl, rr, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [t.user_email, t.type, t.pair, t.dir, t.day, t.date, t.entry_time, t.exit_time, t.risk, t.poi, t.result, t.profit, t.sl, t.rr, t.notes]);
      }
      console.log('✅ Seeded 12 sample trades successfully');
    }
  } catch (err) {
    console.error('❌ Error during database seeding:', err.message);
  }
});

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to get verified user email from request headers
const getAuthUser = (req, res, next) => {
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing User Session' });
  }
  req.userEmail = userEmail;
  next();
};

// ── Authentication Route ────────────────────────────────────

// POST /api/auth/google — Verify Google Sign-In JWT token
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, error: 'Missing credential token' });
    }

    // Verify token with Google APIs
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      // For local development testing, if client ID is mock/incorrect, let's gracefully log
      console.warn('⚠️ Google token verification failed. In production, configure valid Client ID.', verifyErr.message);
      return res.status(401).json({ success: false, error: 'Invalid Google ID token' });
    }

    const { email, name, picture } = payload;
    
    // Check if user already exists
    let user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      // Create user and generate secure webhook API key
      const apiKey = 'tv_' + crypto.randomBytes(16).toString('hex');
      await dbRun(`
        INSERT INTO users (email, name, picture, api_key)
        VALUES (?, ?, ?, ?)
      `, [email, name, picture, apiKey]);
      user = { email, name, picture, api_key: apiKey };
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── REST API Routes ─────────────────────────────────────────

// GET /api/trades — fetch trades for logged in user
app.get('/api/trades', getAuthUser, async (req, res) => {
  try {
    const { type } = req.query;
    let rows;
    if (type) {
      rows = await dbAll('SELECT * FROM trades WHERE user_email = ? AND type = ? ORDER BY id ASC', [req.userEmail, type]);
    } else {
      rows = await dbAll('SELECT * FROM trades WHERE user_email = ? ORDER BY id ASC', [req.userEmail]);
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/trades — add a new trade manually
app.post('/api/trades', getAuthUser, async (req, res) => {
  try {
    const { type, pair, dir, day, date, entry_time, exit_time, risk, poi, result, profit, sl, rr, notes } = req.body;
    if (!dir || !day || !date || !poi || !result) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const resultInfo = await dbRun(`
      INSERT INTO trades (user_email, type, pair, dir, day, date, entry_time, exit_time, risk, poi, result, profit, sl, rr, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.userEmail,
      type || 'backtest', pair || 'MNQ', dir, day, date,
      entry_time || '', exit_time || '',
      risk || 30, poi, result,
      profit || 0, sl || 15, rr || 0,
      notes || ''
    ]);

    const newTrade = await dbGet('SELECT * FROM trades WHERE id = ?', [resultInfo.lastID]);
    res.status(201).json({ success: true, data: newTrade });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper handler to process TradingView Webhook payloads
async function handleTradingViewWebhook(req, res, targetType) {
  try {
    const { apiKey } = req.query;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'Missing API Key query parameter (?apiKey=your_key)' });
    }

    // Resolve owner email by API key
    const user = await dbGet('SELECT email FROM users WHERE api_key = ?', [apiKey]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid API Key' });
    }

    const { action, ticker, entry_time, risk, poi, sl, profit, notes } = req.body;
    
    // Auto-fill time properties
    const date = new Date().toISOString().substring(0, 10);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[new Date().getDay()];
    
    // Normalize direction
    const direction = action && action.toLowerCase().includes('sell') ? 'Short' : 'Long';
    
    // Result
    let result = 'Loss';
    let profitVal = parseFloat(profit) || 0;
    if (profitVal > 0) result = 'Win';
    
    // Risk & R:R
    const riskVal = parseFloat(risk) || 30;
    const rr = (profitVal / riskVal).toFixed(2);

    await dbRun(`
      INSERT INTO trades (user_email, type, pair, dir, day, date, entry_time, exit_time, risk, poi, result, profit, sl, rr, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.email,
      targetType,
      ticker || 'MNQ',
      direction,
      day,
      date,
      entry_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '',
      riskVal,
      poi || 'TradingView Webhook',
      result,
      profitVal,
      sl || 15,
      rr,
      notes || `Automated TradingView ${targetType} alert`
    ]);

    res.json({ success: true, message: `Trade successfully logged to ${targetType}!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// TradingView Webhook Endpoint 1: BACKTEST
app.post('/api/webhooks/tradingview/backtest', (req, res) => {
  handleTradingViewWebhook(req, res, 'backtest');
});

// TradingView Webhook Endpoint 2: LIVE
app.post('/api/webhooks/tradingview/live', (req, res) => {
  handleTradingViewWebhook(req, res, 'live');
});

// PUT /api/trades/:id — update an existing trade
app.put('/api/trades/:id', getAuthUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { pair, dir, day, date, entry_time, exit_time, risk, poi, result, profit, sl, rr, notes } = req.body;
    
    // Verify owner
    const trade = await dbGet('SELECT user_email FROM trades WHERE id = ?', [id]);
    if (!trade) return res.status(404).json({ success: false, error: 'Trade not found' });
    if (trade.user_email !== req.userEmail) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own this trade' });
    }

    const resultInfo = await dbRun(`
      UPDATE trades
      SET pair=?, dir=?, day=?, date=?,
          entry_time=?, exit_time=?,
          risk=?, poi=?, result=?,
          profit=?, sl=?, rr=?, notes=?
      WHERE id=?
    `, [
      pair, dir, day, date,
      entry_time, exit_time,
      risk, poi, result,
      profit, sl, rr, notes,
      id
    ]);

    const updated = await dbGet('SELECT * FROM trades WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/trades/:id — delete a single trade
app.delete('/api/trades/:id', getAuthUser, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify owner
    const trade = await dbGet('SELECT user_email FROM trades WHERE id = ?', [id]);
    if (!trade) return res.status(404).json({ success: false, error: 'Trade not found' });
    if (trade.user_email !== req.userEmail) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own this trade' });
    }

    await dbRun('DELETE FROM trades WHERE id = ?', [id]);
    res.json({ success: true, message: `Trade #${id} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/trades — delete ALL trades
app.delete('/api/trades', getAuthUser, async (req, res) => {
  try {
    const resultInfo = await dbRun('DELETE FROM trades WHERE user_email = ?', [req.userEmail]);
    res.json({ success: true, message: `Deleted trades` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 My Trading Journal running at http://localhost:${PORT}`);
});
