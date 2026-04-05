import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const data = JSON.parse(fs.readFileSync('./heritage_sites.json', 'utf-8'));
  console.log(`Loaded ${data.length} records`);

  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Check if data already exists
  const [rows] = await connection.execute('SELECT COUNT(*) as cnt FROM heritage_sites');
  if (rows[0].cnt > 0) {
    console.log(`Table already has ${rows[0].cnt} records, clearing...`);
    await connection.execute('DELETE FROM heritage_sites');
  }

  // Batch insert
  const batchSize = 200;
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = batch.flatMap(r => [
      r.id,
      r.categoryId || null,
      r.name,
      r.era || null,
      r.address || null,
      r.type || null,
      r.batch || null,
      r.longitude,
      r.latitude
    ]);
    
    await connection.execute(
      `INSERT INTO heritage_sites (originalId, categoryId, name, era, address, type, batch, longitude, latitude) VALUES ${placeholders}`,
      values
    );
    
    inserted += batch.length;
    if (inserted % 1000 === 0 || inserted === data.length) {
      console.log(`Inserted ${inserted}/${data.length}`);
    }
  }

  console.log('Import complete!');
  
  // Verify
  const [count] = await connection.execute('SELECT COUNT(*) as cnt FROM heritage_sites');
  console.log(`Total records in DB: ${count[0].cnt}`);
  
  await connection.end();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
