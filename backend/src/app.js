import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { ZodError } from 'zod';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api } from './routes.js';
import { config } from './config.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.origin }));
app.use(express.json({ limit: '64kb' }));
app.use(
  '/api',
  (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  api,
);
app.use('/api', (req, res) =>
  res.status(404).json({ error: 'API endpoint not found' }),
);
const frontend = fileURLToPath(
  new URL('../../frontend/dist/', import.meta.url),
);
if (existsSync(frontend)) {
  app.use(express.static(frontend));
  app.get('/{*path}', (req, res) => res.sendFile(frontend + 'index.html'));
}
app.use((err, req, res, next) => {
  if (err instanceof ZodError)
    return res.status(400).json({
      error: err.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    });
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.sqlState === '45000')
    return res.status(400).json({ error: err.sqlMessage });
  if (err.code === 'ER_DUP_ENTRY')
    return res
      .status(409)
      .json({ error: 'A record with those details already exists' });
  if (
    [
      'ER_CHECK_CONSTRAINT_VIOLATED',
      'ER_DATA_TOO_LONG',
      'WARN_DATA_TRUNCATED',
      'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
    ].includes(err.code)
  )
    return res.status(400).json({ error: 'A value violates a database rule' });
  if (['ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].includes(err.code))
    return res
      .status(400)
      .json({ error: 'A referenced record is missing or is still in use' });
  if (
    ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(
      err.code,
    )
  )
    return res
      .status(503)
      .json({ error: 'Database unavailable. Check the MySQL configuration.' });
  console.error('Request failed:', err.code || err.name, err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
