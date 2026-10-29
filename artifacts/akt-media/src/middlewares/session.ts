import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE_NAME = 'sessionId';

export const sessionMiddleware: RequestHandler = (req, res, next) => {
  let sessionId = req.cookies[SESSION_COOKIE_NAME];

  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  (req as any).sessionId = sessionId;
  next();
};