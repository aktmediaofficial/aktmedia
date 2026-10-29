import { Router } from 'express';
import { query } from '../db';

const router = Router();

router.post('/playlists', async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    const { title, tracks } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await query(
      'INSERT INTO playlists (session_id, title, tracks) VALUES (\, \, \) RETURNING *',
      [sessionId, title, JSON.stringify(tracks || [])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/playlists', async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;

    const result = await query(
      'SELECT * FROM playlists WHERE session_id = \ ORDER BY created_at DESC',
      [sessionId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;