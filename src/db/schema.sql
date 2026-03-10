-- Database schema for WhatsApp Personal Assistant

CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    aliases TEXT DEFAULT '[]',  -- JSON array of alternative names/aliases
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER,
    type TEXT NOT NULL,           -- e.g. 'birthday', 'meeting', 'deadline'
    date TEXT,                    -- ISO 8601 date string
    description TEXT DEFAULT '',
    calendar_event_id TEXT,       -- Google Calendar event ID, if synced
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'other',    -- 'anime', 'movie', 'show', 'other'
    status TEXT DEFAULT 'pending', -- 'pending', 'watching', 'completed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    due_date TEXT,                -- ISO 8601 date string or natural language
    done INTEGER DEFAULT 0,       -- 0 = pending, 1 = done
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',       -- JSON array of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,        -- e.g. 'Data Structures', 'ML', 'OS'
    title TEXT NOT NULL,          -- e.g. 'Linked List implementation'
    type TEXT DEFAULT 'assignment', -- 'assignment', 'exam', 'project', 'quiz', 'lab'
    due_date TEXT,                -- ISO 8601 date string
    status TEXT DEFAULT 'pending', -- 'pending', 'submitted', 'graded'
    grade TEXT,                   -- e.g. '8/10', 'A', '85%'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
