"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod/v3";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { sendVerificationEmailAction } from "@/actions/auth-actions";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const verifyEmailSchema = z.object({
  otp: z.string().min(6, "OTP must be 6 digits"),
});

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof verifyEmailSchema>>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      otp: "",
    },
  });

  async function onSubmit(values: z.infer<typeof verifyEmailSchema>) {
    if (!email) {
      toast.error("Email is missing. Please restart sign-up.");
      return;
    }

    setIsLoading(true);

    const { error } = await authClient.emailOtp.verifyEmail({
      email,
      otp: values.otp,
    });

    if (error) {
      toast.error(error.message || "Invalid verification code.");
      setIsLoading(false);
      return;
    }

    toast.success("Email verified successfully.");
    router.push("/dashboard");
  }

  async function handleResend() {
    if (!email) return;

    setIsLoading(true);
    const result = await sendVerificationEmailAction(email);

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.info("Verification code resent.");
    setIsLoading(false);
  }

  if (!email) {
    return (
      <AuthFormCard
        title="Verification link incomplete"
        description="This screen needs the email address from the sign-up flow before we can verify the account."
        footer={
          <p className="mx-auto text-center">
            Start again from{" "}
            <Link href="/sign-up" className="auth-inline-link">
              create account
            </Link>
          </p>
        }
      >
        <Button asChild className="w-full">
          <Link href="/sign-up">Go to sign up</Link>
        </Button>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Verify your email"
      description={
        <>
          Enter the six-digit code sent to <span className="font-medium text-foreground">{email}</span>.
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
          <p className="text-xs text-muted-foreground">
            Wrong email?{" "}
            <Link href="/sign-up" className="auth-inline-link">
              Change it
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
                  <FormControl>
                    <InputOTP
                      maxLength={6}
                      {...field}
                      onChange={(value) => {
                        field.onChange(value);
                        if (value.length === 6) {
                          form.handleSubmit(onSubmit)();
                        }
                      }}
                    >
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

          <div className="auth-support-note text-center">
            Verification completes your account setup and unlocks the booking flow.
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            Verify email
          </Button>
        </form>
      </Form>
    </AuthFormCard>
  );
}
