import express from 'express';
import { pool } from '@workspace/db';
import path from 'path';

// Serve static files built from the frontend
const frontendDist = path.join(__dirname, '../../akt-media/dist');
app.use(express.static(frontendDist));

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Ensure your express app is created
const app = express();
app.use(express.json());

// Auto-run table creation directly via SQL query
async function runMigration() {
  try {
    if (!pool) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        tracks JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Database schema verified/applied successfully.');
  } catch (err) {
    console.error('❌ Failed to apply database schema:', err);
  }
}

// Run migration and start the server
runMigration().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
