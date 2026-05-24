"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v3";
import { CircleNotchIcon, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { resetPasswordAction } from "@/actions/auth-actions";
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

const resetPasswordSchema = z
  .object({
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
  const token = searchParams.get("token") ?? "";
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    setIsLoading(true);
    const result = await resetPasswordAction({
      token,
      newPassword: values.password,
    });

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.success("Password reset successfully. You can sign in now.");
    router.push("/sign-in");
  }

  if (!token) {
    return (
      <AuthFormCard
        title="Reset link incomplete"
        description="This screen needs the secure token from your reset email before a new password can be saved."
        status={<div className="section-label">Password reset</div>}
        footer={
          <p className="mx-auto text-center">
            Need a fresh link?{" "}
            <Link href="/reset-password" className="auth-inline-link">
              Request one
            </Link>
          </p>
        }
      >
        <Button asChild className="w-full">
          <Link href="/reset-password">Request a new link</Link>
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Set a new password"
      description="Choose a strong password for your PlayTT account and confirm it once."
      status={<div className="section-label">Secure password update</div>}
      footer={
        <p className="mx-auto text-center">
          Back to{" "}
          <Link href="/sign-in" className="auth-inline-link">
            sign in
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                      className="absolute right-1 top-1 rounded-full text-white/55"
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
                      className="absolute right-1 top-1 rounded-full text-white/55"
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
            Keep the language calm and the action obvious: create a strong password, confirm it, and continue.
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
