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
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n[WhatsApp] Scan this QR code with your phone:\n');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated successfully.');
});

client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Authentication failed:', msg);
});

client.on('ready', () => {
    console.log('[WhatsApp] Client is ready! Listening for messages...');
});

client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Client disconnected:', reason);
});

// ─── Message Handler ──────────────────────────────────────────────────────────
client.on('message', async (msg) => {
    // Only respond to messages from yourself (personal assistant mode)
    // Normalize both numbers to digits only for a consistent comparison
    const senderNumber = msg.from.replace(/\D/g, '');
    const yourNumber = YOUR_NUMBER.replace(/\D/g, '');

    if (senderNumber !== yourNumber) return;

    // Ignore group messages (their IDs end with @g.us) and status broadcasts
    if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return;

    const messageBody = msg.body.trim();
    if (!messageBody) return;

    console.log(`[Message] Received: "${messageBody}"`);

    try {
        // Parse the intent using Gemini
        const parsed = await parseIntent(messageBody);
        console.log(`[Intent] Detected: ${parsed.intent}`, JSON.stringify(parsed.data));

        // Route to the appropriate handler
        const reply = await routeIntent(parsed, messageBody);

        if (reply) {
            await msg.reply(reply);
            console.log(`[Reply] Sent: "${reply.substring(0, 80)}${reply.length > 80 ? '...' : ''}"`);
        }
    } catch (err) {
        console.error('[Handler] Unhandled error:', err);
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
