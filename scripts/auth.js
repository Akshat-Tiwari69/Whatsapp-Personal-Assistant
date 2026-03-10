/**
 * Google OAuth2 setup script
 *
 * Usage:
 *   node scripts/auth.js
 *   # Visit the URL printed, approve, then copy the code and run:
 *   node scripts/auth.js --code "YOUR_AUTH_CODE"
 */
require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const args = process.argv.slice(2);
const codeIndex = args.indexOf('--code');

if (codeIndex !== -1 && args[codeIndex + 1]) {
    // Exchange auth code for tokens
    const code = args[codeIndex + 1];
    oauth2Client.getToken(code, (err, token) => {
        if (err) {
            console.error('Error retrieving access token:', err.message);
            return;
        }
        console.log('\n✅ Success! Add this to your .env file:\n');
        console.log(`GOOGLE_REFRESH_TOKEN=${token.refresh_token}`);
        console.log('\nDone! Restart your assistant after updating .env.');
    });
} else {
    // Print the auth URL
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
        process.exit(1);
    }

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });

    console.log('\n🔑 Google Calendar Authorization\n');
    console.log('1. Visit this URL in your browser:\n');
    console.log(`   ${authUrl}\n`);
    console.log('2. Approve access to your Google Calendar');
    console.log('3. Copy the authorization code from the redirect URL');
    console.log('4. Run: node scripts/auth.js --code "YOUR_AUTH_CODE"\n');
}
