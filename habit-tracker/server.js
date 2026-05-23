const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 5235;

const db = new Database(path.join(__dirname, 'habits.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#4F9CF9',
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    completed_date TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, completed_date)
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function today() {
  return new Date().toISOString().split('T')[0];
}

function calcStreak(habitId) {
  const rows = db.prepare(
    'SELECT completed_date FROM completions WHERE habit_id = ? ORDER BY completed_date DESC'
  ).all(habitId);

  if (!rows.length) return { current: 0, longest: 0 };

  const dates = rows.map(r => r.completed_date);
  const t = today();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const dateSet = new Set(dates);

  let current = 0;
  const startFrom = dateSet.has(t) ? t : dateSet.has(yesterday) ? yesterday : null;
  if (startFrom) {
    const d = new Date(startFrom);
    while (dateSet.has(d.toISOString().split('T')[0])) {
      current++;
      d.setDate(d.getDate() - 1);
    }
  }

  let longest = current;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round(
      (new Date(dates[i - 1]) - new Date(dates[i])) / 86400000
    );
    if (diff === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest };
}

function hydrateHabit(h) {
  const t = today();
  const completedToday = !!db.prepare(
    'SELECT 1 FROM completions WHERE habit_id = ? AND completed_date = ?'
  ).get(h.id, t);
  const { current, longest } = calcStreak(h.id);
  return { ...h, completedToday, currentStreak: current, longestStreak: longest };
}

// ── Routes ──────────────────────────────────────────────

app.get('/api/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  res.json(habits.map(hydrateHabit));
});

app.post('/api/habits', (req, res) => {
  const { name, description = '', color = '#4F9CF9' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const info = db.prepare(
    'INSERT INTO habits (name, description, color) VALUES (?, ?, ?)'
  ).run(name.trim(), description.trim(), color);
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(info.lastInsertRowid);
  res.json(hydrateHabit(habit));
});

app.put('/api/habits/:id', (req, res) => {
  const { name, description = '', color } = req.body;
  const { id } = req.params;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(
    'UPDATE habits SET name = ?, description = ?, color = ? WHERE id = ?'
  ).run(name.trim(), description.trim(), color, id);
  if (!result.changes) return res.status(404).json({ error: 'Not found' });
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  res.json(hydrateHabit(habit));
});

app.delete('/api/habits/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM habits WHERE id = ?').run(id);
  res.json({ success: true });
});

app.post('/api/habits/:id/toggle', (req, res) => {
  const { id } = req.params;
  const date = req.body.date || today();
  const existing = db.prepare(
    'SELECT id FROM completions WHERE habit_id = ? AND completed_date = ?'
  ).get(id, date);

  if (existing) {
    db.prepare('DELETE FROM completions WHERE habit_id = ? AND completed_date = ?').run(id, date);
  } else {
    db.prepare(
      'INSERT OR IGNORE INTO completions (habit_id, completed_date) VALUES (?, ?)'
    ).run(id, date);
  }

  const { current, longest } = calcStreak(parseInt(id));
  res.json({ completed: !existing, currentStreak: current, longestStreak: longest });
});

app.get('/api/heatmap', (req, res) => {
  const habitCount = db.prepare('SELECT COUNT(*) as n FROM habits').get().n;
  if (!habitCount) return res.json({ days: [], habitCount: 0 });

  const days = db.prepare(`
    SELECT completed_date, COUNT(DISTINCT habit_id) as count
    FROM completions
    WHERE completed_date >= date('now', '-364 days')
    GROUP BY completed_date
    ORDER BY completed_date
  `).all();

  res.json({ days, habitCount });
});

app.get('/api/stats', (req, res) => {
  const t = today();
  const habits = db.prepare('SELECT * FROM habits').all();
  const habitCount = habits.length;

  const completedToday = db.prepare(
    'SELECT COUNT(DISTINCT habit_id) as n FROM completions WHERE completed_date = ?'
  ).get(t).n;

  // 7-day completion rate
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  const recentCount = db.prepare(`
    SELECT COUNT(*) as n FROM completions
    WHERE completed_date >= ? AND completed_date <= ?
  `).get(sevenDaysAgo, t).n;
  const maxPossible = habitCount * 7;
  const rate7d = maxPossible > 0 ? Math.round((recentCount / maxPossible) * 100) : 0;

  const bestStreak = habits.reduce((max, h) => {
    return Math.max(max, calcStreak(h.id).longest);
  }, 0);

  res.json({ habitCount, completedToday, rate7d, bestStreak });
});

app.listen(PORT, () => {
  console.log(`\n  Habit Tracker → http://localhost:${PORT}\n`);
});
