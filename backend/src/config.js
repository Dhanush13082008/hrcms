import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
});
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error('Set JWT_SECRET to at least 32 characters in backend/.env');
if (!/^[a-zA-Z0-9_]+$/.test(process.env.DB_NAME || 'hrcms'))
  throw new Error('Invalid DB_NAME');
export const config = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || '127.0.0.1',
  origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  secret,
  production: process.env.NODE_ENV === 'production',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'hrcms_app',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'hrcms',
    timezone: 'Z',
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true,
    connectionLimit: 10,
  },
};
