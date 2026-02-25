-- A Person Said a Thing — D1 Database Schema
-- Run this in the Cloudflare Dashboard: Workers & Pages > D1 > your-db > Console

-- Approved quotes (the live collection)
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  speaker TEXT NOT NULL,
  date TEXT,
  thumbnail TEXT,
  social_link TEXT,
  role TEXT,
  source TEXT,
  source_detail TEXT,
  historical_context TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Proposed quotes awaiting review
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  speaker TEXT NOT NULL,
  date TEXT,
  thumbnail TEXT,
  social_link TEXT,
  role TEXT,
  source TEXT,
  source_detail TEXT,
  historical_context TEXT,
  submitter_name TEXT NOT NULL,
  submitter_social TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);
