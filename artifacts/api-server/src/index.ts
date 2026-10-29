import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { pool } from '@workspace/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Automatically find where the frontend build folder is located
const possibleFrontendPaths = [
  path.join(__dirname, '../../akt-media/dist'),
  path.join(__dirname, '../akt-media/dist'),
  path.join(process.cwd(), '../akt-media/dist'),
  path.join(process.cwd(), 'akt-media/dist'),
];

const frontendDist = possibleFrontendPaths.find((dir) => fs.existsSync(dir)) || possibleFrontendPaths[0];

console.log(`📂 Serving static frontend from: ${frontendDist}`);
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  console.warn('⚠️ Warning: Frontend dist folder not found on startup.');
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
    res.status(404).send('Frontend build not found. Please ensure the frontend build step ran successfully.');
  }
});

// Start server after database checks complete
runMigration().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
