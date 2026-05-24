"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v3";
import {
  CircleNotchIcon,
  Eye,
  EyeSlash,
  GoogleLogoIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { AuthFormCard } from "@/components/auth/auth-form-card";
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

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 characters"),
});

export function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setIsLoading(true);
    await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
      },
      {
        onSuccess: (ctx: any) => {
          if (ctx.data.twoFactorRedirect) {
            setShowTwoFactor(true);
            toast.info("Two-factor verification is required.");
          } else {
            router.push("/dashboard");
            toast.success("Signed in successfully.");
          }
          setIsLoading(false);
        },
        onError: (ctx: any) => {
          toast.error(ctx.error.message || "Failed to sign in.");
          setIsLoading(false);
        },
      },
    );
  }

  async function onOTPSubmit(values: z.infer<typeof otpSchema>) {
    setIsLoading(true);
    const { error } = await authClient.twoFactor.verifyOtp({
      code: values.otp,
      trustDevice: true,
    });

    if (error) {
      toast.error(error.message || "Invalid verification code.");
      setIsLoading(false);
      return;
    }

    toast.success("Verification complete.");
    router.push("/dashboard");
    setIsLoading(false);
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/dashboard",
      },
      {
        onSuccess: () => {
          // redirect handled by provider
        },
        onError: (ctx: any) => {
          toast.error(ctx.error.message || "Google sign in failed.");
          setIsLoading(false);
        },
      },
    );
  }

  if (showTwoFactor) {
    return (
      <AuthFormCard
        title="Check your verification code"
        description="Enter the six-digit code from your second factor to continue into PlayTT."
        status={<div className="section-label">Two-factor verification</div>}
        footer={
          <p className="mx-auto text-center">
            Need a different method?{" "}
            <Link href="/sign-in" className="auth-inline-link">
              Return to sign in
            </Link>
          </p>
        }
      >
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="field-cluster">
            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification code</FormLabel>
                  <FormControl>
                    <Input placeholder="123456" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Verify and continue
            </Button>
          </form>
        </Form>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Sign in"
      description="Continue into your account to manage bookings, pricing, and access."
      status={<div className="section-label">Account access</div>}
      footer={
        <p className="mx-auto text-center">
          Need an account?{" "}
          <Link href="/sign-up" className="auth-inline-link">
            Create one
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <Button
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full justify-center"
          type="button"
        >
          <GoogleLogoIcon className="size-4" weight="bold" />
          Continue with Google
        </Button>

        <div className="form-divider">
          <span>Or use email</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="field-cluster">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@theplaytt.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3">
                    <FormLabel>Password</FormLabel>
                    <Link href="/reset-password" className="auth-inline-link text-sm">
                      Forgot password?
                    </Link>
                  </div>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
        </Form>
      </div>
    </AuthFormCard>
  );
}
