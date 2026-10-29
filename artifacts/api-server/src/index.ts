import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { pool } from '@workspace/db';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the embedded public folder
const frontendDist = path.join(__dirname, 'public');

console.log(`📂 Serving static frontend from: ${frontendDist}`);
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  console.warn('⚠️ Warning: Frontend public folder not found.');
}

// API Health Check Route
app.get('/api/health', (req, res) => {
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

// Catch-all route for frontend Single Page App routing (excludes /api)
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found.');
  }
});

// Start server after database checks complete
runMigration().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
