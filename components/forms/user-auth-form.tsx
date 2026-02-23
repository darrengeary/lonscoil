"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { cn } from "@/lib/utils";
import { userAuthSchema } from "@/lib/validations/auth";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Icons } from "@/components/shared/icons";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: string; // keep if you use it elsewhere
}

type FormData = z.infer<typeof userAuthSchema>;

export function UserAuthForm({ className, type, ...props }: UserAuthFormProps) {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(userAuthSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);

    try {
      const callbackUrl = searchParams?.get("from") || "/parent/pupils";

      const res = await signIn("credentials", {
        email: data.email.toLowerCase().trim(),
        password: data.password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        // With NextAuth Credentials, this is typically "CredentialsSignin"
        // We show a useful message (could be wrong password OR not verified).
        toast.error("Login failed", {
          description:
            "Check your email/password. If you just registered, verify your email first.",
        });
        return;
      }

      // NextAuth returns a URL to redirect to
      window.location.href = res?.url || callbackUrl;
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              {...register("email")}
            />
            {errors?.email && (
              <p className="px-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors?.password && (
              <p className="px-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button className={cn(buttonVariants())} disabled={isLoading}>
            {isLoading && <Icons.spinner className="mr-2 size-4 animate-spin" />}
            {type === "register" ? "Continue" : "Sign In"}
          </button>
        </div>
      </form>

      {/* Remove 3rd party UI for now */}
      {/* If you want a “Forgot password” later, add it here */}
    </div>
  );
}