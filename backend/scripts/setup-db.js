import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { config } from '../src/config.js';

export function statements(source) {
  let delimiter = ';',
    buffer = '',
    result = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*DELIMITER\s+/i.test(line)) {
      delimiter = line.trim().split(/\s+/)[1];
      continue;
    }
    if (/^\s*--/.test(line) || (!buffer && !line.trim())) continue;
    buffer += line + '\n';
    if (buffer.trimEnd().endsWith(delimiter)) {
      result.push(buffer.trimEnd().slice(0, -delimiter.length));
      buffer = '';
    }
  }
  if (buffer.trim()) throw new Error('Unterminated SQL statement');
  return result;
}
export async function setupDatabase(name = config.db.database) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid database name');
  const conn = await mysql.createConnection({
    ...config.db,
    database: undefined,
    user: process.env.DB_ADMIN_USER || config.db.user,
    password: process.env.DB_ADMIN_PASSWORD ?? config.db.password,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${name}\``);
    const [[{ count }]] = await conn.query(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE'",
      [name],
    );
    if (count > 0)
      throw new Error(
        `Database ${name} already contains tables; setup stopped without changing them. Choose a new DB_NAME.`,
      );
    for (const file of ['01_schema.sql', '02_logic.sql']) {
      const source = await readFile(
        new URL(`../../database/${file}`, import.meta.url),
        'utf8',
      );
      for (const sql of statements(source)) await conn.query(sql);
    }
    if (
      process.env.DB_ADMIN_USER &&
      config.db.user !== process.env.DB_ADMIN_USER
    ) {
      // Credentials are sent as values, never interpolated into shell commands.
      await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [
        config.db.user,
        '127.0.0.1',
        config.db.password,
      ]);
      await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [
        config.db.user,
        'localhost',
        config.db.password,
      ]);
      for (const host of ['127.0.0.1', 'localhost'])
        await conn.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${name}\`.* TO ?@?`,
          [config.db.user, host],
        );
    }
    console.log(
      `Created ${name}: 13 tables, 4 views, 6 triggers, 5 procedures.`,
    );
  } finally {
    await conn.end();
  }
}
if (process.argv[1]?.endsWith('setup-db.js'))
  setupDatabase().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
