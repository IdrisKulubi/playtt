"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v3";
import { CircleNotchIcon, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  resendPasswordResetOtpAction,
  resetPasswordAction,
} from "@/actions/auth-actions";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const resetPasswordSchema = z
  .object({
    otp: z.string().min(6, "OTP must be 6 digits"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function ResetPasswordConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      otp: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    if (!email) {
      toast.error("Email is missing. Request a new code.");
      return;
    }

    setIsLoading(true);
    const result = await resetPasswordAction({
      email,
      otp: values.otp,
      password: values.password,
    });

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.success("Password reset successfully. You can sign in now.");
    router.push("/sign-in");
  }

  async function handleResend() {
    if (!email) {
      return;
    }

    setIsLoading(true);
    const result = await resendPasswordResetOtpAction(email);

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.info("Reset code resent. Check your inbox.");
    setIsLoading(false);
  }

  if (!email) {
    return (
      <AuthFormCard
        title="Reset code incomplete"
        description="This screen needs the email from the previous step before a new password can be saved."
        footer={
          <p className="mx-auto text-center">
            Need a fresh code?{" "}
            <Link href="/reset-password" className="auth-inline-link">
              Request one
            </Link>
          </p>
        }
      >
        <Button asChild className="w-full">
          <Link href="/reset-password">Request a new code</Link>
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Set a new password"
      description={
        <>
          Enter the six-digit code sent to{" "}
          <span className="font-medium text-foreground">{email}</span> and choose a
          new password.
        </>
      }
      footer={
        <div className="mx-auto flex flex-col items-center gap-2 text-center">
          <Button
            variant="link"
            onClick={handleResend}
            className="h-auto p-0 text-sm text-primary"
            disabled={isLoading}
          >
            Resend code
          </Button>
          <p>
            Back to{" "}
            <Link href="/sign-in" className="auth-inline-link">
              sign in
            </Link>
          </p>
        </div>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex justify-center">
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Reset code</FormLabel>
                  <FormControl>
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage className="mt-3 text-center" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} {...field} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-1 top-1 rounded-full text-muted-foreground"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? (
                        <EyeSlash className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <PasswordStrengthIndicator password={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showConfirmPassword ? "text" : "password"} {...field} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-1 top-1 rounded-full text-muted-foreground"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? (
                        <EyeSlash className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {showConfirmPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="auth-support-note">
            Enter your code, create a strong password, confirm it, and continue.
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            Update password
          </Button>
        </form>
      </Form>
    </AuthFormCard>
  );
}
