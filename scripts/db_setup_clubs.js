const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/sugee/Documents/GitHub/AmazeContinuityProjects/AmazeCC-API/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS club_details (
          club_id VARCHAR(255) PRIMARY KEY,
          club_name VARCHAR(255) NOT NULL,
          mission TEXT,
          description TEXT,
          hiring_process TEXT,
          website VARCHAR(255),
          recruitment_link VARCHAR(255),
          instagram VARCHAR(255),
          whatsapp VARCHAR(255),
          poc VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("club_details table created successfully");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    await pool.end();
  }
}

run();


