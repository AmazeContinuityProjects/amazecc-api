const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.qkhuduhaupwwydsvguba:TheBigBannaBoy123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`).then(res => {
  console.log(res.rows);
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});
