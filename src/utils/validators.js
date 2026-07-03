import { z } from 'zod';
import { INSTRUMENTS, STRATEGIES, DIRECTIONS, EMOTIONS, HABIT_CATEGORIES, GRADES } from './constants';

export const tradeSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  instrument: z.enum(INSTRUMENTS),
  strategy: z.enum(STRATEGIES),
  direction: z.enum(DIRECTIONS),
  entryPrice: z.coerce.number().positive('Entry price must be > 0'),
  exitPrice: z.coerce.number().positive('Exit price must be > 0'),
  stopLoss: z.coerce.number().nonnegative().optional(),
  takeProfit: z.coerce.number().nonnegative().optional(),
  positionSize: z.coerce.number().positive('Position size must be > 0'),
  riskAmount: z.coerce.number().nonnegative(),
  pnl: z.coerce.number(),
  holdingTime: z.coerce.number().nonnegative(),
  journal: z.object({
    reasoning: z.string(),
    emotion: z.enum(EMOTIONS),
    processQuality: z.coerce.number().min(1).max(10),
    exitReason: z.string(),
  }),
  lesson: z.string(),
  linkedSkills: z.array(z.string()),
});

export const courseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  institution: z.string(),
  professor: z.string(),
  credits: z.coerce.number().positive('Credits must be > 0'),
  expectedGrade: z.enum(GRADES),
  progressPercent: z.coerce.number().min(0).max(100),
  linkedSkills: z.array(z.string()),
});

export const transactionSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().positive('Amount must be > 0'),
  category: z.string().min(1),
  description: z.string(),
  type: z.enum(['income', 'expense']),
});

export const habitSchema = z.object({
  name: z.string().min(1, 'Habit name is required'),
  category: z.enum(HABIT_CATEGORIES),
  xpReward: z.coerce.number().min(0).max(50),
  linkedSkill: z.string().optional(),
  mandatory: z.boolean().optional(),
});

// Returns { ok, data } or { ok:false, error: firstMessage }
export function validate(schema, values) {
  const res = schema.safeParse(values);
  if (res.success) return { ok: true, data: res.data };
  const issue = res.error.issues[0];
  return { ok: false, error: `${issue.path.join('.')}: ${issue.message}` };
}
