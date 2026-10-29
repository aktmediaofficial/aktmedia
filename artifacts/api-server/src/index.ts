import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { pool } from '@workspace/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// 1. Serve your built Vite frontend static files
const frontendDist = path.join(__dirname, '../../akt-media/dist');
app.use(express.static(frontendDist));

// 2. API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AKT Media API Server is running successfully' });
});

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

// 4. Express v5 safe catch-all route for frontend Single Page App routing (excludes /api)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend build not found. Please ensure the frontend build step ran successfully.');
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
