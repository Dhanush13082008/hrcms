CREATE OR REPLACE VIEW v_room_occupancy AS
SELECT r.*, b.block_name,b.gender_type,b.warden_id,b.is_active AS block_active,
 rt.capacity,rt.annual_fee,rt.is_active AS type_active, COUNT(a.allocation_id) AS occupied,
 rt.capacity-COUNT(a.allocation_id) AS vacancies,
 CASE WHEN r.is_active=0 OR b.is_active=0 OR rt.is_active=0 OR r.status='UNDER_MAINTENANCE' THEN 'BLOCKED'
 WHEN COUNT(a.allocation_id)>=rt.capacity THEN 'FULL' ELSE 'AVAILABLE' END AS availability
FROM room r JOIN hostel_block b ON b.block_id=r.block_id JOIN room_type rt ON rt.type_code=r.type_code
LEFT JOIN room_allocation a ON a.room_id=r.room_id AND a.status='ACTIVE'
GROUP BY r.room_id,b.block_id,rt.type_code;

CREATE OR REPLACE VIEW v_complaint_dashboard AS
SELECT c.*,s.reg_no,u.full_name AS student_name,r.room_number,r.block_id,b.block_name,b.warden_id,
 cc.category_name,cc.sla_hours,su.full_name AS staff_name,
 TIMESTAMPDIFF(HOUR,c.created_at,COALESCE(c.resolved_at,NOW())) AS age_hours,
 (c.status IN ('OPEN','ASSIGNED','IN_PROGRESS') AND TIMESTAMPDIFF(HOUR,c.created_at,NOW())>cc.sla_hours) AS is_overdue
FROM complaint c JOIN student s ON s.student_id=c.student_id JOIN users u ON u.user_id=s.student_id
JOIN room r ON r.room_id=c.room_id JOIN hostel_block b ON b.block_id=r.block_id
JOIN complaint_category cc ON cc.category_id=c.category_id LEFT JOIN users su ON su.user_id=c.assigned_staff_id;

CREATE OR REPLACE VIEW v_overdue_complaints AS SELECT * FROM v_complaint_dashboard WHERE is_overdue=1;
CREATE OR REPLACE VIEW v_staff_workload AS
SELECT ms.*,u.full_name,u.email,u.is_active,cc.category_name,b.block_name,b.warden_id,
 COALESCE(SUM(c.status IN ('ASSIGNED','IN_PROGRESS')),0) AS active_jobs,
 COALESCE(SUM(c.status IN ('RESOLVED','CLOSED')),0) AS completed_jobs
FROM maintenance_staff ms JOIN users u ON u.user_id=ms.staff_id
JOIN complaint_category cc ON cc.category_id=ms.category_id JOIN hostel_block b ON b.block_id=ms.block_id
LEFT JOIN complaint c ON c.assigned_staff_id=ms.staff_id GROUP BY ms.staff_id,u.user_id,cc.category_id,b.block_id;

DELIMITER $$
CREATE TRIGGER trg_allocation_before_insert BEFORE INSERT ON room_allocation FOR EACH ROW
BEGIN
 DECLARE v_capacity INT; DECLARE v_occupied INT; DECLARE v_gender VARCHAR(10); DECLARE v_room_gender VARCHAR(10); DECLARE v_available INT;
 SELECT rt.capacity,b.gender_type,(r.status='ACTIVE' AND r.is_active AND b.is_active AND rt.is_active)
 INTO v_capacity,v_room_gender,v_available FROM room r JOIN room_type rt ON rt.type_code=r.type_code JOIN hostel_block b ON b.block_id=r.block_id WHERE r.room_id=NEW.room_id;
 SELECT s.gender INTO v_gender FROM student s JOIN users u ON u.user_id=s.student_id WHERE s.student_id=NEW.student_id AND u.is_active=1 AND u.role='STUDENT';
 SELECT COUNT(*) INTO v_occupied FROM room_allocation WHERE room_id=NEW.room_id AND status='ACTIVE';
 IF NEW.status='ACTIVE' THEN
  IF v_available IS NULL OR v_available=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Room is unavailable or under maintenance'; END IF;
  IF v_gender IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Student account is inactive or invalid'; END IF;
  IF v_gender<>v_room_gender THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Student gender does not match hostel block'; END IF;
  IF v_occupied>=v_capacity THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Room is already full'; END IF;
 END IF;
END$$

