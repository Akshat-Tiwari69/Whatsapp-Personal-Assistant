const db = require('../db/db');

// ─── People ───────────────────────────────────────────────────────────────────

/**
 * Save or update a person profile. If the name/alias already exists, merge data.
 */
function savePerson({ name, aliases = [], notes = '' }) {
    const existing = findPersonByName(name);

    if (existing) {
        const existingAliases = JSON.parse(existing.aliases || '[]');
        const mergedAliases = [...new Set([...existingAliases, ...aliases])];
        const mergedNotes = existing.notes
            ? `${existing.notes}\n${notes}`.trim()
            : notes;

        db.prepare(`
            UPDATE people SET aliases = ?, notes = ? WHERE id = ?
        `).run(JSON.stringify(mergedAliases), mergedNotes, existing.id);

        return { ...existing, aliases: mergedAliases, notes: mergedNotes, updated: true };
    }

    const result = db.prepare(`
        INSERT INTO people (name, aliases, notes) VALUES (?, ?, ?)
    `).run(name, JSON.stringify(aliases), notes);

    return { id: result.lastInsertRowid, name, aliases, notes, updated: false };
}

/**
 * Find a person by name or alias (case-insensitive)
 */
function findPersonByName(name) {
    const lower = name.toLowerCase();

    // Try exact name match first
    const byName = db.prepare(`
        SELECT * FROM people WHERE LOWER(name) = ?
    `).get(lower);
    if (byName) return byName;

    // Search aliases (stored as JSON array)
    const all = db.prepare('SELECT * FROM people').all();
    for (const person of all) {
        const aliases = JSON.parse(person.aliases || '[]');
        if (aliases.some(a => a.toLowerCase() === lower)) {
            return person;
        }
    }

    // Fuzzy partial match on name
    const partial = db.prepare(`
        SELECT * FROM people WHERE LOWER(name) LIKE ? LIMIT 1
    `).get(`%${lower}%`);
    return partial || null;
}

/**
 * Get a full profile for a person including their events
 */
function getPersonProfile(name) {
    const person = findPersonByName(name);
    if (!person) return null;

    const events = db.prepare(`
        SELECT * FROM events WHERE person_id = ? ORDER BY date ASC
    `).all(person.id);

    return {
        ...person,
        aliases: JSON.parse(person.aliases || '[]'),
        events
    };
}

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * Save an event, optionally linked to a person
 */
function saveEvent({ person_name, type, date, description = '', calendar_event_id = null }) {
    let personId = null;

    if (person_name) {
        const person = findPersonByName(person_name);
        if (person) personId = person.id;
    }

    const result = db.prepare(`
        INSERT INTO events (person_id, type, date, description, calendar_event_id)
        VALUES (?, ?, ?, ?, ?)
    `).run(personId, type, date, description, calendar_event_id);

    return { id: result.lastInsertRowid, personId, type, date, description, calendar_event_id };
}

/**
 * Update the calendar_event_id for a saved event
 */
function updateEventCalendarId(eventId, calendarEventId) {
    db.prepare(`
        UPDATE events SET calendar_event_id = ? WHERE id = ?
    `).run(calendarEventId, eventId);
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

/**
 * Add an item to the watchlist
 */
function saveWatchlistItem({ title, type = 'other' }) {
    // Avoid duplicates
    const existing = db.prepare(`
        SELECT * FROM watchlist WHERE LOWER(title) = ?
    `).get(title.toLowerCase());

    if (existing) return { ...existing, duplicate: true };

    const result = db.prepare(`
        INSERT INTO watchlist (title, type) VALUES (?, ?)
    `).run(title, type);

    return { id: result.lastInsertRowid, title, type, status: 'pending', duplicate: false };
}

/**
 * Get watchlist items, optionally filtered by status
 */
function getWatchlist(status = 'all') {
    if (status === 'all') {
        return db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all();
    }
    return db.prepare('SELECT * FROM watchlist WHERE status = ? ORDER BY created_at DESC').all(status);
}

/**
 * Update a watchlist item's status
 */
function updateWatchlistStatus(title, status) {
    const item = db.prepare(`
        SELECT * FROM watchlist WHERE LOWER(title) LIKE ?
    `).get(`%${title.toLowerCase()}%`);

    if (!item) return null;

    db.prepare('UPDATE watchlist SET status = ? WHERE id = ?').run(status, item.id);
    return { ...item, status };
}

// ─── Todos ────────────────────────────────────────────────────────────────────

/**
 * Save a new todo / reminder
 */
function saveTodo({ task, due_date = null }) {
    const result = db.prepare(`
        INSERT INTO todos (task, due_date) VALUES (?, ?)
    `).run(task, due_date);

    return { id: result.lastInsertRowid, task, due_date, done: 0 };
}

/**
 * Get todos, optionally filtered
 */
function getTodos(filter = 'pending') {
    if (filter === 'all') {
        return db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
    }
    const done = filter === 'done' ? 1 : 0;
    return db.prepare('SELECT * FROM todos WHERE done = ? ORDER BY created_at DESC').all(done);
}

/**
 * Mark a todo as done by matching task text
 */
function completeTodo(taskText) {
    const todo = db.prepare(`
        SELECT * FROM todos WHERE LOWER(task) LIKE ? AND done = 0
    `).get(`%${taskText.toLowerCase()}%`);

    if (!todo) return null;

    db.prepare('UPDATE todos SET done = 1 WHERE id = ?').run(todo.id);
    return { ...todo, done: 1 };
}

// ─── Notes ────────────────────────────────────────────────────────────────────

/**
 * Save a note
 */
function saveNote({ content, tags = [] }) {
    const result = db.prepare(`
        INSERT INTO notes (content, tags) VALUES (?, ?)
    `).run(content, JSON.stringify(tags));

    return { id: result.lastInsertRowid, content, tags };
}

/**
 * Get notes, optionally searching by query
 */
function getNotes(query = null) {
    if (!query) {
        return db.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT 20').all();
    }

    const lower = `%${query.toLowerCase()}%`;
    return db.prepare(`
        SELECT * FROM notes
        WHERE LOWER(content) LIKE ? OR LOWER(tags) LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
    `).all(lower, lower);
}

module.exports = {
    savePerson,
    findPersonByName,
    getPersonProfile,
    saveEvent,
    updateEventCalendarId,
    saveWatchlistItem,
    getWatchlist,
    updateWatchlistStatus,
    saveTodo,
    getTodos,
    completeTodo,
    saveNote,
    getNotes
};
