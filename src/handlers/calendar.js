const { google } = require('googleapis');

const TIMEZONE = process.env.TIMEZONE || 'UTC';

/**
 * Build an authenticated Google Calendar client using OAuth2
 */
function getCalendarClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Create a Google Calendar event
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.date     — YYYY-MM-DD
 * @param {string} [params.time]   — HH:MM (24h), optional; if omitted, creates all-day event
 * @param {string} [params.description]
 * @returns {Promise<{id: string, htmlLink: string}>}
 */
async function createCalendarEvent({ title, date, time = null, description = '' }) {
    const calendar = getCalendarClient();

    let start, end;

    if (time) {
        // Timed event
        const startDateTime = `${date}T${time}:00`;
        // Default duration: 1 hour
        const endDateTime = `${date}T${incrementHour(time)}:00`;
        start = { dateTime: startDateTime, timeZone: TIMEZONE };
        end = { dateTime: endDateTime, timeZone: TIMEZONE };
    } else {
        // All-day event
        start = { date };
        end = { date };
    }

    const event = {
        summary: title,
        description,
        start,
        end
    };

    const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event
    });

    return {
        id: response.data.id,
        htmlLink: response.data.htmlLink
    };
}

/**
 * Update an existing Google Calendar event by searching for it by title
 * @param {object} params
 * @param {string} params.title          — current title to search for
 * @param {string} [params.new_title]
 * @param {string} [params.new_date]     — YYYY-MM-DD
 * @param {string} [params.new_time]     — HH:MM
 * @returns {Promise<{id: string, htmlLink: string} | null>}
 */
async function updateCalendarEvent({ title, new_title, new_date, new_time }) {
    const calendar = getCalendarClient();

    // Search for the event
    const eventId = await findEventIdByTitle(calendar, title);
    if (!eventId) return null;

    // Get current event data
    const current = await calendar.events.get({
        calendarId: 'primary',
        eventId
    });

    const patch = {};

    if (new_title) patch.summary = new_title;

    if (new_date) {
        if (new_time) {
            patch.start = { dateTime: `${new_date}T${new_time}:00`, timeZone: TIMEZONE };
            patch.end = { dateTime: `${new_date}T${incrementHour(new_time)}:00`, timeZone: TIMEZONE };
        } else {
            patch.start = { date: new_date };
            patch.end = { date: new_date };
        }
    }

    const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        resource: patch
    });

    return {
        id: response.data.id,
        htmlLink: response.data.htmlLink
    };
}

/**
 * Delete a Google Calendar event by title
 * @param {string} title
 * @returns {Promise<boolean>}
 */
async function deleteCalendarEvent(title) {
    const calendar = getCalendarClient();

    const eventId = await findEventIdByTitle(calendar, title);
    if (!eventId) return false;

    await calendar.events.delete({
        calendarId: 'primary',
        eventId
    });

    return true;
}

/**
 * Search for a calendar event by summary/title (returns first match)
 * @param {object} calendar  — googleapis calendar client
 * @param {string} title
 * @returns {Promise<string|null>}
 */
async function findEventIdByTitle(calendar, title) {
    const response = await calendar.events.list({
        calendarId: 'primary',
        q: title,
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: new Date().toISOString()
    });

    const events = response.data.items || [];
    if (events.length === 0) return null;

    // Find best match (exact or closest)
    const exact = events.find(e => e.summary && e.summary.toLowerCase() === title.toLowerCase());
    return exact ? exact.id : events[0].id;
}

/**
 * Increment an HH:MM time string by 1 hour
 */
function incrementHour(time) {
    const [h, m] = time.split(':').map(Number);
    const newH = (h + 1) % 24;
    return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = {
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent
};
