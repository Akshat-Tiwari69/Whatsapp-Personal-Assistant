const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'gpt-4o-mini';

/**
 * Build the system prompt with the current date injected at call time,
 * so long-running processes never use a stale date.
 */
function buildSystemPrompt() {
    const today = new Date().toISOString().split('T')[0];
    return `You are a personal assistant AI. Parse the user's WhatsApp message and return a structured JSON response describing what action to take.

Return ONLY valid JSON in this format (no markdown, no code blocks):
{
  "intent": "<intent_type>",
  "data": { ... }
}

Supported intents and their data shapes:

1. SAVE_PERSON — save or update a person's profile
   data: { "name": "string", "aliases": ["string"], "notes": "string" }

2. GET_PERSON — look up info about a person
   data: { "name": "string" }

3. SAVE_EVENT — save a date/event, optionally linked to a person
   data: { "person_name": "string|null", "type": "birthday|meeting|deadline|other", "date": "YYYY-MM-DD", "description": "string" }

4. SAVE_WATCHLIST — add something to the watchlist
   data: { "title": "string", "type": "anime|movie|show|other" }

5. GET_WATCHLIST — retrieve watchlist
   data: { "status": "pending|watching|completed|all" }

6. UPDATE_WATCHLIST — update the status of a watchlist item
   data: { "title": "string", "status": "pending|watching|completed" }

7. SAVE_TODO — save a new task or reminder
   data: { "task": "string", "due_date": "string|null" }

8. GET_TODOS — retrieve todos
   data: { "filter": "all|pending|done" }

9. COMPLETE_TODO — mark a todo as done
   data: { "task": "string" }

10. SAVE_NOTE — save a free-form note or idea
    data: { "content": "string", "tags": ["string"] }

11. GET_NOTES — retrieve notes
    data: { "query": "string|null" }

12. CREATE_CALENDAR_EVENT — create a Google Calendar event
    data: { "title": "string", "date": "YYYY-MM-DD", "time": "HH:MM|null", "description": "string|null" }

13. UPDATE_CALENDAR_EVENT — update an existing calendar event
    data: { "title": "string", "new_date": "YYYY-MM-DD|null", "new_time": "HH:MM|null", "new_title": "string|null" }

14. DELETE_CALENDAR_EVENT — delete a calendar event
    data: { "title": "string" }

15. UNKNOWN — cannot parse the intent
    data: { "message": "string" }

Rules:
- Dates should be in YYYY-MM-DD format when possible. Use the current year if not specified.
- If the user says "remind me to X on Y", use SAVE_TODO with due_date and also CREATE_CALENDAR_EVENT if a specific date is mentioned.
- If the user mentions a birthday, use SAVE_EVENT with type "birthday" and also CREATE_CALENDAR_EVENT.
- If the user says "I want to watch X", use SAVE_WATCHLIST.
- If the message contains a personal insight, reflection, or note ABOUT a specific named person — their personality, how to interact with them, the relationship dynamic, feelings about them (e.g. "I should never have my ego in front of Unnatee", "Rahul is very sensitive about his work", "My friendship with Priya is going well") — use SAVE_PERSON with the insight in the notes field. Keep notes factual and concise.
- Generic personal reflections, life lessons, or thoughts NOT about a specific person (e.g. "I should meditate more", "I feel stressed today") should be saved as SAVE_NOTE.
- If no intent matches, use UNKNOWN with a helpful message suggesting what they can do.
- Always extract person names when mentioned.
- Today's date for reference: ${today}
`;
}

/**
 * Parse a user message into a structured intent using OpenAI
 * @param {string} userMessage
 * @returns {Promise<{intent: string, data: object}>}
 */
async function parseIntent(userMessage) {
    try {
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user', content: userMessage }
            ],
            temperature: 0,
            max_tokens: 300
        });

        const text = response.choices[0].message.content.trim();

        // Strip markdown code fences if present
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

        return JSON.parse(cleaned);
    } catch (err) {
        console.error('[OpenAI] Error parsing intent:', err.message);
        return {
            intent: 'UNKNOWN',
            data: { message: 'Sorry, I could not understand that. Could you rephrase?' }
        };
    }
}

/**
 * Generate a natural language response using OpenAI
 * @param {string} systemContext  — background context about the result
 * @param {string} userMessage    — original user message
 * @returns {Promise<string>}
 */
async function generateResponse(systemContext, userMessage) {
    try {
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You are a friendly personal assistant on WhatsApp. Reply naturally in 1-3 short sentences. Be concise and warm. No markdown.'
                },
                {
                    role: 'user',
                    content: `Context: ${systemContext}\nUser said: "${userMessage}"`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        return response.choices[0].message.content.trim();
    } catch (err) {
        console.error('[OpenAI] Error generating response:', err.message);
        return systemContext;
    }
}

module.exports = { parseIntent, generateResponse };
