// app/(auth)/register/RegisterForm.tsx
"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  ChevronLeft,
  Search as SearchIcon,
  Trash as TrashIcon,
  Loader as LoaderIcon,
  Check as CheckIcon,
  X as XIcon,
} from "lucide-react";

type CodeRow = {
  id: string;
  value: string;
  status: "idle" | "checking" | "valid" | "invalid";
};

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<CodeRow[]>([
    { id: crypto.randomUUID(), value: "", status: "idle" },
  ]);
  const [loading, setLoading] = useState(false);

  function onCodeChange(id: string, value: string) {
    setCodes(prev =>
      prev.map(r => (r.id === id ? { ...r, value, status: "idle" } : r))
    );
    setCodes(prev => {
      const counts = prev.reduce<Record<string, number>>((acc, r) => {
        const key = r.value.trim().toLowerCase();
        if (key) acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return prev.map(r => {
        const key = r.value.trim().toLowerCase();
        return key && counts[key] > 1
          ? { ...r, status: "invalid" }
          : r;
      });
    });
  }

  async function validateCode(row: CodeRow) {
    if (!row.value.trim() || row.status === "invalid") return;
    setCodes(prev =>
      prev.map(r => (r.id === row.id ? { ...r, status: "checking" } : r))
    );
    try {
      const res = await fetch("/api/pupils/validate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: [row.value.trim()] }),
      });
      const { valid } = await res.json();
      setCodes(prev =>
        prev.map(r =>
          r.id === row.id
            ? { ...r, status: valid ? "valid" : "invalid" }
            : r
        )
      );
    } catch {
      setCodes(prev =>
        prev.map(r =>
          r.id === row.id ? { ...r, status: "invalid" } : r
        )
      );
    }
  }

  function addRow() {
    setCodes(prev => [
      ...prev,
      { id: crypto.randomUUID(), value: "", status: "idle" },
    ]);
  }

  function deleteRow(id: string) {
    setCodes(prev => prev.filter(r => r.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validCount = codes.filter(r => r.status === "valid").length;
    if (!email || password.length < 8 || validCount < 1) {
      toast({
        title:
          "Please enter an email, 8+ char password, and confirm at least one code",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    try {
      // 1) Create user + claim pupils
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          codes: codes
            .filter(r => r.status === "valid")
            .map(r => r.value.trim()),
        }),
      });
      const regJson = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regJson.error || "Registration failed");
      }

      // 2) Send the magic link (provider ID "resend"), pointing at /dashboard
      const signInRes = await signIn("resend", {
        email: email.toLowerCase(),
        redirect: false,
        callbackUrl:
          searchParams?.get("from") || `${window.location.origin}/dashboard`,
      });
      if (signInRes?.error) {
        throw new Error(signInRes.error);
      }

      // 3) Show your “Check your email” page
      router.push("/register/verify-request");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const canContinue =
    email.trim().length > 0 &&
    password.length >= 8 &&
    codes.some(r => r.status === "valid") &&
    !codes.some(r => r.status === "checking" || r.status === "invalid");

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "absolute right-4 top-4 md:right-8 md:top-8"
        )}
      >
        <ChevronLeft className="mr-2 size-4" /> Login
      </Link>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] p-6"
      >
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Register
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email, choose a password, and at least one pupil code.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">Your Email</label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Password (8+ characters)
          </label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Create a password"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Pupil Codes</label>
          {codes.map(row => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                value={row.value}
                onChange={e => onCodeChange(row.id, e.target.value)}
                placeholder="Enter code"
                className="flex-1"
                required
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => validateCode(row)}
                disabled={row.status === "checking" || row.status === "valid"}
              >
                {row.status === "checking" ? (
                  <LoaderIcon className="animate-spin size-5" />
                ) : row.status === "valid" ? (
                  <CheckIcon className="size-5 text-green-500" />
                ) : row.status === "invalid" ? (
                  <XIcon className="size-5 text-red-500" />
                ) : (
                  <SearchIcon className="size-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteRow(row.id)}
              >
                <TrashIcon className="size-5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full"
          >
            + Add Another Code
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!canContinue || loading}
        >
          {loading ? "Processing…" : "Continue"}
        </Button>

        <p className="px-8 text-center text-sm text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-brand">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-brand">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
