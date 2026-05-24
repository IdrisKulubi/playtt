"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v3";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { requestPasswordResetAction } from "@/actions/auth-actions";
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

const requestResetSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export function RequestPasswordResetForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof requestResetSchema>>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof requestResetSchema>) {
    setIsLoading(true);
    const result = await requestPasswordResetAction(values.email);

    if (!result.success) {
      toast.error(result.message);
      setIsLoading(false);
      return;
    }

    toast.success("Password reset email sent. Check your inbox.");
    setIsLoading(false);
  }

  return (
    <AuthFormCard
      title="Recover your account"
      description="Enter the email tied to your PlayTT account and we will send a secure reset link."
      status={<div className="section-label">Password recovery</div>}
      footer={
        <p className="mx-auto text-center">
          Remembered it?{" "}
          <Link href="/sign-in" className="auth-inline-link">
            Back to sign in
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

          <div className="auth-support-note">
            We keep this flow intentionally simple: one trusted address, one secure link, one clear next step.
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            Send reset link
          </Button>
        </form>
      </Form>
    </AuthFormCard>
  );
}
