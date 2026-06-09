import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 characters'),
});

export const verifyEmailSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 characters'),
});

export const requestResetSchema = z.object({
  email: z.email('Enter a valid email address'),
});

export const resetPasswordOtpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type RequestResetValues = z.infer<typeof requestResetSchema>;
export type ResetPasswordOtpValues = z.infer<typeof resetPasswordOtpSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
