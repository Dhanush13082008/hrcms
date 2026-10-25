-- MySQL 8.4. Run against an empty, selected database. Never drops a database.
CREATE TABLE users (
 user_id INT AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(100) NOT NULL,
 email VARCHAR(120) NOT NULL UNIQUE,
 password_hash CHAR(60) NOT NULL,
 role ENUM('STUDENT','WARDEN','STAFF','ADMIN') NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_phone (
 user_id INT NOT NULL, phone_no VARCHAR(15) NOT NULL,
 PRIMARY KEY(user_id,phone_no),
 FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
 CONSTRAINT chk_phone CHECK(phone_no REGEXP '^[0-9+][0-9]{9,14}$')
);
CREATE TABLE warden (
 warden_id INT PRIMARY KEY, designation VARCHAR(50) NOT NULL DEFAULT 'Warden', office_room VARCHAR(20),
 FOREIGN KEY(warden_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE hostel_block (
 block_id INT AUTO_INCREMENT PRIMARY KEY, block_name VARCHAR(30) NOT NULL UNIQUE,
 gender_type ENUM('MALE','FEMALE') NOT NULL, total_floors TINYINT NOT NULL, warden_id INT UNIQUE,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(warden_id) REFERENCES warden(warden_id) ON DELETE SET NULL,
 CONSTRAINT chk_floors CHECK(total_floors BETWEEN 1 AND 20)
);
CREATE TABLE room_type (
 type_code VARCHAR(10) PRIMARY KEY, capacity TINYINT NOT NULL, annual_fee DECIMAL(10,2) NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT chk_capacity CHECK(capacity BETWEEN 1 AND 6), CONSTRAINT chk_fee CHECK(annual_fee >= 0)
);
CREATE TABLE room (
 room_id INT AUTO_INCREMENT PRIMARY KEY, block_id INT NOT NULL, room_number VARCHAR(10) NOT NULL,
 floor_no TINYINT NOT NULL, type_code VARCHAR(10) NOT NULL, has_ac BOOLEAN NOT NULL DEFAULT FALSE,
 status ENUM('ACTIVE','UNDER_MAINTENANCE') NOT NULL DEFAULT 'ACTIVE', is_active BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE KEY uq_room(block_id,room_number),
 FOREIGN KEY(block_id) REFERENCES hostel_block(block_id) ON DELETE CASCADE,
 FOREIGN KEY(type_code) REFERENCES room_type(type_code) ON UPDATE CASCADE,
 CONSTRAINT chk_floor CHECK(floor_no >= 0)
);
CREATE TABLE student (
 student_id INT PRIMARY KEY, reg_no VARCHAR(15) NOT NULL UNIQUE, gender ENUM('MALE','FEMALE') NOT NULL,
 department VARCHAR(60) NOT NULL, year_of_study TINYINT NOT NULL, guardian_name VARCHAR(100), guardian_phone VARCHAR(15),
 FOREIGN KEY(student_id) REFERENCES users(user_id) ON DELETE CASCADE,
 CONSTRAINT chk_year CHECK(year_of_study BETWEEN 1 AND 5)
);
CREATE TABLE complaint_category (
 category_id INT AUTO_INCREMENT PRIMARY KEY, category_name VARCHAR(40) NOT NULL UNIQUE,
 default_priority ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM', sla_hours SMALLINT NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE, CONSTRAINT chk_sla CHECK(sla_hours > 0)
);
CREATE TABLE maintenance_staff (
 staff_id INT PRIMARY KEY, category_id INT NOT NULL, block_id INT NOT NULL,
 shift ENUM('MORNING','EVENING','NIGHT') NOT NULL DEFAULT 'MORNING',
 FOREIGN KEY(staff_id) REFERENCES users(user_id) ON DELETE CASCADE,
 FOREIGN KEY(category_id) REFERENCES complaint_category(category_id),
 FOREIGN KEY(block_id) REFERENCES hostel_block(block_id)
);
CREATE TABLE room_allocation (
 allocation_id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, room_id INT NOT NULL,
 academic_year CHAR(7) NOT NULL, allocated_on DATE NOT NULL, vacated_on DATE,
 status ENUM('ACTIVE','VACATED') NOT NULL DEFAULT 'ACTIVE',
 active_flag TINYINT AS (CASE WHEN status='ACTIVE' THEN 1 ELSE NULL END) STORED,
 UNIQUE KEY uq_one_active_room(student_id,active_flag),
 FOREIGN KEY(student_id) REFERENCES student(student_id) ON DELETE CASCADE,
 FOREIGN KEY(room_id) REFERENCES room(room_id),
 CONSTRAINT chk_dates CHECK(vacated_on IS NULL OR vacated_on >= allocated_on),
 CONSTRAINT chk_academic_year CHECK(academic_year REGEXP '^[0-9]{4}-[0-9]{2}$'),
 INDEX idx_allocation_room(room_id,status)
);
CREATE TABLE complaint (
 complaint_id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, room_id INT NOT NULL, category_id INT NOT NULL,
 title VARCHAR(120) NOT NULL, description TEXT NOT NULL, priority ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL,
 status ENUM('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED') NOT NULL DEFAULT 'OPEN',
 assigned_staff_id INT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, resolved_at TIMESTAMP NULL,
 FOREIGN KEY(student_id) REFERENCES student(student_id), FOREIGN KEY(room_id) REFERENCES room(room_id),
 FOREIGN KEY(category_id) REFERENCES complaint_category(category_id),
 FOREIGN KEY(assigned_staff_id) REFERENCES maintenance_staff(staff_id) ON DELETE SET NULL,
 CONSTRAINT chk_title CHECK(CHAR_LENGTH(title) >= 5),
 INDEX idx_complaint_status(status), INDEX idx_complaint_room(room_id,category_id,status)
);
CREATE TABLE complaint_log (
 log_id INT AUTO_INCREMENT PRIMARY KEY, complaint_id INT NOT NULL, old_status VARCHAR(15), new_status VARCHAR(15) NOT NULL,
 changed_by INT, remark VARCHAR(255), changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(complaint_id) REFERENCES complaint(complaint_id) ON DELETE CASCADE,
 FOREIGN KEY(changed_by) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE TABLE feedback (
 complaint_id INT PRIMARY KEY, rating TINYINT NOT NULL, comments VARCHAR(500), submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(complaint_id) REFERENCES complaint(complaint_id) ON DELETE CASCADE,
 CONSTRAINT chk_rating CHECK(rating BETWEEN 1 AND 5)
);
