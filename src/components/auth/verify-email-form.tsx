"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { z } from "zod/v3";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import Link from "next/link";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { sendVerificationEmailAction } from "@/actions/auth-actions";

// Define schema for OTP (6 digits)
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
            toast.error(error.message || "Invalid OTP code");
            setIsLoading(false);
            return;
        }

        toast.success("Email verified successfully!");
        router.push("/dashboard");
    }

    // Resend button handler - uses emailOtp.sendVerificationOtp
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
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>Verify Email</CardTitle>
                    <CardDescription>Error: No email provided.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <Link href="/sign-up">Go to Sign Up</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-[400px]">
            <CardHeader>
                <CardTitle>Verify Email</CardTitle>
                <CardDescription>
                    Enter the 6-digit code sent to <strong>{email}</strong>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />}
                            Verify Email
                        </Button>
                    </form>
                </Form>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button
                    variant="link"
                    onClick={handleResend}
                    className="h-auto p-0 text-sm text-muted-foreground"
                    disabled={isLoading}
                >
                    Resend Code
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                    Incorrect email? <Link href="/sign-up" className="underline text-primary">Change email</Link>
                </p>
            </CardFooter>
        </Card>
    );
}
