# 🤖 WhatsApp Personal Assistant

A self-hosted AI-powered WhatsApp assistant that remembers everything — people, birthdays, watchlists, notes, todos — and connects to your Google Calendar. Just chat naturally, it figures out the rest.

---

## ✨ Features

### 🧠 Smart Memory
- **People profiles** — Save facts about anyone. Mention them again and it links automatically.
- **Watchlists** — "I want to watch One Piece someday" gets saved and recalled on demand.
- **Notes & Ideas** — Capture thoughts mid-conversation without any structure required.
- **To-dos & Reminders** — Natural language task saving. "Remind me to call the dentist Friday."

### 📅 Google Calendar Integration
- Detects dates and events from natural language and creates calendar events automatically.
- Birthdays, meetings, deadlines — all handled.
- Updates or deletes events when you say so.

### 🔗 Entity Linking
- "John", "my friend John", and "John from uni" all map to the same person record.
- All notes, dates, and facts about a person stay unified under one profile.

### 💬 Natural Recall
- Ask "What do I know about Priya?" and get everything back.
- "What's on my watchlist?" returns your saved shows/anime.
- "What are my todos for this week?" queries and summarises.

---

## 🛠️ Tech Stack

| Layer | Tool |
|---|---|
| WhatsApp | [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) |
| Server | Node.js + Express |
| AI Brain | Gemini 1.5 Flash (free via Google AI Studio) |
| Memory | SQLite (via better-sqlite3) |
| Calendar | Google Calendar API |
| Deployment | Railway |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Google account (for Calendar API)
- A free Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/whatsapp-assistant.git
cd whatsapp-assistant
npm install
```

### 2. Set up environment variables
Create a `.env` file in the root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token
YOUR_WHATSAPP_NUMBER=your_number_in_international_format
```

### 3. Set up Google Calendar API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project → Enable the **Google Calendar API**
3. Create OAuth 2.0 credentials (Web Application)
4. Add your Railway URL as an authorized redirect URI
5. Run `npm run auth` to get your refresh token and paste it in `.env`

### 4. Run locally
```bash
npm run dev
```
Scan the QR code in your terminal with WhatsApp to link your account.

---

## ☁️ Deploying to Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub Repo**
3. Add all your `.env` variables in the Railway **Variables** tab
4. Railway auto-detects Node.js and deploys — done ✅

> **Note:** whatsapp-web.js requires a persistent session file. Make sure to add a **Railway Volume** mounted at `/app/.wwebjs_auth` so your WhatsApp session survives redeploys.

---

## 🗄️ Database Schema (SQLite)

```
people     — id, name, aliases (JSON array), notes, created_at
events     — id, person_id (→ people), type, date, description, calendar_event_id, created_at
watchlist  — id, title, type (anime/movie/show/other), status (pending/watching/completed), created_at
todos      — id, task, due_date, done, created_at
notes      — id, content, tags (JSON array), created_at
```

---

## 💬 Example Commands

| What you say | What happens |
|---|---|
| "Save that John is my uni friend from Delhi" | Creates a person profile for John |
| "What do I know about John?" | Returns John's full profile |
| "John's birthday is March 15" | Saves the event, creates a calendar entry |
| "I want to watch One Piece" | Adds One Piece to watchlist (anime) |
| "What's on my watchlist?" | Returns your full watchlist |
| "Remind me to call the dentist Friday" | Creates a todo with due date |
| "What are my pending todos?" | Lists all open todos |
| "Mark dentist as done" | Checks off the todo |
| "Note: Think about switching to Rust" | Saves a free-form note |
| "Create a meeting with Priya on Friday at 3pm" | Creates a Google Calendar event |

---

## 🗺️ Roadmap

- [ ] Voice message transcription (Whisper API)
- [ ] Image saving — send a photo and tag it to a person or note
- [ ] Recurring reminders ("every Monday remind me to log my hours")
- [ ] Daily/weekly digest — morning summary of todos, birthdays this week
- [ ] WhatsApp group support — assistant works inside a dedicated group
- [ ] Web dashboard to browse and edit all stored memories
- [ ] Export memory as JSON or Notion database
- [ ] Multi-user support (each number gets its own isolated memory)
- [ ] Sentiment-aware notes ("I'm stressed about X" stores differently)
- [ ] Smart deduplication — warns if you're saving something you already saved

---

## 📁 Project Structure

```
whatsapp-assistant/
├── src/
│   ├── index.js          # Entry point, WhatsApp listener + Express server
│   ├── ai/
│   │   └── gemini.js     # Intent parsing & entity extraction
│   ├── handlers/
│   │   ├── calendar.js   # Google Calendar integration
│   │   ├── memory.js     # SQLite read/write logic
│   │   └── router.js     # Routes parsed intent to the right handler
│   └── db/
│       ├── schema.sql    # Database schema
│       └── db.js         # DB connection & auto-initialisation
├── scripts/
│   └── auth.js           # Google OAuth2 setup helper
├── data/                 # Auto-created; holds assistant.db (gitignored)
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Privacy

All your data stays in your own Railway instance and SQLite database. No third party (other than Gemini for inference) ever sees your messages. You can self-host fully with Ollama to make it 100% private.

---

## 🤝 Contributing

PRs welcome! If you add a new memory type or integration, please update the schema and handlers accordingly.

---

## 📄 License

MIT
