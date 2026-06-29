require('dotenv').config();
const { Pool } = require('pg');

async function setup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Creating faculty_directory_urls table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faculty_directory_urls (
        id VARCHAR(50) PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL
      );
    `);

    console.log("Seeding table...");
    const schools = [
      { id: 'scope', name: 'SCOPE', url: 'https://chennai.vit.ac.in/computer-science-engineering-chennai/faculty/' },
      { id: 'sense', name: 'SENSE', url: 'https://chennai.vit.ac.in/electrical-and-electronics-engineering-chennai/faculty/' },
      { id: 'smec', name: 'SMEC', url: 'https://chennai.vit.ac.in/mechanical-engineering-chennai/faculty/' },
      { id: 'select', name: 'SELECT', url: 'https://chennai.vit.ac.in/civil-engineering-chennai/faculty/' },
      { id: 'sas', name: 'SAS', url: 'https://chennai.vit.ac.in/advanced-sciences-chennai/faculty/' },
      { id: 'vbs', name: 'VBS', url: 'https://chennai.vit.ac.in/vit-business-school-chennai/faculty/' },
      { id: 'vsl', name: 'VSL (Law)', url: 'https://chennai.vit.ac.in/law-chennai/faculty/' },
      { id: 'vfsi', name: 'VFSI (Fashion)', url: 'https://chennai.vit.ac.in/fashion-technology-chennai/faculty/' }
    ];

    for (const school of schools) {
      await pool.query(
        `INSERT INTO faculty_directory_urls (id, school_name, url) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (id) DO UPDATE SET school_name = $2, url = $3`,
        [school.id, school.name, school.url]
      );
    }
    console.log("Done!");
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

setup();
