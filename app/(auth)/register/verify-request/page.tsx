// app/(auth)/register/verify-request/page.tsx
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inboxLinks = [
  {
    name: "Gmail",
    href: "https://mail.google.com",
    logo: "/icons/gmail.svg",
  },
  {
    name: "Outlook",
    href: "https://outlook.live.com/mail",
    logo: "/icons/outlook.svg",
  },
  {
    name: "Yahoo",
    href: "https://mail.yahoo.com",
    logo: "/icons/yahoo.svg",
  },
  {
    name: "iCloud",
    href: "https://www.icloud.com/mail",
    logo: "/icons/icloud.svg",
  },
];

export default function VerifyRequestPage() {
  return (
    <div className="container flex min-h-screen w-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-8 shadow-sm">

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/lunchlog.png"
            alt="Lunchlog"
            width={140}
            height={40}
            priority
          />
        </div>

        {/* Text */}
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Verify your email
          </h1>

          <p className="text-sm leading-6 text-muted-foreground">
            We’ve sent you a verification email. Click the link inside to
            complete your registration.
          </p>

          <p className="text-sm leading-6 text-muted-foreground">
            Once verified, you can sign in with your email and password.
          </p>
        </div>

        {/* Inbox links */}
        <div className="mt-8 space-y-3">
          <p className="text-center text-sm font-medium">
            Open your inbox
          </p>

          <div className="grid grid-cols-2 gap-3">
            {inboxLinks.map(link => (
              <Link
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border px-4 py-3 hover:bg-muted transition"
              >
                <Image
                  src={link.logo}
                  alt={link.name}
                  width={20}
                  height={20}
                />
                <span className="text-sm font-medium">{link.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Help */}
        <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Didn’t see the email?</p>
          <p className="mt-1">
            Check your spam or junk folder. It can take a minute to arrive.
          </p>
        </div>

        {/* Back */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "rounded-xl")}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}