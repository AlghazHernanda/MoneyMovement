import { z } from 'zod';

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Username 3-30 karakter: huruf, angka, atau underscore');

const password = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter');

export const registerSchema = z.object({
  username,
  email: z.string().trim().toLowerCase().pipe(z.email('Format email tidak valid')),
  phone: z
    .string()
    .trim()
    .regex(/^(\+62|62|0)8[0-9]{7,12}$/, 'Nomor telepon tidak valid (contoh: 081234567890)'),
  password,
});

export const loginSchema = z.object({
  username,
  password: z.string().min(1, 'Password wajib diisi'),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
