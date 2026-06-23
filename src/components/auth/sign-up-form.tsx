"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod/v3"
import {
  CircleNotchIcon,
  Eye,
  EyeSlash,
  GoogleLogoIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { sendVerificationEmailAction } from "@/actions/auth-actions"
import { AuthFormCard } from "@/components/auth/auth-form-card"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const signUpSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type AuthCallbackContext = {
  error?: {
    message?: string
  }
}

function getAuthMessage(ctx: AuthCallbackContext, fallback: string) {
  return ctx.error?.message || fallback
}

export function SignUpForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  })

  async function handleGoogleSignIn() {
    setIsLoading(true)
    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/dashboard",
      },
      {
        onSuccess: () => {
          // handled by provider redirect
        },
        onError: (ctx: AuthCallbackContext) => {
          toast.error(getAuthMessage(ctx, "Google sign in failed."))
          setIsLoading(false)
        },
      }
    )
  }

  async function onSubmit(values: z.infer<typeof signUpSchema>) {
    setIsLoading(true)
    await authClient.signUp.email(
      {
        email: values.email,
        password: values.password,
        name: values.name,
      },
      {
        onSuccess: async () => {
          const result = await sendVerificationEmailAction(values.email)

          if (result.success) {
            toast.success(
              "Account created. Check your email for the verification code."
            )
          } else {
            toast.error(result.message)
          }

          router.push(`/verify-email?email=${encodeURIComponent(values.email)}`)
          setIsLoading(false)
        },
        onError: (ctx: AuthCallbackContext) => {
          toast.error(getAuthMessage(ctx, "Failed to sign up."))
          setIsLoading(false)
        },
      }
    )
  }

  return (
    <AuthFormCard
      title="Create your account"
      description="Set up the player identity that bookings, payments, and future access will attach to."
      footer={
        <p className="mx-auto text-center">
          Already have an account?{" "}
          <Link href="/sign-in" className="auth-inline-link">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <Button
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="auth-google-button w-full justify-center"
          type="button"
          data-auth-action
        >
          <GoogleLogoIcon className="size-4" weight="bold" />
          Continue with Google
        </Button>

        <div className="form-divider">
          <span>Or continue with email</span>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="field-cluster auth-signup-grid"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Player name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone number (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+254 700 000 000" {...field} />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1 right-1 rounded-full text-muted-foreground"
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
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1 right-1 rounded-full text-muted-foreground"
                        onClick={() =>
                          setShowConfirmPassword((current) => !current)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeSlash className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {showConfirmPassword
                            ? "Hide password"
                            : "Show password"}
                        </span>
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="auth-submit-button w-full"
              disabled={isLoading}
              data-auth-action
            >
              {isLoading ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : null}
              Create account
            </Button>
          </form>
        </Form>
      </div>
    </AuthFormCard>
  )
}
