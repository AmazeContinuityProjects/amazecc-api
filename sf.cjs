const crypto=require('crypto');const fs=require('fs');
let secret;fs.readFileSync('.env','utf8').split('\n').forEach(l=>{const m=l.match(/^ADMIN_SECRET=(.*)$/);if(m)secret=m[1].trim();});
const p={username:'sugee',role:'superadmin',permissions:['gorobo'],exp:Date.now()+7e8};const ps=Buffer.from(JSON.stringify(p)).toString('base64');
const token=`${ps}.${crypto.createHmac('sha256',secret).update(ps).digest('hex')}`;
const id='1377cbfa-7841-4b8a-98c1-20803b8f02a0';
const H={Authorization:`Bearer ${token}`};const BASE='http://localhost:3000';
async function call(method,path,body){const opts={method,headers:H};if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  const res=await fetch(BASE+path,opts);const txt=await res.text();let s=null;try{const j=JSON.parse(txt);s=j?.order?.status??j?.error??'(nonjson)';}catch{s='(html '+(txt.includes('Page Not Found')?'notfound':'?')+')';}
  return `${method} ${path.replace(id,'<id>')} -> ${res.status} ${JSON.stringify(s)}`;}
(async()=>{
  const out=[];
  out.push(await call('GET',`/api/admin/gorobo/orders/${id}`));
  out.push(await call('POST',`/api/admin/gorobo/orders/${id}/archive`,{reason:'smoke test'}));
  out.push(await call('GET',`/api/admin/gorobo/orders/${id}`));
  out.push(await call('POST',`/api/admin/gorobo/orders/${id}/archive`,{}));
  out.push(await call('POST',`/api/admin/gorobo/orders/${id}/unarchive`));
  out.push(await call('GET',`/api/admin/gorobo/orders/${id}`));
  out.push(await call('POST',`/api/admin/gorobo/orders/${id}/unarchive`));
  fs.writeFileSync('C:\Users\sugee\AppData\Local\Temp\opencode\smoke_final.log',out.join('\n'));
  console.log(out.join('\n'));
})().catch(e=>console.error('ERR',e.message));
