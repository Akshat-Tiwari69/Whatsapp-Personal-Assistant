require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { parseIntent } = require('./ai/gemini');
const { routeIntent } = require('./handlers/router');

// Validate required environment variables
const REQUIRED_ENV = ['GEMINI_API_KEY', 'YOUR_WHATSAPP_NUMBER'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[Config] Copy .env.example to .env and fill in the values.');
    process.exit(1);
}

const YOUR_NUMBER = process.env.YOUR_WHATSAPP_NUMBER;
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log(`[Config] YOUR_WHATSAPP_NUMBER = "${YOUR_NUMBER}"`);
console.log(`[Config] Normalized digits only = "${YOUR_NUMBER.replace(/\D/g, '')}"`);
console.log(`[Config] GEMINI_API_KEY set = ${!!process.env.GEMINI_API_KEY}`);
console.log(`[Config] GOOGLE_REFRESH_TOKEN set = ${!!process.env.GOOGLE_REFRESH_TOKEN}`);
console.log(`[Config] CHROME_PATH = "${process.env.CHROME_PATH || '(not set, using bundled Chromium)'}"`);

// ─── Express health server ────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'WhatsApp Personal Assistant is running' });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// Google OAuth callback route (used during first-time auth setup)
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Missing authorization code.');
    }
    res.send(`
        <h2>Authorization code received!</h2>
        <p>Copy this code and run the auth script:</p>
        <pre>${code}</pre>
        <p>Run: <code>node scripts/auth.js --code "${code}"</code></p>
    `);
});

app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});

// ─── WhatsApp Client ──────────────────────────────────────────────────────────
// On ARM servers (e.g. Oracle Cloud), point CHROME_PATH to the system Chromium:
//   CHROME_PATH=/usr/bin/chromium-browser
// Leave unset on Windows / x86 to use Puppeteer's bundled Chromium.
const puppeteerOptions = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update'
    ]
};
if (process.env.CHROME_PATH) {
    puppeteerOptions.executablePath = process.env.CHROME_PATH;
    console.log(`[Puppeteer] Using system Chrome at: ${process.env.CHROME_PATH}`);
} else {
    console.log('[Puppeteer] Using Puppeteer bundled Chromium');
}

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
    }),
    puppeteer: puppeteerOptions
});

client.on('qr', (qr) => {
    console.log('\n[WhatsApp] Scan this QR code with your phone:\n');
    qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Loading: ${percent}% — ${message}`);
});

client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated successfully.');
});

client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Authentication failed:', msg);
});

client.on('ready', () => {
    console.log('[WhatsApp] Client is ready! Listening for messages...');
    console.log(`[WhatsApp] Watching for messages from: ${YOUR_NUMBER}`);
});

client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Client disconnected:', reason);
});

// ─── Message Handler ──────────────────────────────────────────────────────────
// We use 'message_create' (not 'message') because when you text yourself
// (Saved Messages), you are the SENDER — whatsapp-web.js only fires
// 'message_create' for outgoing/self messages, not 'message'.
//
// LOOP PREVENTION: msg.reply() also triggers message_create (fromMe=true).
// We track IDs of messages the bot sends and skip them.
const botSentIds = new Set();

client.on('message_create', async (msg) => {
    // Skip messages the bot itself sent (prevents infinite reply loop)
    const msgId = msg.id && msg.id._serialized;
    if (msgId && botSentIds.has(msgId)) {
        botSentIds.delete(msgId);
        return;
    }

    // ── Debug: log every event so we can see what's coming in ──
    console.log(`[Debug] message_create | fromMe=${msg.fromMe} | from="${msg.from}" | to="${msg.to}" | type=${msg.type} | body="${(msg.body || '').substring(0, 60)}"`);

    // Only process messages YOU sent (personal assistant mode)
    if (!msg.fromMe) {
        console.log('[Filter] Skipped — not sent by you.');
        return;
    }

    // Ignore group messages and status broadcasts
    if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') {
        console.log('[Filter] Skipped — group or broadcast.');
        return;
    }

    // Only respond to messages sent to yourself (Saved Messages chat)
    const yourDigits = YOUR_NUMBER.replace(/\D/g, '');
    const toDigits = (msg.to || '').replace(/\D/g, '');
    if (toDigits && toDigits !== yourDigits) {
        console.log(`[Filter] Skipped — message sent to someone else (${msg.to}), not to yourself.`);
        return;
    }

    const messageBody = (msg.body || '').trim();
    if (!messageBody) {
        console.log('[Filter] Skipped — empty message body.');
        return;
    }

    console.log(`[Message] Processing: "${messageBody}"`);

    try {
        // Parse the intent using Gemini
        console.log('[Gemini] Parsing intent...');
        const parsed = await parseIntent(messageBody);
        console.log(`[Intent] Detected: ${parsed.intent} | data: ${JSON.stringify(parsed.data)}`);

        // Route to the appropriate handler
        console.log('[Router] Routing intent...');
        const reply = await routeIntent(parsed, messageBody);

        if (reply) {
            const sentMsg = await msg.reply(reply);
            // Track the sent message ID so message_create doesn't loop on it
            if (sentMsg && sentMsg.id && sentMsg.id._serialized) {
                botSentIds.add(sentMsg.id._serialized);
            }
            console.log(`[Reply] Sent: "${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}"`);
        } else {
            console.log('[Reply] No reply generated.');
        }
    } catch (err) {
        console.error('[Handler] Unhandled error:', err.message);
        console.error(err.stack);
        await msg.reply('Sorry, something went wrong. Please try again.');
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
console.log('[Startup] Initializing WhatsApp Personal Assistant...');
client.initialize();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Shutdown] SIGTERM received, closing gracefully...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Shutdown] SIGINT received, closing gracefully...');
    await client.destroy();
    process.exit(0);
});

// Catch unhandled promise rejections so PM2 doesn't silently swallow them
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Process] Unhandled Promise Rejection:', reason);
});
