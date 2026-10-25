import { test } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import request from 'supertest';
import { config } from '../src/config.js';
import { setupDatabase } from '../scripts/setup-db.js';
import { seedDatabase } from '../scripts/seed.js';

test('HRCMS integration against an isolated real MySQL database', async (t) => {
  // Always create a unique database; never reset or reuse the development database.
  const name = `hrcms_test_${Date.now()}`;
  config.db.database = name;
  let pool, admin;
  try {
    await setupDatabase(name);
    await seedDatabase(name);
    const { app } = await import('../src/app.js');
    ({ pool } = await import('../src/db.js'));
    const login = async (email) => {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'Hostel@123' });
      assert.equal(r.status, 200, r.body.error);
      return r.body.token;
    };
    const token = {
      student: await login('arjun@student.edu'),
      roommate: await login('rohan@student.edu'),
      unallocated: await login('harish@student.edu'),
      warden: await login('warden.a@hrcms.edu'),
      otherWarden: await login('warden.b@hrcms.edu'),
      staff: await login('ramesh@hrcms.edu'),
      otherStaff: await login('suresh@hrcms.edu'),
      cleaner: await login('vijay@hrcms.edu'),
      admin: await login('admin@hrcms.edu'),
    };
    const get = (url, role = 'student') =>
      request(app)
        .get('/api' + url)
        .auth(token[role], { type: 'bearer' });
    const post = (url, body, role = 'student') =>
      request(app)
        .post('/api' + url)
        .auth(token[role], { type: 'bearer' })
        .send(body);
    const patch = (url, body, role = 'student') =>
      request(app)
        .patch('/api' + url)
        .auth(token[role], { type: 'bearer' })
        .send(body);
    const complaint = {
      category_id: 4,
      title: 'Please clean the room corridor',
      description:
        'The corridor outside our room has not been cleaned recently.',
    };
    let created;
    await t.test(
      'health confirms MySQL and rejects anonymous access',
      async () => {
        assert.equal(
          (await request(app).get('/api/health')).body.database,
          'mysql',
        );
        assert.equal((await request(app).get('/api/complaints')).status, 401);
      },
    );
    await t.test('wrong credentials do not log in', async () => {
      assert.equal(
        (
          await request(app)
            .post('/api/auth/login')
            .send({ email: 'arjun@student.edu', password: 'incorrect' })
        ).status,
        401,
      );
    });
    await t.test(
      'all roles load their scoped dashboards and profile',
      async () => {
        for (const role of ['student', 'warden', 'staff', 'admin']) {
          const r = await get('/dashboard', role);
          assert.equal(r.status, 200, r.body.error);
          assert.ok(r.body.data.stats);
          assert.equal((await get('/profile', role)).status, 200);
        }
      },
    );
    await t.test(
      'student cannot access admin, rooms, team or reports',
      async () => {
        for (const url of [
          '/admin/users',
          '/rooms',
          '/staff',
          '/reports/overdue',
        ])
          assert.equal((await get(url)).status, 403);
      },
    );
    await t.test(
      'student lists only own complaints and cannot read another student timeline',
      async () => {
        const r = await get('/complaints');
        assert.ok(r.body.data.every((c) => c.student_id === 13));
        assert.equal((await get('/complaints/2')).status, 404);
      },
    );
    await t.test(
      'warden and staff scopes exclude other blocks and jobs',
      async () => {
        const r = await get('/complaints', 'otherWarden');
        assert.ok(r.body.data.every((c) => c.block_id === 2));
        assert.equal((await get('/complaints/1', 'otherWarden')).status, 404);
        assert.equal((await get('/complaints/1', 'otherStaff')).status, 404);
      },
    );
    await t.test(
      'current room includes roommates and historical allocations',
      async () => {
        const r = await get('/rooms/my');
        assert.equal(r.body.data.room_number, 'A101');
        assert.equal(r.body.data.roommates[0].full_name, 'Rohan Sharma');
        const h = await get('/rooms/my', 'unallocated');
        assert.equal(h.body.data, null);
        assert.equal(h.body.history.length, 1);
      },
    );
    await t.test('unallocated students cannot raise complaints', async () => {
      const r = await post('/complaints', complaint, 'unallocated');
      assert.equal(r.status, 400);
      assert.match(r.body.error, /no allocated room/);
    });
    await t.test(
      'full rooms, maintenance rooms and second allocations are rejected',
      async () => {
        for (const data of [
          { student_id: 24, room_id: 1 },
          { student_id: 24, room_id: 6 },
          { student_id: 13, room_id: 5 },
        ]) {
          const r = await post(
            '/rooms/allocate',
            { ...data, academic_year: '2026-27' },
            'warden',
          );
          assert.equal(r.status, 400, r.body.error);
        }
        assert.equal(
          (
            await post(
              '/rooms/allocate',
              { student_id: 24, room_id: 5, academic_year: '2026-28' },
              'warden',
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'cross-block allotments and assignments are denied',
      async () => {
        assert.equal(
          (
            await post(
              '/rooms/allocate',
              { student_id: 24, room_id: 5, academic_year: '2026-27' },
              'otherWarden',
            )
          ).status,
          400,
        );
        assert.equal(
          (await post('/complaints/1/assign', { staff_id: 5 }, 'otherWarden'))
            .status,
          404,
        );
      },
    );
    await t.test(
      'new complaint uses category default and rejects duplicate room/category',
      async () => {
        const r = await post('/complaints', complaint);
        assert.equal(r.status, 201, r.body.error);
        created = r.body.data.complaint_id;
        const detail = await get('/complaints/' + created);
        assert.equal(detail.body.data.priority, 'LOW');
        const duplicate = await post('/complaints', complaint, 'roommate');
        assert.equal(duplicate.status, 400);
        assert.match(duplicate.body.error, /already exists/);
      },
    );
    await t.test('wrong specialist cannot receive a complaint', async () => {
      const r = await post(
        `/complaints/${created}/assign`,
        { staff_id: 6 },
        'warden',
      );
      assert.equal(r.status, 400);
      assert.match(r.body.error, /specialisation/);
    });
    await t.test(
      'assignment is logged and only assigned staff can start work',
      async () => {
        const r = await post(
          `/complaints/${created}/assign`,
          { staff_id: 8 },
          'warden',
        );
        assert.equal(r.status, 200, r.body.error);
        assert.equal(
          (
            await patch(
              `/complaints/${created}/status`,
              { status: 'IN_PROGRESS', remark: 'Starting now' },
              'staff',
            )
          ).status,
          404,
        );
        const detail = await get('/complaints/' + created);
        assert.equal(detail.body.data.history.length, 2);
        assert.equal(detail.body.data.history[1].changed_by, 2);
      },
    );
    await t.test('invalid transition and premature feedback fail', async () => {
      assert.equal(
        (
          await patch(
            `/complaints/${created}/status`,
            { status: 'RESOLVED', remark: 'All cleaned' },
            'cleaner',
          )
        ).status,
        400,
      );
      assert.equal(
        (await post(`/complaints/${created}/feedback`, { rating: 5 })).status,
        400,
      );
    });
    await t.test(
      'assigned staff starts and resolves with persisted remarks',
      async () => {
        assert.equal(
          (
            await patch(
              `/complaints/${created}/status`,
              { status: 'IN_PROGRESS', remark: 'Cleaning in progress' },
              'cleaner',
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await patch(
              `/complaints/${created}/status`,
              { status: 'RESOLVED', remark: 'Corridor cleaned and sanitised' },
              'cleaner',
            )
          ).status,
          200,
        );
        const r = await get('/complaints/' + created);
        assert.equal(r.body.data.status, 'RESOLVED');
        assert.ok(r.body.data.resolved_at);
        assert.equal(
          r.body.data.history.at(-1).remark,
          'Corridor cleaned and sanitised',
        );
      },
    );
    await t.test(
      'student can reopen, then staff must be assigned again',
      async () => {
        const r = await patch(`/complaints/${created}/status`, {
          status: 'OPEN',
          remark: 'A corner still needs cleaning',
        });
        assert.equal(r.status, 200, r.body.error);
        const detail = await get('/complaints/' + created);
        assert.equal(detail.body.data.resolved_at, null);
        assert.equal(detail.body.data.assigned_staff_id, null);
        await post(`/complaints/${created}/assign`, { staff_id: 8 }, 'warden');
        await patch(
          `/complaints/${created}/status`,
          { status: 'IN_PROGRESS', remark: 'Revisiting the room' },
          'cleaner',
        );
        await patch(
          `/complaints/${created}/status`,
          { status: 'RESOLVED', remark: 'Remaining corner cleaned' },
          'cleaner',
        );
      },
    );
    await t.test(
      'feedback requires ownership and 1–5 rating, then closes automatically',
      async () => {
        assert.equal(
          (
            await post(
              `/complaints/${created}/feedback`,
              { rating: 5 },
              'roommate',
            )
          ).status,
          404,
        );
        assert.equal(
          (await post(`/complaints/${created}/feedback`, { rating: 9 })).status,
          400,
        );
        const r = await post(`/complaints/${created}/feedback`, {
          rating: 5,
          comments: 'Thanks for the follow-up',
        });
        assert.equal(r.status, 201, r.body.error);
        const detail = await get('/complaints/' + created);
        assert.equal(detail.body.data.status, 'CLOSED');
        assert.equal(detail.body.data.feedback.rating, 5);
        assert.equal(detail.body.data.history.at(-1).changed_by, 13);
        assert.equal(
          (await post(`/complaints/${created}/feedback`, { rating: 5 })).status,
          400,
        );
      },
    );
    await t.test(
      'warden rejection requires a reason and is recorded',
      async () => {
        assert.equal(
          (
            await patch(
              '/complaints/3/status',
              { status: 'REJECTED', remark: 'No' },
              'warden',
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await patch(
              '/complaints/3/status',
              {
                status: 'REJECTED',
                remark: 'Please contact the furniture office',
              },
              'warden',
            )
          ).status,
          200,
        );
        assert.equal(
          (await get('/complaints/3', 'warden')).body.data.status,
          'REJECTED',
        );
      },
    );
    await t.test(
      'search treats injection strings as literal text',
      async () => {
        const r = await get(
          '/complaints?search=' + encodeURIComponent("' OR 1=1 --"),
        );
        assert.equal(r.status, 200);
        assert.equal(r.body.total, 0);
      },
    );
    await t.test(
      'admin lists all resources without password hashes',
      async () => {
        for (const resource of [
          'users',
          'blocks',
          'rooms',
          'types',
          'categories',
          'metadata',
        ]) {
          const r = await get('/admin/' + resource, 'admin');
          assert.equal(r.status, 200, r.body.error);
          assert.ok(!JSON.stringify(r.body).includes('password_hash'));
        }
      },
    );
    const makeStudent = async (label, gender = 'MALE') => {
      const r = await post(
        '/admin/users',
        {
          full_name: label,
          email: label.toLowerCase().replaceAll(' ', '') + '@test.edu',
          password: 'Student@123',
          role: 'STUDENT',
          reg_no: label.replaceAll(' ', '').slice(0, 15),
          gender,
          department: 'Computer Science',
          year_of_study: 2,
          is_active: true,
        },
        'admin',
      );
      assert.equal(r.status, 201, r.body.error);
      return r.body.data.id;
    };
    let concurrentRoom, newStudents;
    await t.test(
      'admin creates people, blocks, room types, rooms and categories',
      async () => {
        const block = await post(
          '/admin/blocks',
          {
            block_name: 'Test Block',
            gender_type: 'MALE',
            total_floors: 3,
            warden_id: null,
            is_active: true,
          },
          'admin',
        );
        assert.equal(block.status, 201, block.body.error);
        assert.equal(
          (
            await post(
              '/admin/types',
              {
                type_code: 'TEST',
                capacity: 1,
                annual_fee: 12345,
                is_active: true,
              },
              'admin',
            )
          ).status,
          201,
        );
        const room = await post(
          '/admin/rooms',
          {
            block_id: block.body.data.id,
            room_number: 'T101',
            floor_no: 0,
            type_code: 'TEST',
            has_ac: false,
            status: 'ACTIVE',
            is_active: true,
          },
          'admin',
        );
        assert.equal(room.status, 201, room.body.error);
        concurrentRoom = room.body.data.id;
        const cat = await post(
          '/admin/categories',
          {
            category_name: 'Test service',
            default_priority: 'MEDIUM',
            sla_hours: 10,
            is_active: true,
          },
          'admin',
        );
        assert.equal(cat.status, 201, cat.body.error);
        newStudents = [
          await makeStudent('Test One'),
          await makeStudent('Test Two'),
        ];
        const female = await makeStudent('Test Three', 'FEMALE');
        const r = await post(
          '/rooms/allocate',
          {
            student_id: female,
            room_id: concurrentRoom,
            academic_year: '2026-27',
          },
          'admin',
        );
        assert.equal(r.status, 400);
        assert.match(r.body.error, /gender/);
      },
    );
    await t.test(
      'simultaneous allotments cannot overfill the last bed',
      async () => {
        const results = await Promise.all(
          newStudents.map((student_id) =>
            post(
              '/rooms/allocate',
              { student_id, room_id: concurrentRoom, academic_year: '2026-27' },
              'admin',
            ),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
        const [[{ n }]] = await pool.query(
          "SELECT COUNT(*) AS n FROM room_allocation WHERE room_id=? AND status='ACTIVE'",
          [concurrentRoom],
        );
        assert.equal(n, 1);
      },
    );
    await t.test(
      'concurrent duplicate complaints create one record',
      async () => {
        const results = await Promise.all(
          ['student', 'roommate'].map((role) =>
            post('/complaints', { ...complaint, category_id: 6 }, role),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
      },
    );
    await t.test(
      'admin cannot invalidate occupied rooms or deactivate own account',
      async () => {
        const room = (await get('/admin/rooms', 'admin')).body.data.find(
          (r) => r.room_id === 1,
        );
        const roomResult = await patch(
          '/admin/rooms/1',
          {
            block_id: room.block_id,
            room_number: room.room_number,
            floor_no: room.floor_no,
            type_code: room.type_code,
            has_ac: !!room.has_ac,
            status: room.status,
            is_active: false,
          },
          'admin',
        );
        assert.equal(roomResult.status, 400);
        assert.match(roomResult.body.error, /Vacate occupants/);
        const admin = (await get('/admin/users', 'admin')).body.data.find(
          (u) => u.user_id === 1,
        );
        const adminResult = await patch(
          '/admin/users/1',
          {
            full_name: admin.full_name,
            email: admin.email,
            role: 'ADMIN',
            is_active: false,
          },
          'admin',
        );
        assert.equal(adminResult.status, 400);
        assert.match(adminResult.body.error, /own account/);
        const typeResult = await patch(
          '/admin/types/DOUBLE',
          {
            type_code: 'DOUBLE',
            capacity: 1,
            annual_fee: 75000,
            is_active: true,
          },
          'admin',
        );
        assert.equal(typeResult.status, 400);
        assert.match(typeResult.body.error, /occupancy/);
      },
    );
    await t.test(
      'completed filters and database session time zones are correct',
      async () => {
        const r = await get('/complaints?status=COMPLETED');
        assert.equal(r.status, 200, r.body.error);
        assert.ok(
          r.body.data.every((c) => ['RESOLVED', 'CLOSED'].includes(c.status)),
        );
        const [[{ zone }]] = await pool.query(
          'SELECT @@session.time_zone AS zone',
        );
        assert.equal(zone, '+00:00');
      },
    );
    await t.test(
      'admin edits and deactivates category while retaining history',
      async () => {
        assert.equal(
          (
            await patch(
              '/admin/categories/6',
              {
                category_name: 'Pest care',
                default_priority: 'HIGH',
                sla_hours: 30,
                is_active: false,
              },
              'admin',
            )
          ).status,
          200,
        );
        assert.ok(
          !(await get('/categories')).body.data.some(
            (c) => c.category_id === 6,
          ),
        );
      },
    );
    await t.test(
      'vacating preserves history and permits a new allocation',
      async () => {
        const list = (await get('/allocations', 'admin')).body.data;
        const a = list.find((a) => a.room_id === concurrentRoom);
        assert.equal(
          (await post(`/allocations/${a.allocation_id}/vacate`, {}, 'admin'))
            .status,
          200,
        );
        const r = await post(
          '/rooms/allocate',
          {
            student_id: a.student_id,
            room_id: concurrentRoom,
            academic_year: '2026-27',
          },
          'admin',
        );
        assert.equal(r.status, 201, r.body.error);
        const [[{ n }]] = await pool.query(
          'SELECT COUNT(*) AS n FROM room_allocation WHERE student_id=?',
          [a.student_id],
        );
        assert.equal(n, 2);
      },
    );
    await t.test(
      'profile edits persist and password checks are enforced',
      async () => {
        assert.equal(
          (
            await patch('/profile', {
              full_name: 'Arjun Reddy',
              phone_no: '9876543210',
            })
          ).status,
          200,
        );
        assert.equal((await get('/profile')).body.data.phones[0], '9876543210');
        assert.equal(
          (
            await patch('/profile/password', {
              current_password: 'incorrect',
              new_password: 'Something@123',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await patch('/profile/password', {
              current_password: 'Hostel@123',
              new_password: 'NewHostel@123',
            })
          ).status,
          200,
        );
        const r = await request(app)
          .post('/api/auth/login')
          .send({ email: 'arjun@student.edu', password: 'NewHostel@123' });
        assert.equal(r.status, 200, r.body.error);
      },
    );
    await t.test(
      'deactivated accounts immediately lose existing token access',
      async () => {
        const users = (await get('/admin/users', 'admin')).body.data;
        const d = { ...users.find((u) => u.user_id === 24) };
        for (const k of ['category_id', 'block_id', 'shift']) delete d[k];
        assert.equal(
          (await patch('/admin/users/24', { ...d, is_active: false }, 'admin'))
            .status,
          200,
        );
        assert.equal((await get('/auth/me', 'unallocated')).status, 401);
      },
    );
    await t.test(
      'database exposes exactly the expected schema objects',
      async () => {
        const inspector = await mysql.createConnection({
          ...config.db,
          user: process.env.DB_ADMIN_USER || config.db.user,
          password: process.env.DB_ADMIN_PASSWORD ?? config.db.password,
        });
        try {
          for (const [table, type, count] of [
            ['tables', "TABLE_TYPE='BASE TABLE'", 13],
            ['tables', "TABLE_TYPE='VIEW'", 4],
            ['triggers', '1=1', 6],
            ['routines', "ROUTINE_TYPE='PROCEDURE'", 5],
          ]) {
            const schemaColumn =
              table === 'triggers'
                ? 'TRIGGER_SCHEMA'
                : table === 'routines'
                  ? 'ROUTINE_SCHEMA'
                  : 'TABLE_SCHEMA';
            const [[{ n }]] = await inspector.query(
              `SELECT COUNT(*) AS n FROM information_schema.${table} WHERE ${schemaColumn}=? AND ${type}`,
              [name],
            );
            assert.equal(n, count);
          }
        } finally {
          await inspector.end();
        }
      },
    );
  } finally {
    if (pool) await pool.end();
    admin = await mysql.createConnection({
      ...config.db,
      database: undefined,
      user: process.env.DB_ADMIN_USER || config.db.user,
      password: process.env.DB_ADMIN_PASSWORD ?? config.db.password,
    });
    // name is generated above, never sourced from a user or environment variable.
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.end();
  }
});
