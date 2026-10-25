import { app } from './app.js';
import { pool } from './db.js';
import { config } from './config.js';
await pool.query('SELECT 1');
const server = app.listen(config.port, config.host, () =>
  console.log(`Haven API ready at http://${config.host}:${config.port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
