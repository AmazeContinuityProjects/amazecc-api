fetch('http://127.0.0.1:3001/api/admin/vtop-clubs', {
    method: 'GET',
    headers: {
        'cookie': 'admin_auth=SUGEETHJSA'
    }
}).then(r => r.json()).then(console.log).catch(console.error);
