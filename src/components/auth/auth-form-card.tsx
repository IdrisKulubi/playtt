import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthFormCardProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  status?: ReactNode;
}

export function AuthFormCard({
  title,
  description,
  children,
  footer,
  status,
}: AuthFormCardProps) {
  return (
    <Card className="auth-form-card">
      <CardHeader className="space-y-4">
        {status}
        <div className="space-y-2">
          <CardTitle className="text-2xl text-white">{title}</CardTitle>
          <CardDescription className="max-w-lg text-sm leading-6 text-white/62">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t border-white/10 pt-5 text-sm text-white/50">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
