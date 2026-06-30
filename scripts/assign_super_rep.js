require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function assignSuperRep(clubId, vtopId) {
  if (!clubId || !vtopId) {
    console.error('Usage: node assign_super_rep.js <club_id> <vtop_id>');
    process.exit(1);
  }

  try {
    const res = await pool.query(
      `INSERT INTO club_representatives (club_id, vtop_id, role) 
       VALUES ($1, $2, 'super-club-rep')
       ON CONFLICT (club_id, vtop_id) 
       DO UPDATE SET role = 'super-club-rep'
       RETURNING *`,
      [clubId, vtopId]
    );

    console.log('Successfully assigned super-club-rep:');
    console.log(res.rows[0]);
  } catch (error) {
    console.error('Error assigning super rep:', error);
  } finally {
    await pool.end();
  }
}

const args = process.argv.slice(2);
assignSuperRep(args[0], args[1]);
