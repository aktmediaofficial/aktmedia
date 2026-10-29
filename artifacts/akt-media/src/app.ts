import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { sessionMiddleware } from './middlewares/session';
import playlistsRouter from './routes/playlists';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
app.use('/api', playlistsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;