import express from 'express';
import cors from 'cors';
import { pool } from '@workspace/db';

const app = express();

app.use(cors());
app.use(express.json());

// Root health check endpoint so visiting the URL shows status instead of "Cannot GET /"
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AKT Media API Server is running successfully' });
});

// Auto-run database migration table creation
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

// Start server after database checks complete
runMigration().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
