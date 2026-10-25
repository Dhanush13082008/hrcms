import jwt from 'jsonwebtoken';
import { rows } from './db.js';
import { config } from './config.js';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError(401, 'Please sign in to continue');
    let claims;
    try {
      claims = jwt.verify(token, config.secret, {
        algorithms: ['HS256'],
        issuer: 'hrcms',
        audience: 'hrcms-web',
      });
    } catch {
      throw new HttpError(401, 'Your session expired. Please sign in again');
    }
    const [user] = await rows(
      'SELECT user_id,full_name,email,role,is_active,created_at FROM users WHERE user_id=?',
      [claims.sub],
    );
    if (!user?.is_active)
      throw new HttpError(401, 'This account is unavailable');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
export const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : next(new HttpError(403, 'This action is not available for your role'));
export function tokenFor(user) {
  return jwt.sign({ role: user.role }, config.secret, {
    subject: String(user.user_id),
    expiresIn: '8h',
    issuer: 'hrcms',
    audience: 'hrcms-web',
    algorithm: 'HS256',
  });
}
export function complaintScope(user, alias = 'c') {
  if (user.role === 'STUDENT')
    return { sql: `${alias}.student_id=?`, args: [user.user_id] };
  if (user.role === 'WARDEN')
    return { sql: `${alias}.warden_id=?`, args: [user.user_id] };
  if (user.role === 'STAFF')
    return { sql: `${alias}.assigned_staff_id=?`, args: [user.user_id] };
  return { sql: '1=1', args: [] };
}
export async function accessibleComplaint(user, id, conn) {
  const scope = complaintScope(user);
  const [c] = await rows(
    `SELECT c.* FROM v_complaint_dashboard c WHERE c.complaint_id=? AND ${scope.sql}`,
    [id, ...scope.args],
    conn,
  );
  if (!c) throw new HttpError(404, 'Complaint not found');
  return c;
}
