fetch('http://localhost:3000/api/admin/users/SUGEETHJSA', {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer SUGEETHJSA'
    },
    body: JSON.stringify({ role: 'admin' })
})
.then(async res => {
    console.log(res.status);
    console.log(await res.text());
})
.catch(console.error);
