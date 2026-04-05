import { createAuthClient } from "better-auth/react"
import { twoFactorClient, emailOTPClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL:
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.BETTER_AUTH_URL?.trim() ||
        "http://localhost:3000",
    plugins: [
        twoFactorClient(),
        emailOTPClient()
    ]
})