CREATE TRIGGER trg_complaint_before_update BEFORE UPDATE ON complaint FOR EACH ROW
BEGIN
 IF NEW.status<>OLD.status THEN
  IF NOT ((OLD.status='OPEN' AND NEW.status IN ('ASSIGNED','REJECTED')) OR
   (OLD.status='ASSIGNED' AND NEW.status IN ('IN_PROGRESS','REJECTED')) OR
   (OLD.status='IN_PROGRESS' AND NEW.status='RESOLVED') OR
   (OLD.status='RESOLVED' AND NEW.status IN ('CLOSED','OPEN'))) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid complaint status transition';
  END IF;
  IF NEW.status='RESOLVED' THEN SET NEW.resolved_at=CURRENT_TIMESTAMP; END IF;
  IF OLD.status='RESOLVED' AND NEW.status='OPEN' THEN SET NEW.resolved_at=NULL; SET NEW.assigned_staff_id=NULL; END IF;
 END IF;
END$$

CREATE TRIGGER trg_complaint_after_insert AFTER INSERT ON complaint FOR EACH ROW
BEGIN
 INSERT INTO complaint_log(complaint_id,new_status,changed_by,remark) VALUES(NEW.complaint_id,NEW.status,@app_user_id,COALESCE(@app_remark,'Complaint submitted'));
END$$
CREATE TRIGGER trg_complaint_after_update AFTER UPDATE ON complaint FOR EACH ROW
BEGIN
 IF NEW.status<>OLD.status OR NOT (NEW.assigned_staff_id<=>OLD.assigned_staff_id) THEN
 INSERT INTO complaint_log(complaint_id,old_status,new_status,changed_by,remark) VALUES(NEW.complaint_id,OLD.status,NEW.status,@app_user_id,@app_remark);
 END IF;
END$$
CREATE TRIGGER trg_feedback_before_insert BEFORE INSERT ON feedback FOR EACH ROW
BEGIN
 DECLARE v_status VARCHAR(15); DECLARE v_student INT;
 SELECT status,student_id INTO v_status,v_student FROM complaint WHERE complaint_id=NEW.complaint_id FOR UPDATE;
 IF v_status IS NULL OR v_status<>'RESOLVED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Feedback allowed only for resolved complaints'; END IF;
 IF @app_user_id IS NULL OR @app_user_id<>v_student THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only the student who raised the complaint can submit feedback'; END IF;
END$$
CREATE TRIGGER trg_feedback_after_insert AFTER INSERT ON feedback FOR EACH ROW
BEGIN
 SET @app_remark='Closed with student feedback';
 UPDATE complaint SET status='CLOSED' WHERE complaint_id=NEW.complaint_id;
END$$

-- Procedures execute inside an API-owned transaction. Locks survive until COMMIT.
CREATE PROCEDURE sp_allocate_room(IN p_student INT, IN p_room INT, IN p_year CHAR(7), IN p_actor INT)
BEGIN
 DECLARE v_room INT; DECLARE v_student INT;
 SELECT room_id INTO v_room FROM room WHERE room_id=p_room FOR UPDATE;
 SELECT student_id INTO v_student FROM student WHERE student_id=p_student FOR UPDATE;
 IF v_room IS NULL OR v_student IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Room or student not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM hostel_block b JOIN room r ON r.block_id=b.block_id JOIN users u ON u.user_id=p_actor
 WHERE r.room_id=p_room AND u.is_active AND (u.role='ADMIN' OR (u.role='WARDEN' AND b.warden_id=p_actor))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='You do not manage this block'; END IF;
 IF EXISTS(SELECT 1 FROM room_allocation WHERE student_id=p_student AND status='ACTIVE') THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Student already has an active room'; END IF;
 INSERT INTO room_allocation(student_id,room_id,academic_year,allocated_on) VALUES(p_student,p_room,p_year,CURRENT_DATE);
 SELECT LAST_INSERT_ID() AS allocation_id;
END$$
CREATE PROCEDURE sp_vacate_room(IN p_allocation INT, IN p_actor INT)
BEGIN
 DECLARE v_room INT; DECLARE v_locked INT;
 SELECT room_id INTO v_room FROM room_allocation WHERE allocation_id=p_allocation;
 SELECT room_id INTO v_locked FROM room WHERE room_id=v_room FOR UPDATE;
 IF v_room IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Allocation not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM hostel_block b JOIN room r ON r.block_id=b.block_id JOIN users u ON u.user_id=p_actor
 WHERE r.room_id=v_room AND u.is_active AND (u.role='ADMIN' OR (u.role='WARDEN' AND b.warden_id=p_actor))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='You do not manage this block'; END IF;
 UPDATE room_allocation SET status='VACATED',vacated_on=CURRENT_DATE WHERE allocation_id=p_allocation AND status='ACTIVE';
 IF ROW_COUNT()=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Allocation is already vacated'; END IF;
