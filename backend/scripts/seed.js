import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';

export async function seedDatabase(name = config.db.database) {
  const conn = await mysql.createConnection({ ...config.db, database: name });
  await conn.query("SET SESSION time_zone = '+00:00'");
  try {
    const [[{ count }]] = await conn.query(
      'SELECT COUNT(*) AS count FROM users',
    );
    if (count)
      throw new Error(
        'Sample data already exists. Seed stopped without changing it.',
      );
    await conn.beginTransaction();
    const hash = await bcrypt.hash('Hostel@123', 10);
    const people = [
      ['Hostel Administrator', 'admin@hrcms.edu', 'ADMIN'],
      ['Dr. R. Srinivasan', 'warden.a@hrcms.edu', 'WARDEN'],
      ['Dr. K. Prakash', 'warden.b@hrcms.edu', 'WARDEN'],
      ['Dr. S. Kavitha', 'warden.g@hrcms.edu', 'WARDEN'],
      ['Ramesh Kumar', 'ramesh@hrcms.edu', 'STAFF'],
      ['Suresh Menon', 'suresh@hrcms.edu', 'STAFF'],
      ['Kumar Raj', 'kumar@hrcms.edu', 'STAFF'],
      ['Vijay Prakash', 'vijay@hrcms.edu', 'STAFF'],
      ['Murugan Sundar', 'murugan@hrcms.edu', 'STAFF'],
      ['Lakshmi Devi', 'lakshmi@hrcms.edu', 'STAFF'],
      ['Priya Nair', 'priya@hrcms.edu', 'STAFF'],
      ['Selvi Ravi', 'selvi@hrcms.edu', 'STAFF'],
      ['Arjun Reddy', 'arjun@student.edu', 'STUDENT'],
      ['Rohan Sharma', 'rohan@student.edu', 'STUDENT'],
      ['Karthik Kumar', 'karthik@student.edu', 'STUDENT'],
      ['Aditya Verma', 'aditya@student.edu', 'STUDENT'],
      ['Sai Teja', 'sai@student.edu', 'STUDENT'],
      ['Vikram Singh', 'vikram@student.edu', 'STUDENT'],
      ['Pranav Nair', 'pranav@student.edu', 'STUDENT'],
      ['Rahul Das', 'rahul@student.edu', 'STUDENT'],
      ['Ananya Rao', 'ananya@student.edu', 'STUDENT'],
      ['Meera Iyer', 'meera@student.edu', 'STUDENT'],
      ['Divya Menon', 'divya@student.edu', 'STUDENT'],
      ['Harish S', 'harish@student.edu', 'STUDENT'],
    ];
    for (let i = 0; i < people.length; i++) {
      const [full_name, email, role] = people[i];
      await conn.execute(
        'INSERT INTO users(user_id,full_name,email,password_hash,role) VALUES(?,?,?,?,?)',
        [i + 1, full_name, email, hash, role],
      );
      await conn.execute('INSERT INTO user_phone VALUES(?,?)', [
        i + 1,
        String(9000000000 + i + 1),
      ]);
    }
    for (let i = 2; i <= 4; i++)
      await conn.execute('INSERT INTO warden VALUES(?,?,?)', [
        i,
        'Chief Warden',
        `Office ${i - 1}`,
      ]);
    await conn.query(
      "INSERT INTO hostel_block VALUES(1,'A Block','MALE',4,2,1),(2,'B Block','MALE',3,3,1),(3,'G Block','FEMALE',3,4,1)",
    );
    await conn.query(
      "INSERT INTO room_type VALUES('SINGLE',1,95000,1),('DOUBLE',2,75000,1),('TRIPLE',3,60000,1),('QUAD',4,50000,1)",
    );
    const rooms = [
      [1, 1, 'A101', 0, 'DOUBLE', true, 'ACTIVE'],
      [2, 1, 'A102', 0, 'DOUBLE', false, 'ACTIVE'],
      [3, 1, 'A201', 1, 'SINGLE', true, 'ACTIVE'],
      [4, 1, 'A202', 1, 'TRIPLE', false, 'ACTIVE'],
      [5, 1, 'A301', 2, 'QUAD', false, 'ACTIVE'],
      [6, 1, 'A302', 2, 'DOUBLE', false, 'UNDER_MAINTENANCE'],
      [7, 2, 'B101', 0, 'DOUBLE', false, 'ACTIVE'],
      [8, 2, 'B102', 0, 'TRIPLE', false, 'ACTIVE'],
      [9, 2, 'B201', 1, 'QUAD', false, 'ACTIVE'],
      [10, 3, 'G101', 0, 'DOUBLE', true, 'ACTIVE'],
      [11, 3, 'G102', 0, 'TRIPLE', false, 'ACTIVE'],
      [12, 3, 'G201', 1, 'SINGLE', true, 'ACTIVE'],
      [13, 3, 'G202', 1, 'DOUBLE', false, 'ACTIVE'],
    ];
    for (const r of rooms)
      await conn.execute(
        'INSERT INTO room(room_id,block_id,room_number,floor_no,type_code,has_ac,status) VALUES(?,?,?,?,?,?,?)',
        r,
      );
    await conn.query(
      "INSERT INTO complaint_category VALUES(1,'Electrical','HIGH',24,1),(2,'Plumbing','HIGH',24,1),(3,'Carpentry','MEDIUM',72,1),(4,'Housekeeping','LOW',48,1),(5,'Wi-Fi / Network','HIGH',12,1),(6,'Pest control','MEDIUM',48,1)",
    );
    for (const [id, category, block] of [
      [5, 1, 1],
      [6, 2, 1],
      [7, 3, 1],
      [8, 4, 1],
      [9, 5, 2],
      [10, 1, 3],
      [11, 2, 3],
      [12, 4, 3],
    ])
      await conn.execute('INSERT INTO maintenance_staff VALUES(?,?,?,?)', [
        id,
        category,
        block,
        'MORNING',
      ]);
    for (let id = 13; id <= 24; id++)
      await conn.execute('INSERT INTO student VALUES(?,?,?,?,?,?,?)', [
        id,
        `24BCE${1000 + id - 12}`,
        id >= 21 && id <= 23 ? 'FEMALE' : 'MALE',
        [
          'Computer Science',
          'Information Technology',
          'Mechanical Engineering',
        ][(id - 13) % 3],
        2,
        null,
        null,
      ]);
    for (const [student, room] of [
      [13, 1],
      [14, 1],
      [15, 2],
      [16, 3],
      [17, 4],
      [18, 4],
      [19, 5],
      [20, 7],
      [21, 10],
      [22, 10],
      [23, 11],
    ]) {
      const actor = room < 7 ? 2 : room < 10 ? 3 : 4;
      await conn.query('CALL sp_allocate_room(?,?,?,?)', [
        student,
        room,
        '2026-27',
        actor,
      ]);
    }
    await conn.query(
      "INSERT INTO room_allocation(student_id,room_id,academic_year,allocated_on,vacated_on,status) VALUES(24,5,'2025-26','2025-07-01','2026-04-30','VACATED')",
    );
    const complaints = [
      [
        13,
        1,
        'Tube light flickering',
        'The overhead tube light keeps flickering, especially in the evenings. Please check the wiring.',
        'HIGH',
        'ASSIGNED',
        5,
      ],
      [
        15,
        2,
        'Leaking tap in the bathroom',
        'The bathroom tap has been dripping continuously since yesterday.',
        'HIGH',
        'IN_PROGRESS',
        6,
      ],
      [
        16,
        3,
        'Study table drawer is stuck',
        'The lower drawer of my study table is jammed and will not open.',
        'MEDIUM',
        'OPEN',
        null,
      ],
      [
        17,
        3,
        'Cupboard hinge needs repair',
        'The upper hinge on the cupboard door has come loose.',
        'MEDIUM',
        'RESOLVED',
        7,
      ],
      [
        19,
        4,
        'Common area needs cleaning',
        'The corridor outside our room needs a thorough clean.',
        'LOW',
        'CLOSED',
        8,
      ],
      [
        20,
        5,
        'Wi-Fi connection keeps dropping',
        'The hostel network disconnects every few minutes during online classes.',
        'URGENT',
        'OPEN',
        null,
      ],
      [
        21,
        1,
        'Power socket is sparking',
        'The socket near the study desk sparks when a charger is connected.',
        'URGENT',
        'RESOLVED',
        10,
      ],
      [
        23,
        2,
        'Shower pressure is very low',
        'The shower water pressure is much lower than the other bathrooms.',
        'HIGH',
        'IN_PROGRESS',
        11,
      ],
      [
        13,
        2,
        'Water supply timing query',
        'Could you confirm the morning water supply timings?',
        'LOW',
        'REJECTED',
        null,
      ],
      [
        17,
        1,
        'Ceiling fan regulator broken',
        'The ceiling fan only runs at maximum speed regardless of the dial.',
        'MEDIUM',
        'CLOSED',
        5,
      ],
    ];
    for (let index = 0; index < complaints.length; index++) {
      const [student, category, title, description, priority, status, staff] =
        complaints[index];
      const [result] = await conn.query('CALL sp_raise_complaint(?,?,?,?,?)', [
        student,
        category,
        title,
        description,
        priority,
      ]);
      const id = result[0][0].complaint_id;
      const actor = student === 20 ? 3 : student >= 21 ? 4 : 2;
      if (staff)
        await conn.query('CALL sp_assign_complaint(?,?,?)', [id, staff, actor]);
      if (['IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status))
        await conn.query('CALL sp_update_status(?,?,?,?)', [
          id,
          'IN_PROGRESS',
          staff,
          'Work started. Inspecting the reported issue.',
        ]);
      if (['RESOLVED', 'CLOSED'].includes(status))
        await conn.query('CALL sp_update_status(?,?,?,?)', [
          id,
          'RESOLVED',
          staff,
          'Repair completed and checked. Please confirm everything works.',
        ]);
      if (status === 'CLOSED') {
        await conn.query('SET @app_user_id=?', [student]);
        await conn.execute(
          'INSERT INTO feedback(complaint_id,rating,comments) VALUES(?,?,?)',
          [
            id,
            index === 4 ? 5 : 4,
            index === 4 ? 'Quick response. Thank you!' : 'Working well now.',
          ],
        );
      }
      if (status === 'REJECTED')
        await conn.query('CALL sp_update_status(?,?,?,?)', [
          id,
          'REJECTED',
          actor,
          'This is an information request. Supply timings are posted on the notice board.',
        ]);
      const age = [32, 8, 18, 30, 96, 20, 26, 5, 48, 120][index];
      await conn.query(
        'UPDATE complaint SET created_at=DATE_SUB(NOW(),INTERVAL ? HOUR),resolved_at=IF(resolved_at IS NULL,NULL,DATE_SUB(NOW(),INTERVAL ? HOUR)) WHERE complaint_id=?',
        [age, Math.max(0, age - 6), id],
      );
      await conn.query(
        'UPDATE complaint_log SET changed_at=DATE_ADD((SELECT created_at FROM complaint WHERE complaint_id=?), INTERVAL LEAST(log_id,5) MINUTE) WHERE complaint_id=?',
        [id, id],
      );
    }
    await conn.query('SET @app_user_id=NULL,@app_remark=NULL');
    await conn.commit();
    console.log(
      `Seeded ${name}: 24 users, 13 rooms, 12 allotments, 10 complaints. Demo password: Hostel@123`,
    );
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.end();
  }
}
if (process.argv[1]?.endsWith('seed.js'))
  seedDatabase().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
