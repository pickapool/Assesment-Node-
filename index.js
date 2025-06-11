const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const TOKEN_PATH = 'token.json';

if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(token);
  changeOwnership(); 
} else {
  getAccessToken();
}

function getAccessToken() {
  const SCOPES = ['https://www.googleapis.com/auth/drive'];
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: (http://localhost/?code=) after', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('File created token');
      changeOwnership();
    } catch (err) {
      console.error('❌ Error retrieving tokens:', err.message);
    }
  });
}

async function changeOwnership() {
  const fileId = '1YCIOGgLCUcRT7yok4Db1-sEVoRYTtQCO';
  const newOwnerEmail = 'cyrilleconm0817@gmail.com';

  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  try {
    const res = await drive.permissions.list({
      fileId,
      fields: 'permissions(id, role, emailAddress)',
      supportsAllDrives: true,
    });

    const existing = res.data.permissions.find(
      (p) => p.emailAddress === newOwnerEmail
    );

    if (!existing) {
      console.log(`${newOwnerEmail} has no access. Adding as writer first.`);
      await drive.permissions.create({
        fileId,
        resource: {
          type: 'user',
          role: 'writer',
          emailAddress: newOwnerEmail,
        },
        sendNotificationEmail: true,
        supportsAllDrives: true,
      });
      console.log(`${newOwnerEmail} added as writer.`);
    } else {
      console.log(`${newOwnerEmail} already has permission: ${existing.role}`);
    }

    await drive.permissions.create({
      fileId,
      resource: {
        type: 'user',
        role: 'owner',
        emailAddress: newOwnerEmail,
      },
      transferOwnership: true,
      sendNotificationEmail: true,
      supportsAllDrives: true,
    });

    console.log(`Ownership transfer initiated to ${newOwnerEmail}.`);
  } catch (error) {
    console.error('Error during ownership transfer:', error.message);
  }
}

app.listen(PORT);
