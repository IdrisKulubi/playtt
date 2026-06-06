import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 characters'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
