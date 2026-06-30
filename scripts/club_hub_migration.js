const { Pool } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\sugee\\Documents\\GitHub\\AmazeContinuityProjects\\AmazeCC-API\\.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log("Creating club_representatives table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS club_representatives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id VARCHAR(255) NOT NULL,
        vtop_id VARCHAR(50) NOT NULL,
        role VARCHAR(50) DEFAULT 'representative',
        assigned_by VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(club_id, vtop_id)
      )
    `);

    console.log("Creating club_feed table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS club_feed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id VARCHAR(255) NOT NULL,
        event_id VARCHAR(255),
        content TEXT NOT NULL,
        links JSONB DEFAULT '[]'::jsonb,
        posted_by VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Creating club_landing_pages table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS club_landing_pages (
        club_id VARCHAR(255) PRIMARY KEY,
        theme JSONB DEFAULT '{"primary_color": "#3B82F6", "mode": "light"}'::jsonb,
        showcase_projects JSONB DEFAULT '[]'::jsonb,
        popular_events JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log("Migration completed successfully!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
