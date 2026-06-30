require('dotenv').config({ path: '.env' });
const crypto = require('crypto');

const SECRET = process.env.ADMIN_SECRET || "development-secret-key-1234567890"; // Let's guess the secret or we can just read .env

function generateSignature(payload) {
    return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

function signAdminToken(username) {
    const payloadObj = { username, role: 'superadmin', permissions: ['dashboard', 'qbank', 'buses', 'push', 'fresher-resources', 'faculty-directories', 'users'], exp: Date.now() + 1000 * 60 * 60 * 24 * 7 };
    const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const signature = generateSignature(payloadStr);
    return `${payloadStr}.${signature}`;
}

const token = signAdminToken("SUGEETHJSA");

// Restore user
fetch('http://localhost:3000/api/admin/users/SUGEETHJSA', {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ is_active: true })
})
.then(async res => {
    console.log("Port 3000:", res.status);
    console.log(await res.text());
})
.catch(err => console.error("Port 3000 Error", err));
