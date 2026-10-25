import { z } from 'zod';
const text = (max, min = 1) => z.string().trim().min(min).max(max);
const id = z.coerce.number().int().positive();
const optionalText = (max) =>
  z.preprocess((v) => (v === '' ? null : v), text(max).nullable().optional());
export const schemas = {
  login: z.object({
    email: z
      .email()
      .max(120)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(72),
  }),
  complaint: z.object({
    category_id: id,
    title: text(120, 5),
    description: text(5000, 10),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).nullable().optional(),
  }),
  assign: z.object({ staff_id: id }),
  status: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
    remark: text(255, 3),
  }),
  feedback: z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comments: optionalText(500),
  }),
  allocation: z.object({
    student_id: id,
    room_id: id,
    academic_year: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .refine(
        (v) => Number(v.slice(5)) === (Number(v.slice(0, 4)) + 1) % 100,
        'Use consecutive years, e.g. 2026-27',
      ),
  }),
  profile: z.object({
    full_name: text(100, 2),
    phone_no: z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .string()
        .regex(/^[0-9+][0-9]{9,14}$/)
        .nullable()
        .optional(),
    ),
  }),
  password: z.object({
    current_password: z.string().min(1).max(72),
    new_password: z
      .string()
      .min(10)
      .max(72)
      .refine(
        (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v),
        'Include upper/lower case letters and a number',
      ),
  }),
  blocks: z.object({
    block_name: text(30),
    gender_type: z.enum(['MALE', 'FEMALE']),
    total_floors: z.coerce.number().int().min(1).max(20),
    warden_id: z.preprocess(
      (v) => (v === '' || v === null ? null : v),
      id.nullable(),
    ),
    is_active: z.boolean().default(true),
  }),
  types: z.object({
    type_code: text(10).regex(/^[A-Z0-9_]+$/),
    capacity: z.coerce.number().int().min(1).max(6),
    annual_fee: z.coerce.number().min(0).max(99999999.99),
    is_active: z.boolean().default(true),
  }),
  rooms: z.object({
    block_id: id,
    room_number: text(10),
    floor_no: z.coerce.number().int().min(0).max(20),
    type_code: text(10),
    has_ac: z.boolean(),
    status: z.enum(['ACTIVE', 'UNDER_MAINTENANCE']),
    is_active: z.boolean().default(true),
  }),
  categories: z.object({
    category_name: text(40),
    default_priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    sla_hours: z.coerce.number().int().min(1).max(32767),
    is_active: z.boolean().default(true),
  }),
  users: z.object({
    full_name: text(100, 2),
    email: z
      .email()
      .max(120)
      .transform((v) => v.toLowerCase()),
    role: z.enum(['STUDENT', 'WARDEN', 'STAFF', 'ADMIN']),
    password: z.string().min(10).max(72).optional(),
    is_active: z.boolean().default(true),
    phone_no: z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .string()
        .regex(/^[0-9+][0-9]{9,14}$/)
        .nullable()
        .optional(),
    ),
    reg_no: optionalText(15),
    gender: z.enum(['MALE', 'FEMALE']).optional(),
    department: optionalText(60),
    year_of_study: z.coerce.number().int().min(1).max(5).optional(),
    guardian_name: optionalText(100),
    guardian_phone: optionalText(15),
    designation: optionalText(50),
    office_room: optionalText(20),
    category_id: id.optional(),
    block_id: id.optional(),
    shift: z.enum(['MORNING', 'EVENING', 'NIGHT']).optional(),
  }),
};
export function parse(schema, value) {
  return schema.parse(value);
}
export function routeId(value) {
  return id.parse(value);
}
