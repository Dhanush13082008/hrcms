import mysql from 'mysql2/promise';
import { config } from './config.js';
export const pool = mysql.createPool(config.db);
// Driver date serialization does not change MySQL's session time zone.
pool.on('connection', (connection) => {
  connection.query("SET SESSION time_zone = '+00:00'");
});
export async function rows(sql, args = [], conn = pool) {
  const [result] = await conn.execute(sql, args);
  return result;
}
export async function transaction(actor, work) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        'SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED',
      );
      await conn.beginTransaction();
      await conn.query('SET @app_user_id=?, @app_remark=NULL', [actor]);
      const result = await work(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      if (error.code !== 'ER_LOCK_DEADLOCK' || attempt === 2) throw error;
    } finally {
      try {
        await conn.query('SET @app_user_id=NULL, @app_remark=NULL');
      } finally {
        conn.release();
      }
    }
  }
}
export async function call(conn, name, values) {
  const [result] = await conn.query(
    `CALL ${name}(${values.map(() => '?').join(',')})`,
    values,
  );
  return Array.isArray(result[0]) ? result[0][0] : {};
}
