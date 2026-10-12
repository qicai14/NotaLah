import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { BCRYPT_COST, type LoginInfo, passport, signToken } from '../auth/passport';
import { type AuthUser, createUser, findUserByEmail } from '../db/users';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

const required = (label: string) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`);

const registerSchema = z.object({
  displayName: required('Display name').max(50, 'Display name must be at most 50 characters'),
  email: required('Email')
    .toLowerCase()
    .max(255, 'Email must be at most 255 characters')
    .pipe(z.email({ error: 'Invalid email address' })),
  // Not trimmed: spaces are legal password characters.
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes'),
  confirmPassword: z.string({ error: 'Please confirm your password' }).min(1, 'Please confirm your password'),
  programme: required('Programme').max(100, 'Programme must be at most 100 characters'),
  role: z.enum(['student', 'lecturer'], { error: 'Role must be student or lecturer' }),
  staffId: z.string().trim().max(20, 'Staff ID must be at most 20 characters').optional(),
});

authRouter.post('/register', async (req, res) => {
  const body: Record<string, unknown> = req.body && typeof req.body === 'object' ? req.body : {};
  const parsed = registerSchema.safeParse(body);
  const errors: Record<string, string> = {};
  for (const issue of parsed.error?.issues ?? []) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  // Cross-field rules run on the raw body so they are reported alongside per-field errors.
  if (!errors.confirmPassword && body.confirmPassword !== body.password) {
    errors.confirmPassword = 'Passwords do not match';
  }
  if (body.role === 'lecturer' && !errors.staffId && !(typeof body.staffId === 'string' && body.staffId.trim())) {
    errors.staffId = 'Staff ID is required for lecturers';
  }
  if (!parsed.success || Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const d = parsed.data;
  const duplicate = { error: 'This email is already registered' };
  if (await findUserByEmail(d.email)) return res.status(409).json(duplicate);

  const isLecturer = d.role === 'lecturer';
  try {
    const user = await createUser({
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, BCRYPT_COST),
      displayName: d.displayName,
      programme: d.programme,
      role: 'student', // lecturers keep student rights until an admin approves them (D6)
      lecturerStatus: isLecturer ? 'pending' : null,
      staffId: isLecturer ? (d.staffId ?? null) : null,
    });
    return res.status(201).json({ user });
  } catch (err) {
    // Two registrations racing past the check above: the UNIQUE constraint decides.
    if ((err as { code?: string }).code === '23505') return res.status(409).json(duplicate);
    throw err;
  }
});

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts. Try again in a minute.' },
});

authRouter.post('/login', loginLimiter, (req, res, next) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  passport.authenticate('local', { session: false }, (err: unknown, user: AuthUser | false, info?: LoginInfo) => {
    if (err) return next(err);
    if (!user) {
      return res.status(info?.status ?? 401).json({ error: info?.message ?? 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user });
  })(req, res, next);
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
