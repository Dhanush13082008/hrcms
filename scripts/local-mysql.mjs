// Optional Windows development instance. Never connects to an existing MySQL service.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
const root = resolve(import.meta.dirname, '..');
const data = resolve(root, '.local/mysql');
const envPath = resolve(root, 'backend/.env');
const credentialPath = resolve(root, '.local/mysql-credentials.json');
const executable =
  process.env.MYSQLD_PATH ||
  'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe';
const port = 3307;
await mkdir(resolve(root, '.local'), { recursive: true });
let credentials;
try {
  credentials = JSON.parse(await readFile(credentialPath, 'utf8'));
} catch {
  credentials = {
    rootPassword: randomBytes(24).toString('hex'),
    appPassword: randomBytes(24).toString('hex'),
    secret: randomBytes(48).toString('hex'),
    initialized: false,
  };
  await writeFile(credentialPath, JSON.stringify(credentials), { flag: 'wx' });
}
const options = {
  host: '127.0.0.1',
  port,
  user: 'root',
  password: credentials.initialized ? credentials.rootPassword : '',
  connectTimeout: 1500,
};
if (process.argv.includes('--stop')) {
  const conn = await mysql.createConnection(options);
  await conn.query('SHUTDOWN');
  await conn.end().catch(() => {});
  console.log('Stopped project MySQL instance.');
  process.exit(0);
}
let running = false;
try {
  const c = await mysql.createConnection(options);
  await c.end();
  running = true;
} catch (e) {
  if (e.code === 'ER_ACCESS_DENIED_ERROR')
    throw new Error(
      'Port 3307 belongs to a different database. Stopped without changing it.',
    );
}
if (!running) {
  try {
    await access(resolve(data, 'auto.cnf'));
  } catch {
    await mkdir(data, { recursive: true });
    const init = spawnSync(
      executable,
      ['--no-defaults', '--initialize-insecure', `--datadir=${data}`],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (init.status !== 0)
      throw new Error(
        init.stderr || init.error?.message || 'MySQL initialization failed',
      );
  }
  const child = spawn(
    executable,
    [
      '--no-defaults',
      `--datadir=${data}`,
      '--bind-address=127.0.0.1',
      `--port=${port}`,
      '--mysqlx=0',
      `--log-error=${resolve(root, '.local/mysql-error.log')}`,
    ],
    { detached: true, windowsHide: true, stdio: 'ignore' },
  );
  child.on('error', (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  child.unref();
  await writeFile(resolve(root, '.local/mysql.pid'), String(child.pid));
  let available = false;
  for (let i = 0; i < 40; i++) {
    try {
      const c = await mysql.createConnection(options);
      await c.end();
      available = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!available)
    throw new Error('MySQL did not start; see .local/mysql-error.log');
}
if (!credentials.initialized) {
  const conn = await mysql.createConnection(options);
  await conn.query('ALTER USER CURRENT_USER() IDENTIFIED BY ?', [
    credentials.rootPassword,
  ]);
  await conn.end();
  credentials.initialized = true;
  await writeFile(credentialPath, JSON.stringify(credentials));
}
try {
  await access(envPath);
} catch {
  await writeFile(
    envPath,
    `NODE_ENV=development\nHOST=127.0.0.1\nPORT=5000\nCLIENT_ORIGIN=http://127.0.0.1:5173\nDB_HOST=127.0.0.1\nDB_PORT=${port}\nDB_USER=hrcms_app\nDB_PASSWORD=${credentials.appPassword}\nDB_NAME=hrcms\nDB_ADMIN_USER=root\nDB_ADMIN_PASSWORD=${credentials.rootPassword}\nDB_TEST_NAME=hrcms_test\nJWT_SECRET=${credentials.secret}\n`,
  );
}
console.log(
  'Project MySQL is ready at 127.0.0.1:3307. Private configuration is in backend/.env.',
);
