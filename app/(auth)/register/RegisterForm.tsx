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

type CodeStatus = "idle" | "checking" | "valid" | "invalid";

type CodeRow = {
  id: string;
  value: string;
  studentName: string;
  allergies: string[];
  status: CodeStatus;
  studentNameTouched: boolean;
};

const ALLERGY_OPTIONS = [
  "Peanuts",
  "Tree Nuts",
  "Milk",
  "Eggs",
  "Wheat",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
  "Other",
];

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [codes, setCodes] = useState<CodeRow[]>([
    {
      id: crypto.randomUUID(),
      value: "",
      studentName: "",
      allergies: [],
      status: "idle",
      studentNameTouched: false,
    },
  ]);
  const [loading, setLoading] = useState(false);

  function onCodeChange(id: string, value: string) {
    setCodes(prev => {
      const next = prev.map(row =>
        row.id === id ? { ...row, value, status: "idle" as CodeStatus } : row
      );

      const counts = next.reduce<Record<string, number>>((acc, row) => {
        const key = row.value.trim().toLowerCase();
        if (key) acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return next.map(row => {
        const key = row.value.trim().toLowerCase();
        return key && counts[key] > 1
          ? { ...row, status: "invalid" as CodeStatus }
          : row;
      });
    });
  }

  function onStudentNameChange(id: string, studentName: string) {
    setCodes(prev =>
      prev.map(row =>
        row.id === id
          ? { ...row, studentName, studentNameTouched: true }
          : row
      )
    );
  }

  function onStudentNameBlur(id: string) {
    setCodes(prev =>
      prev.map(row =>
        row.id === id ? { ...row, studentNameTouched: true } : row
      )
    );
  }

  function toggleAllergy(id: string, allergy: string) {
    setCodes(prev =>
      prev.map(row => {
        if (row.id !== id) return row;

        const exists = row.allergies.includes(allergy);

        return {
          ...row,
          allergies: exists
            ? row.allergies.filter(a => a !== allergy)
            : [...row.allergies, allergy],
        };
      })
    );
  }

  async function validateCode(row: CodeRow) {
    const code = row.value.trim();

    if (!code) {
      toast({
        title: "Code required",
        description: "Please enter a code before validating.",
        variant: "destructive",
      });
      return;
    }

    if (row.status === "invalid") return;

    setCodes(prev =>
      prev.map(r => (r.id === row.id ? { ...r, status: "checking" } : r))
    );

    try {
      const res = await fetch("/api/pupils/validate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: [code] }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Code validation failed");
      }

      const isValid = Boolean(data?.valid);

      setCodes(prev =>
        prev.map(r =>
          r.id === row.id ? { ...r, status: isValid ? "valid" : "invalid" } : r
        )
      );

      if (!isValid) {
        toast({
          title: "Invalid code",
          description: data?.error || "That code is invalid or already claimed.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setCodes(prev =>
        prev.map(r => (r.id === row.id ? { ...r, status: "invalid" } : r))
      );

      toast({
        title: "Code validation failed",
        description: err?.message || "Something went wrong while validating the code.",
        variant: "destructive",
      });
    }
  }

  function addRow() {
    setCodes(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        value: "",
        studentName: "",
        allergies: [],
        status: "idle",
        studentNameTouched: false,
      },
    ]);
  }

  function deleteRow(id: string) {
    setCodes(prev => {
      if (prev.length === 1) return prev;
      return prev.filter(row => row.id !== id);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);

    const cleanEmail = email.toLowerCase().trim();
    const validRows = codes.filter(row => row.status === "valid");
    const hasMissingStudentName = validRows.some(
      row => row.studentName.trim().length === 0
    );

    if (!cleanEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (validRows.length < 1) {
      toast({
        title: "Valid code required",
        description: "Please validate at least one pupil code before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (hasMissingStudentName) {
      toast({
        title: "Student name required",
        description: "Please enter a student name for each validated code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          codes: validRows.map(row => row.value.trim()),
          pupils: validRows.map(row => ({
            code: row.value.trim(),
            studentName: row.studentName.trim(),
            allergies: row.allergies,
          })),
        }),
      });

      const regJson = await regRes.json();

      if (!regRes.ok) {
        throw new Error(regJson?.error || "Registration failed");
      }

      const callbackUrl =
        searchParams?.get("from") || `${window.location.origin}/login?verified=1`;

      const signInRes = await signIn("resend", {
        email: cleanEmail,
        redirect: false,
        callbackUrl,
      });

      if (signInRes?.error) {
        throw new Error(signInRes.error);
      }

      router.push("/register/verify-request");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const validRows = codes.filter(row => row.status === "valid");
  const hasMissingStudentName = validRows.some(
    row => row.studentName.trim().length === 0
  );

  const canContinue =
    email.trim().length > 0 &&
    password.length >= 8 &&
    validRows.length > 0 &&
    !hasMissingStudentName &&
    !codes.some(row => row.status === "checking");

  return (
    <div className="container flex min-h-screen w-screen flex-col items-center justify-center py-8">
      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "absolute right-4 top-4 md:right-8 md:top-8"
        )}
      >
        <ChevronLeft className="mr-2 size-4" />
        Login
      </Link>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full flex-col justify-center space-y-6 p-6 sm:w-[620px]"
      >
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email, choose a password, and validate at least one pupil code.
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
          <label className="block text-sm font-medium">Password (8+ characters)</label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Create a password"
            required
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Pupil Codes</label>

          {codes.map(row => {
            const showStudentFields = row.status === "valid";
            const showStudentNameError =
              row.status === "valid" &&
              row.studentName.trim().length === 0 &&
              (row.studentNameTouched || submitAttempted);

            return (
              <div key={row.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={row.value}
                    onChange={e => onCodeChange(row.id, e.target.value)}
                    placeholder="Enter code"
                    className="flex-1"
                    required
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => validateCode(row)}
                    disabled={
                      !row.value.trim() ||
                      row.status === "checking" ||
                      row.status === "valid"
                    }
                  >
                    {row.status === "checking" ? (
                      <LoaderIcon className="size-5 animate-spin" />
                    ) : row.status === "valid" ? (
                      <CheckIcon className="size-5 text-green-500" />
                    ) : row.status === "invalid" ? (
                      <XIcon className="size-5 text-red-500" />
                    ) : (
                      <SearchIcon className="size-5" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(row.id)}
                    disabled={codes.length === 1}
                  >
                    <TrashIcon className="size-5" />
                  </Button>
                </div>

                {row.status === "invalid" && row.value.trim().length > 0 && (
                  <p className="text-sm text-red-500">Invalid or duplicate code.</p>
                )}

                {showStudentFields && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium">Student Name</label>
                      <Input
                        value={row.studentName}
                        onChange={e => onStudentNameChange(row.id, e.target.value)}
                        onBlur={() => onStudentNameBlur(row.id)}
                        placeholder="Enter student name"
                        required
                      />
                      {showStudentNameError && (
                        <p className="text-xs text-red-500">Student name is required.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium">
                        Allergies
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ALLERGY_OPTIONS.map(option => {
                          const selected = row.allergies.includes(option);

                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => toggleAllergy(row.id, option)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              )}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>

                      {row.allergies.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {row.allergies.map(allergy => (
                            <span
                              key={allergy}
                              className="rounded-full bg-muted px-3 py-1 text-xs"
                            >
                              {allergy}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Click to add or remove allergies.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

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

        <Button type="submit" className="w-full" disabled={!canContinue || loading}>
          {loading ? "Processing…" : "Continue"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Student name is required for each validated code.
        </p>

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