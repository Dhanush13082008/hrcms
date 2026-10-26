import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rows, transaction } from './db.js';
import { schemas, parse, routeId } from './validation.js';
import { HttpError } from './auth.js';
export const adminRouter = Router();
const resources = {
  blocks: { table: 'hostel_block', key: 'block_id' },
  rooms: { table: 'room', key: 'room_id' },
  types: { table: 'room_type', key: 'type_code' },
  categories: { table: 'complaint_category', key: 'category_id' },
  users: { table: 'users', key: 'user_id' },
};
const userSelect = `SELECT u.user_id,u.full_name,u.email,u.role,u.is_active,u.created_at,
 s.reg_no,s.gender,s.department,s.year_of_study,s.guardian_name,
 w.designation,w.office_room,m.category_id,m.block_id,m.shift,
 (SELECT MIN(phone_no) FROM user_phone p WHERE p.user_id=u.user_id) AS phone_no
 FROM users u LEFT JOIN student s ON s.student_id=u.user_id LEFT JOIN warden w ON w.warden_id=u.user_id LEFT JOIN maintenance_staff m ON m.staff_id=u.user_id`;
adminRouter.get('/metadata', async (req, res) =>
  res.json({
    data: {
      blocks: await rows('SELECT * FROM hostel_block ORDER BY block_name'),
      types: await rows('SELECT * FROM room_type ORDER BY capacity'),
      categories: await rows(
        'SELECT * FROM complaint_category ORDER BY category_name',
      ),
      wardens: await rows(
        'SELECT u.user_id,u.full_name FROM users u JOIN warden w ON w.warden_id=u.user_id WHERE u.is_active=1 ORDER BY u.full_name',
      ),
    },
  }),
);
adminRouter.param('resource', (req, res, next, value) => {
  if (!resources[value]) return next(new HttpError(404, 'Unknown resource'));
  req.resource = resources[value];
  next();
});
adminRouter.get('/:resource', async (req, res) => {
  const resource = req.params.resource;
  const sql =
    resource === 'users'
      ? userSelect + ' ORDER BY u.user_id'
      : resource === 'rooms'
        ? 'SELECT * FROM v_room_occupancy ORDER BY block_name,room_number'
        : `SELECT * FROM ${req.resource.table} ORDER BY ${req.resource.key}`;
  res.json({ data: await rows(sql) });
});
function userDetails(d) {
  if (
    d.role === 'STUDENT' &&
    (!d.reg_no || !d.gender || !d.department || !d.year_of_study)
  )
    throw new HttpError(
      400,
      'Student registration, gender, department and year are required',
    );
  if (d.role === 'STAFF' && (!d.category_id || !d.block_id || !d.shift))
    throw new HttpError(400, 'Staff block, category and shift are required');
}
async function checkUserLinks(d, conn) {
  if (d.role === 'STAFF') {
    const [block] = await rows(
      'SELECT * FROM hostel_block WHERE block_id=? AND is_active=1',
      [d.block_id],
      conn,
    );
    const [cat] = await rows(
      'SELECT * FROM complaint_category WHERE category_id=? AND is_active=1',
      [d.category_id],
      conn,
    );
    if (!block || !cat)
      throw new HttpError(400, 'Choose an active block and category');
  }
}
async function writeSubclass(id, d, conn, create) {
  if (d.role === 'STUDENT') {
    const values = [
      d.reg_no,
      d.gender,
      d.department,
      d.year_of_study,
      d.guardian_name || null,
    ];
    if (create)
      await rows(
        'INSERT INTO student(reg_no,gender,department,year_of_study,guardian_name,student_id) VALUES(?,?,?,?,?,?)',
        [...values, id],
        conn,
      );
    else
      await rows(
        'UPDATE student SET reg_no=?,gender=?,department=?,year_of_study=?,guardian_name=? WHERE student_id=?',
        [...values, id],
        conn,
      );
  }
  if (d.role === 'WARDEN')
    await rows(
      create
        ? 'INSERT INTO warden(designation,office_room,warden_id) VALUES(?,?,?)'
        : 'UPDATE warden SET designation=?,office_room=? WHERE warden_id=?',
      [d.designation || 'Warden', d.office_room || null, id],
      conn,
    );
  if (d.role === 'STAFF')
    await rows(
      create
        ? 'INSERT INTO maintenance_staff(category_id,block_id,shift,staff_id) VALUES(?,?,?,?)'
        : 'UPDATE maintenance_staff SET category_id=?,block_id=?,shift=? WHERE staff_id=?',
      [d.category_id, d.block_id, d.shift, id],
      conn,
    );
  if (d.phone_no !== undefined) {
    await rows('DELETE FROM user_phone WHERE user_id=?', [id], conn);
    if (d.phone_no)
      await rows('INSERT INTO user_phone VALUES(?,?)', [id, d.phone_no], conn);
  }
}
async function validateResource(resource, d, id, conn) {
  if (resource === 'rooms') {
    const [block] = await rows(
      'SELECT * FROM hostel_block WHERE block_id=? FOR UPDATE',
      [d.block_id],
      conn,
    );
    const [type] = await rows(
      'SELECT * FROM room_type WHERE type_code=? FOR UPDATE',
      [d.type_code],
      conn,
    );
    if (!block || !type)
      throw new HttpError(400, 'Block or room type not found');
    if (d.floor_no >= block.total_floors)
      throw new HttpError(
        400,
        `Floor must be between 0 and ${block.total_floors - 1}`,
      );
    if (d.is_active && (!block.is_active || !type.is_active))
      throw new HttpError(
        400,
        'Active rooms require an active block and room type',
      );
    if (id) {
      const [existing] = await rows(
        'SELECT * FROM room WHERE room_id=? FOR UPDATE',
        [id],
        conn,
      );
      const [count] = await rows(
        "SELECT COUNT(*) AS n FROM room_allocation WHERE room_id=? AND status='ACTIVE'",
        [id],
        conn,
      );
      if (count.n > type.capacity)
        throw new HttpError(
          400,
          'Room type capacity is below current occupancy',
        );
      if (count.n && (!d.is_active || existing.block_id !== d.block_id))
        throw new HttpError(
          400,
          'Vacate occupants before deactivating or moving this room',
        );
      const [mismatch] = await rows(
        "SELECT COUNT(*) AS n FROM room_allocation a JOIN student s ON s.student_id=a.student_id WHERE a.room_id=? AND a.status='ACTIVE' AND s.gender<>?",
        [id, block.gender_type],
        conn,
      );
      if (mismatch.n)
        throw new HttpError(400, 'Block gender does not match occupants');
    }
  }
  if (resource === 'blocks') {
    if (d.warden_id) {
      const [w] = await rows(
        "SELECT u.user_id FROM users u JOIN warden w ON w.warden_id=u.user_id WHERE u.user_id=? AND u.role='WARDEN' AND u.is_active=1",
        [d.warden_id],
        conn,
      );
      if (!w) throw new HttpError(400, 'Choose an active warden');
    }
    if (id) {
      await rows(
        'SELECT room_id FROM room WHERE block_id=? FOR UPDATE',
        [id],
        conn,
      );
      const [floor] = await rows(
        'SELECT MAX(floor_no) AS highest FROM room WHERE block_id=?',
        [id],
        conn,
      );
      if (floor.highest !== null && floor.highest >= d.total_floors)
        throw new HttpError(
          400,
          'Existing rooms are above the proposed floor count',
        );
      const [count] = await rows(
        "SELECT COUNT(*) AS n FROM room_allocation a JOIN room r ON r.room_id=a.room_id JOIN student s ON s.student_id=a.student_id WHERE r.block_id=? AND a.status='ACTIVE' AND (s.gender<>? OR ?=0)",
        [id, d.gender_type, d.is_active],
        conn,
      );
      if (count.n)
        throw new HttpError(400, 'Occupied rooms prevent this block change');
    }
  }
  if (resource === 'types' && id) {
    await rows(
      'SELECT room_id FROM room WHERE type_code=? FOR UPDATE',
      [id],
      conn,
    );
    const counts = await rows(
      "SELECT r.room_id,COUNT(a.allocation_id) AS n FROM room r LEFT JOIN room_allocation a ON a.room_id=r.room_id AND a.status='ACTIVE' WHERE r.type_code=? GROUP BY r.room_id",
      [id],
      conn,
    );
    if (counts.some((r) => r.n > d.capacity || (!d.is_active && r.n)))
      throw new HttpError(
        400,
        'Current room occupancy prevents this capacity or availability change',
      );
    if (d.type_code !== id)
      throw new HttpError(400, 'Room type code cannot be changed');
  }
}
adminRouter.post('/:resource', async (req, res) => {
  const resource = req.params.resource,
    d = parse(schemas[resource], req.body);
  const id = await transaction(req.user.user_id, async (conn) => {
    if (resource === 'users') {
      userDetails(d);
      await checkUserLinks(d, conn);
      if (!d.password)
        throw new HttpError(
          400,
          'An initial password of at least 10 characters is required',
        );
      const result = await rows(
        'INSERT INTO users(full_name,email,password_hash,role,is_active) VALUES(?,?,?,?,?)',
        [
          d.full_name,
          d.email,
          await bcrypt.hash(d.password, 12),
          d.role,
          d.is_active,
        ],
        conn,
      );
      await writeSubclass(result.insertId, d, conn, true);
      return result.insertId;
    }
    await validateResource(resource, d, null, conn);
    const keys = Object.keys(d);
    const result = await rows(
      `INSERT INTO ${req.resource.table} (${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`,
      Object.values(d),
      conn,
    );
    return resource === 'types' ? d.type_code : result.insertId;
  });
  res.status(201).json({ data: { id }, message: 'Created successfully' });
});
adminRouter.patch('/:resource/:id', async (req, res) => {
  const resource = req.params.resource,
    id = resource === 'types' ? req.params.id : routeId(req.params.id),
    d = parse(schemas[resource], req.body);
  await transaction(req.user.user_id, async (conn) => {
    const [existing] = await rows(
      `SELECT * FROM ${req.resource.table} WHERE ${req.resource.key}=? FOR UPDATE`,
      [id],
      conn,
    );
    if (!existing) throw new HttpError(404, 'Record not found');
    if (resource === 'users') {
      userDetails(d);
      await checkUserLinks(d, conn);
      if (d.role !== existing.role)
        throw new HttpError(
          400,
          'Roles cannot be changed. Create a separate account to preserve history.',
        );
      if (id === req.user.user_id && !d.is_active)
        throw new HttpError(400, 'You cannot deactivate your own account');
      if (!d.is_active) {
        const [active] = await rows(
          "SELECT COUNT(*) AS n FROM room_allocation WHERE student_id=? AND status='ACTIVE'",
          [id],
          conn,
        );
        const [jobs] = await rows(
          "SELECT COUNT(*) AS n FROM complaint WHERE assigned_staff_id=? AND status IN ('ASSIGNED','IN_PROGRESS')",
          [id],
          conn,
        );
        const [blocks] = await rows(
          'SELECT COUNT(*) AS n FROM hostel_block WHERE warden_id=? AND is_active=1',
          [id],
          conn,
        );
        if (active.n || jobs.n || blocks.n)
          throw new HttpError(
            400,
            'Vacate rooms, finish or reassign jobs, and transfer managed blocks before deactivating this user',
          );
      }
      if (d.role === 'STUDENT') {
        const [mismatch] = await rows(
          "SELECT COUNT(*) AS n FROM room_allocation a JOIN room r ON r.room_id=a.room_id JOIN hostel_block b ON b.block_id=r.block_id WHERE a.student_id=? AND a.status='ACTIVE' AND b.gender_type<>?",
          [id, d.gender],
          conn,
        );
        if (mismatch.n)
          throw new HttpError(
            400,
            'Gender does not match the currently allocated block',
          );
      }
      if (d.role === 'STAFF') {
        const [mismatch] = await rows(
          "SELECT COUNT(*) AS n FROM complaint c JOIN room r ON r.room_id=c.room_id WHERE c.assigned_staff_id=? AND c.status IN ('ASSIGNED','IN_PROGRESS') AND (r.block_id<>? OR c.category_id<>?)",
          [id, d.block_id, d.category_id],
          conn,
        );
        if (mismatch.n)
          throw new HttpError(
            400,
            'Active jobs prevent changing staff block or specialisation',
          );
      }
      await rows(
        'UPDATE users SET full_name=?,email=?,is_active=? WHERE user_id=?',
        [d.full_name, d.email, d.is_active, id],
        conn,
      );
      if (d.password)
        await rows(
          'UPDATE users SET password_hash=? WHERE user_id=?',
          [await bcrypt.hash(d.password, 12), id],
          conn,
        );
      await writeSubclass(id, d, conn, false);
      return;
    }
    await validateResource(resource, d, id, conn);
    const keys = Object.keys(d);
    await rows(
      `UPDATE ${req.resource.table} SET ${keys.map((k) => k + '=?').join(',')} WHERE ${req.resource.key}=?`,
      [...Object.values(d), id],
      conn,
    );
  });
  res.json({ message: 'Changes saved' });
});
