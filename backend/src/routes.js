import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { rows, pool, transaction, call } from './db.js';
import {
  authenticate,
  allow,
  HttpError,
  tokenFor,
  complaintScope,
  accessibleComplaint,
} from './auth.js';
import { schemas, parse, routeId } from './validation.js';
import { adminRouter } from './admin.js';
export const api = Router();
api.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'mysql' });
});
api.post(
  '/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  }),
  async (req, res) => {
    const { email, password } = parse(schemas.login, req.body);
    const [user] = await rows('SELECT * FROM users WHERE email=?', [email]);
    const valid = await bcrypt.compare(
      password,
      user?.password_hash ||
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    );
    if (!user?.is_active || !valid)
      throw new HttpError(401, 'Incorrect email or password');
    delete user.password_hash;
    res.json({ token: tokenFor(user), user });
  },
);
api.use(authenticate);
api.get('/auth/me', (req, res) => res.json({ data: req.user }));
api.get('/profile', async (req, res) => {
  const phone = await rows(
    'SELECT phone_no FROM user_phone WHERE user_id=? ORDER BY phone_no',
    [req.user.user_id],
  );
  let details = {};
  if (req.user.role === 'STUDENT')
    [details] = await rows(
      'SELECT student_id,reg_no,gender,department,year_of_study,guardian_name FROM student WHERE student_id=?',
      [req.user.user_id],
    );
  if (req.user.role === 'WARDEN')
    [details] = await rows(
      'SELECT w.*,b.block_name FROM warden w LEFT JOIN hostel_block b ON b.warden_id=w.warden_id WHERE w.warden_id=?',
      [req.user.user_id],
    );
  if (req.user.role === 'STAFF')
    [details] = await rows('SELECT * FROM v_staff_workload WHERE staff_id=?', [
      req.user.user_id,
    ]);
  res.json({
    data: { ...req.user, ...details, phones: phone.map((p) => p.phone_no) },
  });
});
api.patch('/profile', async (req, res) => {
  const data = parse(schemas.profile, req.body);
  await transaction(req.user.user_id, async (conn) => {
    await rows(
      'UPDATE users SET full_name=? WHERE user_id=?',
      [data.full_name, req.user.user_id],
      conn,
    );
    if (data.phone_no !== undefined) {
      await rows(
        'DELETE FROM user_phone WHERE user_id=?',
        [req.user.user_id],
        conn,
      );
      if (data.phone_no)
        await rows(
          'INSERT INTO user_phone VALUES(?,?)',
          [req.user.user_id, data.phone_no],
          conn,
        );
    }
  });
  res.json({ message: 'Profile updated' });
});
api.patch('/profile/password', async (req, res) => {
  const data = parse(schemas.password, req.body);
  const [user] = await rows('SELECT password_hash FROM users WHERE user_id=?', [
    req.user.user_id,
  ]);
  if (!(await bcrypt.compare(data.current_password, user.password_hash)))
    throw new HttpError(400, 'Current password is incorrect');
  await rows('UPDATE users SET password_hash=? WHERE user_id=?', [
    await bcrypt.hash(data.new_password, 12),
    req.user.user_id,
  ]);
  res.json({ message: 'Password changed' });
});
api.get('/categories', async (req, res) =>
  res.json({
    data: await rows(
      'SELECT * FROM complaint_category WHERE is_active=1 ORDER BY category_name',
    ),
  }),
);
api.get('/complaints', async (req, res) => {
  const scope = complaintScope(req.user);
  let where = scope.sql;
  const args = [...scope.args];
  if (req.query.status) {
    if (
      ![
        'OPEN',
        'ASSIGNED',
        'IN_PROGRESS',
        'RESOLVED',
        'CLOSED',
        'REJECTED',
        'COMPLETED',
      ].includes(req.query.status)
    )
      throw new HttpError(400, 'Invalid status filter');
    if (req.query.status === 'COMPLETED') {
      where += " AND c.status IN ('RESOLVED','CLOSED')";
    } else {
      where += ' AND c.status=?';
      args.push(req.query.status);
    }
  }
  if (req.query.category_id) {
    where += ' AND c.category_id=?';
    args.push(routeId(req.query.category_id));
  }
  if (req.query.priority) {
    if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(req.query.priority))
      throw new HttpError(400, 'Invalid priority');
    where += ' AND c.priority=?';
    args.push(req.query.priority);
  }
  if (req.query.overdue === 'true') where += ' AND c.is_overdue=1';
  if (req.query.search) {
    where +=
      ' AND (c.title LIKE ? OR c.room_number LIKE ? OR c.student_name LIKE ?)';
    const q = '%' + String(req.query.search).slice(0, 100) + '%';
    args.push(q, q, q);
  }
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const limit = 100;
  const [{ total }] = await rows(
    `SELECT COUNT(*) AS total FROM v_complaint_dashboard c WHERE ${where}`,
    args,
  );
  const data = await rows(
    `SELECT c.* FROM v_complaint_dashboard c WHERE ${where} ORDER BY c.created_at DESC,c.complaint_id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    args,
  );
  res.json({ data, total, page, page_size: limit });
});
api.post('/complaints', allow('STUDENT'), async (req, res) => {
  const d = parse(schemas.complaint, req.body);
  const result = await transaction(req.user.user_id, (conn) =>
    call(conn, 'sp_raise_complaint', [
      req.user.user_id,
      d.category_id,
      d.title,
      d.description,
      d.priority || null,
    ]),
  );
  res.status(201).json({ data: result, message: 'Complaint submitted' });
});
api.get('/complaints/:id', async (req, res) => {
  const c = await accessibleComplaint(req.user, routeId(req.params.id));
  const history = await rows(
    'SELECT l.*,u.full_name AS changed_by_name FROM complaint_log l LEFT JOIN users u ON u.user_id=l.changed_by WHERE l.complaint_id=? ORDER BY l.log_id',
    [c.complaint_id],
  );
  const [feedback] = await rows('SELECT * FROM feedback WHERE complaint_id=?', [
    c.complaint_id,
  ]);
  res.json({ data: { ...c, history, feedback: feedback || null } });
});
api.post(
  '/complaints/:id/assign',
  allow('WARDEN', 'ADMIN'),
  async (req, res) => {
    const id = routeId(req.params.id),
      d = parse(schemas.assign, req.body);
    await accessibleComplaint(req.user, id);
    await transaction(req.user.user_id, (conn) =>
      call(conn, 'sp_assign_complaint', [id, d.staff_id, req.user.user_id]),
    );
    res.json({ message: 'Complaint assigned' });
  },
);
api.patch('/complaints/:id/status', async (req, res) => {
  const id = routeId(req.params.id),
    d = parse(schemas.status, req.body);
  await accessibleComplaint(req.user, id);
  await transaction(req.user.user_id, (conn) =>
    call(conn, 'sp_update_status', [id, d.status, req.user.user_id, d.remark]),
  );
  res.json({
    message: d.status === 'OPEN' ? 'Complaint reopened' : 'Status updated',
  });
});
api.post('/complaints/:id/feedback', allow('STUDENT'), async (req, res) => {
  const id = routeId(req.params.id),
    d = parse(schemas.feedback, req.body);
  await accessibleComplaint(req.user, id);
  await transaction(req.user.user_id, (conn) =>
    rows(
      'INSERT INTO feedback(complaint_id,rating,comments) VALUES(?,?,?)',
      [id, d.rating, d.comments || null],
      conn,
    ),
  );
  res
    .status(201)
    .json({ message: 'Thanks for your feedback. Complaint closed.' });
});
api.get('/rooms/my', allow('STUDENT'), async (req, res) => {
  const [room] = await rows(
    "SELECT a.allocation_id,a.academic_year,a.allocated_on,o.* FROM room_allocation a JOIN v_room_occupancy o ON o.room_id=a.room_id WHERE a.student_id=? AND a.status='ACTIVE'",
    [req.user.user_id],
  );
  const roommates = room
    ? await rows(
        "SELECT u.full_name,s.reg_no,s.department,s.year_of_study FROM room_allocation a JOIN student s ON s.student_id=a.student_id JOIN users u ON u.user_id=s.student_id WHERE a.room_id=? AND a.status='ACTIVE' AND s.student_id<>?",
        [room.room_id, req.user.user_id],
      )
    : [];
  const history = await rows(
    'SELECT a.*,r.room_number,b.block_name FROM room_allocation a JOIN room r ON r.room_id=a.room_id JOIN hostel_block b ON b.block_id=r.block_id WHERE a.student_id=? ORDER BY a.allocation_id DESC',
    [req.user.user_id],
  );
  res.json({ data: room ? { ...room, roommates } : null, history });
});
api.get('/rooms', allow('WARDEN', 'ADMIN'), async (req, res) => {
  const args = [],
    where = [];
  if (req.user.role === 'WARDEN') {
    where.push('warden_id=?');
    args.push(req.user.user_id);
  }
  if (req.query.availability) {
    if (!['AVAILABLE', 'FULL', 'BLOCKED'].includes(req.query.availability))
      throw new HttpError(400, 'Invalid availability');
    where.push('availability=?');
    args.push(req.query.availability);
  }
  res.json({
    data: await rows(
      `SELECT * FROM v_room_occupancy ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY block_name,room_number`,
      args,
    ),
  });
});
api.get('/allocations', allow('WARDEN', 'ADMIN'), async (req, res) => {
  const where = req.user.role === 'WARDEN' ? 'AND b.warden_id=?' : '';
  const args = req.user.role === 'WARDEN' ? [req.user.user_id] : [];
  res.json({
    data: await rows(
      `SELECT a.*,u.full_name,s.reg_no,s.department,r.room_number,b.block_name FROM room_allocation a JOIN student s ON s.student_id=a.student_id JOIN users u ON u.user_id=s.student_id JOIN room r ON r.room_id=a.room_id JOIN hostel_block b ON b.block_id=r.block_id WHERE a.status='ACTIVE' ${where} ORDER BY b.block_name,r.room_number,u.full_name`,
      args,
    ),
  });
});
api.post('/rooms/allocate', allow('WARDEN', 'ADMIN'), async (req, res) => {
  const d = parse(schemas.allocation, req.body);
  const result = await transaction(req.user.user_id, (conn) =>
    call(conn, 'sp_allocate_room', [
      d.student_id,
      d.room_id,
      d.academic_year,
      req.user.user_id,
    ]),
  );
  res.status(201).json({ data: result, message: 'Room allocated' });
});
api.post(
  '/allocations/:id/vacate',
  allow('WARDEN', 'ADMIN'),
  async (req, res) => {
    await transaction(req.user.user_id, (conn) =>
      call(conn, 'sp_vacate_room', [routeId(req.params.id), req.user.user_id]),
    );
    res.json({ message: 'Room vacated. Allocation history preserved.' });
  },
);
api.get('/students/unallocated', allow('WARDEN', 'ADMIN'), async (req, res) =>
  res.json({
    data: await rows(
      "SELECT s.student_id,s.reg_no,s.gender,s.department,u.full_name FROM student s JOIN users u ON u.user_id=s.student_id WHERE u.is_active=1 AND NOT EXISTS(SELECT 1 FROM room_allocation a WHERE a.student_id=s.student_id AND a.status='ACTIVE') ORDER BY u.full_name",
    ),
  }),
);
api.get('/staff', allow('WARDEN', 'ADMIN'), async (req, res) => {
  const where = ['is_active=1'],
    args = [];
  if (req.user.role === 'WARDEN') {
    where.push('warden_id=?');
    args.push(req.user.user_id);
  }
  for (const field of ['category_id', 'block_id'])
    if (req.query[field]) {
      where.push(`${field}=?`);
      args.push(routeId(req.query[field]));
    }
  res.json({
    data: await rows(
      `SELECT * FROM v_staff_workload WHERE ${where.join(' AND ')} ORDER BY active_jobs,full_name`,
      args,
    ),
  });
});
api.get('/dashboard', async (req, res) => {
  const scope = complaintScope(req.user);
  const complaints = await rows(
    `SELECT c.* FROM v_complaint_dashboard c WHERE ${scope.sql} ORDER BY c.created_at DESC,c.complaint_id DESC LIMIT 6`,
    scope.args,
  );
  const [stats] = await rows(
    `SELECT COUNT(*) AS total,COALESCE(SUM(status IN ('OPEN','ASSIGNED','IN_PROGRESS')),0) AS active,COALESCE(SUM(status='OPEN'),0) AS unassigned,COALESCE(SUM(status='RESOLVED'),0) AS awaiting_feedback,COALESCE(SUM(status IN ('RESOLVED','CLOSED')),0) AS resolved,COALESCE(SUM(is_overdue),0) AS overdue FROM v_complaint_dashboard c WHERE ${scope.sql}`,
    scope.args,
  );
  const by_status = await rows(
    `SELECT status,COUNT(*) AS count FROM v_complaint_dashboard c WHERE ${scope.sql} GROUP BY status`,
    scope.args,
  );
  const by_category = await rows(
    `SELECT category_name,COUNT(*) AS total,SUM(status IN ('RESOLVED','CLOSED')) AS resolved FROM v_complaint_dashboard c WHERE ${scope.sql} GROUP BY category_name ORDER BY total DESC`,
    scope.args,
  );
  const [metrics] = await rows(
    `SELECT ROUND(AVG(f.rating),1) AS avg_rating,ROUND(AVG(CASE WHEN c.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,c.created_at,c.resolved_at)/60 END),1) AS avg_resolution_hours FROM v_complaint_dashboard c LEFT JOIN feedback f ON f.complaint_id=c.complaint_id WHERE ${scope.sql}`,
    scope.args,
  );
  let occupancy = null;
  if (['ADMIN', 'WARDEN'].includes(req.user.role)) {
    const [o] = await rows(
      `SELECT COUNT(*) AS rooms,COALESCE(SUM(capacity),0) AS beds,COALESCE(SUM(occupied),0) AS occupied,COALESCE(SUM(CASE WHEN availability='AVAILABLE' THEN vacancies ELSE 0 END),0) AS available FROM v_room_occupancy ${req.user.role === 'WARDEN' ? 'WHERE warden_id=?' : ''}`,
      req.user.role === 'WARDEN' ? [req.user.user_id] : [],
    );
    occupancy = o;
  }
  const blocks =
    req.user.role === 'WARDEN'
      ? await rows('SELECT * FROM hostel_block WHERE warden_id=?', [
          req.user.user_id,
        ])
      : [];
  res.json({
    data: {
      stats,
      complaints,
      by_status,
      by_category,
      metrics,
      occupancy,
      blocks,
    },
  });
});
api.get('/reports/overdue', allow('WARDEN', 'ADMIN'), async (req, res) => {
  const scope = complaintScope(req.user);
  res.json({
    data: await rows(
      `SELECT c.* FROM v_overdue_complaints c WHERE ${scope.sql} ORDER BY age_hours DESC`,
      scope.args,
    ),
  });
});
api.use('/admin', allow('ADMIN'), adminRouter);
