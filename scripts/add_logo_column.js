const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const query = `
      ALTER TABLE club_details
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255);
    `;
    await pool.query(query);
    console.log("Added logo_url column to club_details successfully!");
  } catch (error) {
    console.error("Error adding column:", error);
  } finally {
    pool.end();
  }
}

main();
