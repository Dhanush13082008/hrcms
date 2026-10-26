-- Cross-table integrity guards for direct SQL mutations.
-- The API still owns authorization; these guards protect stored relationships.
DELIMITER $$

CREATE TRIGGER trg_users_role_immutable
BEFORE UPDATE ON users FOR EACH ROW
BEGIN
 IF NEW.role<>OLD.role THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A user role cannot be changed';
 END IF;
END$$

CREATE TRIGGER trg_student_role_before_insert
BEFORE INSERT ON student FOR EACH ROW
BEGIN
 DECLARE v_role VARCHAR(10);
 SELECT role INTO v_role FROM users WHERE user_id=NEW.student_id;
 IF v_role IS NULL OR v_role<>'STUDENT' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Student record requires a STUDENT user';
 END IF;
END$$

CREATE TRIGGER trg_student_role_before_update
BEFORE UPDATE ON student FOR EACH ROW
BEGIN
 DECLARE v_role VARCHAR(10);
 SELECT role INTO v_role FROM users WHERE user_id=NEW.student_id;
 IF v_role IS NULL OR v_role<>'STUDENT' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Student record requires a STUDENT user';
 END IF;
END$$

CREATE TRIGGER trg_warden_role_before_insert
BEFORE INSERT ON warden FOR EACH ROW
BEGIN
 DECLARE v_role VARCHAR(10);
 SELECT role INTO v_role FROM users WHERE user_id=NEW.warden_id;
 IF v_role IS NULL OR v_role<>'WARDEN' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Warden record requires a WARDEN user';
 END IF;
END$$

CREATE TRIGGER trg_warden_role_before_update
BEFORE UPDATE ON warden FOR EACH ROW
BEGIN
 DECLARE v_role VARCHAR(10);
 SELECT role INTO v_role FROM users WHERE user_id=NEW.warden_id;
 IF v_role IS NULL OR v_role<>'WARDEN' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Warden record requires a WARDEN user';
 END IF;
END$$

CREATE TRIGGER trg_staff_role_before_insert
BEFORE INSERT ON maintenance_staff FOR EACH ROW
BEGIN
 DECLARE v_role VARCHAR(10);
 SELECT role INTO v_role FROM users WHERE user_id=NEW.staff_id;
 IF v_role IS NULL OR v_role<>'STAFF' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Staff record requires a STAFF user';
 END IF;
END$$

CREATE TRIGGER trg_staff_role_before_update
BEFORE UPDATE ON maintenance_staff FOR EACH ROW
BEGIN
 DECLARE v_role VARCHAR(10);
 SELECT role INTO v_role FROM users WHERE user_id=NEW.staff_id;
 IF v_role IS NULL OR v_role<>'STAFF' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Staff record requires a STAFF user';
 END IF;
END$$

CREATE TRIGGER trg_complaint_owner_before_insert
BEFORE INSERT ON complaint FOR EACH ROW
BEGIN
 DECLARE v_active_room INT DEFAULT 0;
 SELECT COUNT(*) INTO v_active_room
 FROM room_allocation a JOIN users u ON u.user_id=a.student_id
 WHERE a.student_id=NEW.student_id AND a.room_id=NEW.room_id
  AND a.status='ACTIVE' AND u.role='STUDENT' AND u.is_active=1;
 IF v_active_room=0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Complaint room must be the active room of its student';
 END IF;
END$$

CREATE TRIGGER trg_complaint_assignment_before_update
BEFORE UPDATE ON complaint FOR EACH ROW FOLLOWS trg_complaint_before_update
BEGIN
 IF NEW.status IN ('ASSIGNED','IN_PROGRESS','RESOLVED') AND NEW.assigned_staff_id IS NULL THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='This complaint status requires assigned staff';
 END IF;
 IF NEW.assigned_staff_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM maintenance_staff ms
  JOIN users u ON u.user_id=ms.staff_id
  JOIN room r ON r.room_id=NEW.room_id
  WHERE ms.staff_id=NEW.assigned_staff_id AND ms.block_id=r.block_id
   AND ms.category_id=NEW.category_id AND u.role='STAFF' AND u.is_active=1
 ) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Assigned staff must be active and match the complaint block and category';
 END IF;
END$$

DELIMITER ;
