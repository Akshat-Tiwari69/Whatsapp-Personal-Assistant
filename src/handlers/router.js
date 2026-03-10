const memory = require('./memory');
const calendar = require('./calendar');
const { generateResponse } = require('../ai/ai');

/**
 * Route a parsed intent to the appropriate handler and return a reply string
 * @param {object} parsed  — { intent, data }
 * @param {string} originalMessage
 * @returns {Promise<string>}
 */
async function routeIntent(parsed, originalMessage) {
    const { intent, data } = parsed;

    try {
        switch (intent) {

            // ── People ────────────────────────────────────────────────────────
            case 'SAVE_PERSON': {
                const result = memory.savePerson(data);
                const ctx = result.updated
                    ? `Updated profile for ${result.name}.`
                    : `Saved a new person: ${result.name}.`;
                return generateResponse(ctx, originalMessage);
            }

            case 'GET_PERSON': {
                const profile = memory.getPersonProfile(data.name);
                if (!profile) {
                    return generateResponse(`I don't have any info about ${data.name} yet.`, originalMessage);
                }

                const aliasList = profile.aliases.length > 0
                    ? `Also known as: ${profile.aliases.join(', ')}. `
                    : '';
                const notesSummary = profile.notes ? `Notes: ${profile.notes}. ` : '';
                const eventList = profile.events.length > 0
                    ? `Events: ${profile.events.map(e => `${e.type} on ${e.date}`).join(', ')}.`
                    : '';

                const ctx = `Profile for ${profile.name}. ${aliasList}${notesSummary}${eventList}`;
                return generateResponse(ctx, originalMessage);
            }

            // ── Events ────────────────────────────────────────────────────────
            case 'SAVE_EVENT': {
                const savedEvent = memory.saveEvent(data);

                // Also create a Google Calendar event if date is present
                let calLink = null;
                if (data.date && process.env.GOOGLE_REFRESH_TOKEN) {
                    try {
                        const calResult = await calendar.createCalendarEvent({
                            title: data.description || `${data.type} - ${data.person_name || 'reminder'}`,
                            date: data.date,
                            description: data.description
                        });
                        memory.updateEventCalendarId(savedEvent.id, calResult.id);
                        calLink = calResult.htmlLink;
                    } catch (calErr) {
                        console.error('[Calendar] Failed to create event:', calErr.message);
                    }
                }

                const ctx = `Saved a ${data.type} event${data.person_name ? ` for ${data.person_name}` : ''} on ${data.date}.${calLink ? ` Added to Google Calendar.` : ''}`;
                return generateResponse(ctx, originalMessage);
            }

            // ── Watchlist ─────────────────────────────────────────────────────
            case 'SAVE_WATCHLIST': {
                const item = memory.saveWatchlistItem(data);
                if (item.duplicate) {
                    return generateResponse(`${data.title} is already on your watchlist.`, originalMessage);
                }
                const ctx = `Added "${data.title}" (${data.type}) to your watchlist.`;
                return generateResponse(ctx, originalMessage);
            }

            case 'GET_WATCHLIST': {
                const status = data.status || 'all';
                const items = memory.getWatchlist(status);
                if (items.length === 0) {
                    const ctx = status === 'all'
                        ? 'Your watchlist is empty.'
                        : `No ${status} items on your watchlist.`;
                    return generateResponse(ctx, originalMessage);
                }

                const grouped = {};
                items.forEach(item => {
                    if (!grouped[item.type]) grouped[item.type] = [];
                    grouped[item.type].push(item.title);
                });

                const summary = Object.entries(grouped)
                    .map(([type, titles]) => `${type}: ${titles.join(', ')}`)
                    .join('. ');

                return generateResponse(`Your watchlist (${status}): ${summary}`, originalMessage);
            }

            case 'UPDATE_WATCHLIST': {
                const updated = memory.updateWatchlistStatus(data.title, data.status);
                if (!updated) {
                    return generateResponse(`I couldn't find "${data.title}" on your watchlist.`, originalMessage);
                }
                const ctx = `Updated "${updated.title}" status to ${data.status}.`;
                return generateResponse(ctx, originalMessage);
            }

            // ── Todos ─────────────────────────────────────────────────────────
            case 'SAVE_TODO': {
                const todo = memory.saveTodo(data);
                const ctx = `Saved todo: "${todo.task}"${todo.due_date ? ` due ${todo.due_date}` : ''}.`;
                return generateResponse(ctx, originalMessage);
            }

            case 'GET_TODOS': {
                const filter = data.filter || 'pending';
                const todos = memory.getTodos(filter);
                if (todos.length === 0) {
                    return generateResponse(`No ${filter === 'all' ? '' : filter + ' '}todos found.`, originalMessage);
                }

                const list = todos.map(t =>
                    `${t.done ? '✅' : '⬜'} ${t.task}${t.due_date ? ` (due: ${t.due_date})` : ''}`
                ).join('\n');

                const label = filter === 'all' ? '' : filter + ' ';
                return generateResponse(`Here are your ${label}todos:\n${list}`, originalMessage);
            }

            case 'COMPLETE_TODO': {
                const completed = memory.completeTodo(data.task);
                if (!completed) {
                    return generateResponse(`I couldn't find a pending todo matching "${data.task}".`, originalMessage);
                }
                return generateResponse(`Marked "${completed.task}" as done! ✅`, originalMessage);
            }

            // ── Notes ─────────────────────────────────────────────────────────
            case 'SAVE_NOTE': {
                const note = memory.saveNote(data);
                const ctx = `Saved note: "${note.content.substring(0, 60)}${note.content.length > 60 ? '...' : ''}"`;
                return generateResponse(ctx, originalMessage);
            }

            case 'GET_NOTES': {
                const notes = memory.getNotes(data.query || null);
                if (notes.length === 0) {
                    return generateResponse('No notes found.', originalMessage);
                }

                const list = notes.slice(0, 5).map((n, i) =>
                    `${i + 1}. ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`
                ).join('\n');

                return generateResponse(`Here are your recent notes:\n${list}`, originalMessage);
            }

            // ── Calendar ──────────────────────────────────────────────────────
            case 'CREATE_CALENDAR_EVENT': {
                if (!process.env.GOOGLE_REFRESH_TOKEN) {
                    return 'Google Calendar is not configured. Please set up your GOOGLE_REFRESH_TOKEN.';
                }
                const result = await calendar.createCalendarEvent(data);
                const ctx = `Created calendar event "${data.title}" on ${data.date}. Link: ${result.htmlLink}`;
                return generateResponse(ctx, originalMessage);
            }

            case 'UPDATE_CALENDAR_EVENT': {
                if (!process.env.GOOGLE_REFRESH_TOKEN) {
                    return 'Google Calendar is not configured.';
                }
                const result = await calendar.updateCalendarEvent(data);
                if (!result) {
                    return generateResponse(`Couldn't find a calendar event titled "${data.title}".`, originalMessage);
                }
                return generateResponse(`Updated the calendar event "${data.title}".`, originalMessage);
            }

            case 'DELETE_CALENDAR_EVENT': {
                if (!process.env.GOOGLE_REFRESH_TOKEN) {
                    return 'Google Calendar is not configured.';
                }
                const deleted = await calendar.deleteCalendarEvent(data.title);
                if (!deleted) {
                    return generateResponse(`Couldn't find a calendar event titled "${data.title}".`, originalMessage);
                }
                return generateResponse(`Deleted the calendar event "${data.title}".`, originalMessage);
            }

            // ── Fallback ──────────────────────────────────────────────────────
            case 'UNKNOWN':
            default:
                return data.message || "I'm not sure how to help with that. Try asking me to save a note, add a todo, or check your watchlist!";
        }
    } catch (err) {
        console.error('[Router] Error handling intent:', intent, err.message);
        return 'Something went wrong while processing your request. Please try again.';
    }
}

module.exports = { routeIntent };
