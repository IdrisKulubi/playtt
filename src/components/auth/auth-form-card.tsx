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
    <Card className="auth-form-card" data-auth-form>
      <CardHeader className="space-y-4">
        {status}
        <div className="space-y-2">
          <CardTitle className="text-2xl text-foreground">{title}</CardTitle>
          <CardDescription className="max-w-lg text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t border-border pt-5 text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
