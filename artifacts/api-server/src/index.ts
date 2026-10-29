import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '@workspace/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Initialize Express app properly first
const app = express();

app.use(express.json());

// 2. Serve your built Vite frontend static files from the monorepo
const frontendDist = path.join(__dirname, '../../akt-media/dist');
app.use(express.static(frontendDist));

// 3. Auto-run database migration table creation
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

// 4. Catch-all route for frontend client-side routing (Single Page App support)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next(); // Let API routes pass through
  }
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend build not found or API endpoint missing.');
    }
  });
});

// 5. Start server after database checks complete
runMigration().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