END$$
CREATE PROCEDURE sp_raise_complaint(IN p_student INT, IN p_category INT, IN p_title VARCHAR(120), IN p_description TEXT, IN p_priority VARCHAR(10))
BEGIN
 DECLARE v_room INT; DECLARE v_locked INT; DECLARE v_priority VARCHAR(10); DECLARE v_student INT;
 SELECT student_id INTO v_student FROM student WHERE student_id=p_student FOR UPDATE;
 SELECT room_id INTO v_room FROM room_allocation WHERE student_id=p_student AND status='ACTIVE';
 IF v_room IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Student has no allocated room'; END IF;
 SELECT room_id INTO v_locked FROM room WHERE room_id=v_room FOR UPDATE;
 SELECT default_priority INTO v_priority FROM complaint_category WHERE category_id=p_category AND is_active=1;
 IF v_priority IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complaint category is unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM complaint WHERE room_id=v_room AND category_id=p_category AND status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED')) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='An open complaint of this category already exists for this room'; END IF;
 SET @app_user_id=p_student; SET @app_remark='Complaint submitted';
 INSERT INTO complaint(student_id,room_id,category_id,title,description,priority) VALUES(p_student,v_room,p_category,p_title,p_description,COALESCE(p_priority,v_priority));
 SELECT LAST_INSERT_ID() AS complaint_id;
END$$
CREATE PROCEDURE sp_assign_complaint(IN p_complaint INT, IN p_staff INT, IN p_actor INT)
BEGIN
 DECLARE v_status VARCHAR(15); DECLARE v_block INT; DECLARE v_category INT;
 SELECT c.status,r.block_id,c.category_id INTO v_status,v_block,v_category FROM complaint c JOIN room r ON r.room_id=c.room_id WHERE c.complaint_id=p_complaint FOR UPDATE;
 IF v_status IS NULL OR v_status NOT IN ('OPEN','ASSIGNED') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only open or assigned complaints can be assigned'; END IF;
 IF NOT EXISTS(SELECT 1 FROM hostel_block b JOIN users u ON u.user_id=p_actor WHERE b.block_id=v_block AND u.is_active AND (u.role='ADMIN' OR (u.role='WARDEN' AND b.warden_id=p_actor))) THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='You do not manage this block'; END IF;
 IF NOT EXISTS(SELECT 1 FROM maintenance_staff s JOIN users u ON u.user_id=s.staff_id WHERE s.staff_id=p_staff AND s.block_id=v_block AND s.category_id=v_category AND u.is_active=1 AND u.role='STAFF') THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Staff block or specialisation does not match'; END IF;
 SET @app_user_id=p_actor; SET @app_remark='Assigned to maintenance staff';
 UPDATE complaint SET assigned_staff_id=p_staff,status='ASSIGNED' WHERE complaint_id=p_complaint;
END$$
CREATE PROCEDURE sp_update_status(IN p_complaint INT, IN p_status VARCHAR(15), IN p_actor INT, IN p_remark VARCHAR(255))
BEGIN
 DECLARE v_status VARCHAR(15); DECLARE v_student INT; DECLARE v_staff INT; DECLARE v_warden INT; DECLARE v_role VARCHAR(10); DECLARE v_room INT; DECLARE v_category INT; DECLARE v_locked INT;
 SELECT role INTO v_role FROM users WHERE user_id=p_actor AND is_active=1;
 SELECT c.status,c.student_id,c.assigned_staff_id,b.warden_id,c.room_id,c.category_id INTO v_status,v_student,v_staff,v_warden,v_room,v_category
 FROM complaint c JOIN room r ON r.room_id=c.room_id JOIN hostel_block b ON b.block_id=r.block_id WHERE c.complaint_id=p_complaint FOR UPDATE;
 IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complaint not found'; END IF;
 IF p_status='OPEN' AND v_status='RESOLVED' THEN
  IF v_role IS NULL OR v_role<>'STUDENT' OR p_actor<>v_student THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only the complaint owner can reopen it'; END IF;
  SELECT room_id INTO v_locked FROM room WHERE room_id=v_room FOR UPDATE;
  IF EXISTS(SELECT 1 FROM complaint WHERE room_id=v_room AND category_id=v_category AND complaint_id<>p_complaint AND status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another active complaint exists for this room and category'; END IF;
 ELSEIF p_status IN ('IN_PROGRESS','RESOLVED') THEN
  IF v_role IS NULL OR v_role<>'STAFF' OR p_actor<>COALESCE(v_staff,0) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only the assigned staff member can make this change'; END IF;
 ELSEIF p_status='REJECTED' THEN
  IF v_role IS NULL OR NOT (v_role='ADMIN' OR (v_role='WARDEN' AND p_actor=COALESCE(v_warden,0))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='You do not manage this block'; END IF;
 ELSE SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Use assignment or feedback for this status'; END IF;
 IF p_remark IS NULL OR CHAR_LENGTH(TRIM(p_remark))<3 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Please provide a remark of at least 3 characters'; END IF;
 IF p_status=v_status THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complaint already has this status'; END IF;
 SET @app_user_id=p_actor; SET @app_remark=p_remark;
 UPDATE complaint SET status=p_status WHERE complaint_id=p_complaint;
END$$
DELIMITER ;
