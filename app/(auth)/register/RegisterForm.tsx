"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Search,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  User,
  Mail,
  Lock,
  Plus,
  Trash2,
  ShieldCheck,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

type Step = "code" | "details";
type CodeStatus = "idle" | "checking" | "valid" | "invalid";

type PupilEntry = {
  id: string;
  code: string;
  pupilName: string;
  allergies: string[];
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("code");

  const [firstCode, setFirstCode] = useState("");
  const [firstCodeStatus, setFirstCodeStatus] = useState<CodeStatus>("idle");
  const [firstCodeLoading, setFirstCodeLoading] = useState(false);

  const [extraCode, setExtraCode] = useState("");
  const [extraCodeStatus, setExtraCodeStatus] = useState<CodeStatus>("idle");
  const [extraCodeLoading, setExtraCodeLoading] = useState(false);

  const [validatedPupils, setValidatedPupils] = useState<PupilEntry[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();
  const passwordTooShort = password.length > 0 && password.length < 6;

  const duplicateCodes = useMemo(() => {
    const counts = validatedPupils.reduce<Record<string, number>>((acc, pupil) => {
      const key = pupil.code.trim().toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.values(counts).some((count) => count > 1);
  }, [validatedPupils]);

  const hasMissingPupilName = validatedPupils.some(
    (pupil) => pupil.pupilName.trim().length === 0
  );

  async function validateCodeValue(code: string) {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      throw new Error("Please enter a pupil code.");
    }

    const alreadyAdded = validatedPupils.some(
      (pupil) => pupil.code.trim().toLowerCase() === trimmedCode.toLowerCase()
    );

    if (alreadyAdded) {
      throw new Error("That pupil code has already been added.");
    }

    const res = await fetch("/api/pupils/validate-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes: [trimmedCode] }),
    });

    const data = await parseJsonSafe(res);

    if (!res.ok) {
      throw new Error(data?.error || "Unable to validate pupil code.");
    }

    if (!data?.valid) {
      throw new Error(
        data?.error || "That code is invalid or has already been claimed."
      );
    }

    return trimmedCode;
  }

  async function handleValidateFirstCode() {
    if (!firstCode.trim()) {
      toast({
        title: "Pupil code required",
        description: "Please enter a pupil code before continuing.",
        variant: "destructive",
      });
      return;
    }

    setFirstCodeLoading(true);
    setFirstCodeStatus("checking");

    try {
      const validCode = await validateCodeValue(firstCode);

      setValidatedPupils([
        {
          id: makeId(),
          code: validCode,
          pupilName: "",
          allergies: [],
        },
      ]);

      setFirstCodeStatus("valid");

      toast({
        title: "Code accepted",
        description: "Now enter your details and the pupil information.",
      });

      setTimeout(() => {
        setStep("details");
      }, 280);
    } catch (error) {
      setFirstCodeStatus("invalid");
      toast({
        title: "Invalid pupil code",
        description: getErrorMessage(
          error,
          "Something went wrong while validating the code."
        ),
        variant: "destructive",
      });
    } finally {
      setFirstCodeLoading(false);
    }
  }

  async function handleAddAnotherCode() {
    if (!extraCode.trim()) {
      toast({
        title: "Pupil code required",
        description: "Enter another pupil code before adding it.",
        variant: "destructive",
      });
      return;
    }

    if (validatedPupils.length >= 5) {
      toast({
        title: "Too many pupil codes",
        description: "You can add up to 5 pupil codes.",
        variant: "destructive",
      });
      return;
    }

    setExtraCodeLoading(true);
    setExtraCodeStatus("checking");

    try {
      const validCode = await validateCodeValue(extraCode);

      setValidatedPupils((prev) => [
        ...prev,
        {
          id: makeId(),
          code: validCode,
          pupilName: "",
          allergies: [],
        },
      ]);

      setExtraCode("");
      setExtraCodeStatus("valid");

      toast({
        title: "Pupil added",
        description: "You can now enter this pupil's details.",
      });

      setTimeout(() => {
        setExtraCodeStatus("idle");
      }, 600);
    } catch (error) {
      setExtraCodeStatus("invalid");
      toast({
        title: "Could not add code",
        description: getErrorMessage(
          error,
          "Something went wrong while adding the pupil code."
        ),
        variant: "destructive",
      });
    } finally {
      setExtraCodeLoading(false);
    }
  }

  function handleBackToCode() {
    setStep("code");
    setFirstCodeStatus("idle");
    setValidatedPupils([]);
  }

  function updatePupilName(id: string, value: string) {
    setValidatedPupils((prev) =>
      prev.map((pupil) =>
        pupil.id === id ? { ...pupil, pupilName: value } : pupil
      )
    );
  }

  function toggleAllergy(id: string, allergy: string) {
    setValidatedPupils((prev) =>
      prev.map((pupil) => {
        if (pupil.id !== id) return pupil;

        const exists = pupil.allergies.includes(allergy);

        return {
          ...pupil,
          allergies: exists
            ? pupil.allergies.filter((a) => a !== allergy)
            : [...pupil.allergies, allergy],
        };
      })
    );
  }

  function removePupil(id: string) {
    setValidatedPupils((prev) => prev.filter((pupil) => pupil.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);

    if (validatedPupils.length < 1) {
      toast({
        title: "Pupil code required",
        description: "Please add at least one valid pupil code.",
        variant: "destructive",
      });
      return;
    }

    if (duplicateCodes) {
      toast({
        title: "Duplicate pupil codes",
        description: "Each pupil code can only be used once in this form.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    if (!cleanEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Please use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (hasMissingPupilName) {
      toast({
        title: "Pupil name required",
        description: "Please enter a pupil name for each validated code.",
        variant: "destructive",
      });
      return;
    }

    setSubmitLoading(true);

    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: cleanEmail,
          password,
          codes: validatedPupils.map((pupil) => pupil.code.trim()),
          pupils: validatedPupils.map((pupil) => ({
            code: pupil.code.trim(),
            pupilName: pupil.pupilName.trim(),
            allergies: pupil.allergies,
          })),
        }),
      });

      const regJson = await parseJsonSafe(regRes);

      if (!regRes.ok) {
        throw new Error(regJson?.error || "Registration failed.");
      }

      const callbackUrl =
        searchParams?.get("from") ||
        `${window.location.origin}/login?verified=1`;

      const signInRes = await signIn("resend", {
        email: cleanEmail,
        redirect: false,
        callbackUrl,
      });

      if (!signInRes) {
        throw new Error("Account created, but email sign-in could not be started.");
      }

      if (signInRes.error) {
        throw new Error(signInRes.error);
      }

      toast({
        title: "Registration complete",
        description: "Check your email for your sign-in link.",
      });

      router.push("/register/verify-request");
    } catch (error) {
      toast({
        title: "Registration failed",
        description: getErrorMessage(
          error,
          "Something went wrong while creating the account."
        ),
        variant: "destructive",
      });
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.06),transparent_25%)]" />

      <Link
        href="/login"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "absolute right-4 top-4 border-slate-200 bg-white md:right-8 md:top-8"
        )}
      >
        <ChevronLeft className="mr-2 size-4" />
        Login
      </Link>

      <div className="container flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 px-6 py-7 text-white sm:px-8">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
                  <Image
                    src="/lunchlog.png"
                    alt="Lunchlog"
                    width={56}
                    height={56}
                    className="h-14 w-14 object-contain"
                    priority
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Create your account
                  </h1>
                  <p className="mt-1 text-sm text-sky-50/90">
                    Quick parent registration for Lunchlog
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <AnimatePresence mode="wait" initial={false}>
                {step === "code" ? (
                  <motion.div
                    key="code-step"
                    initial={{ opacity: 0, y: 12, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -24, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2 text-sky-800">
                        <ShieldCheck className="size-4" />
                        <span className="text-sm font-medium">
                          Step 1 of 2 — validate your first pupil code
                        </span>
                      </div>

                      <label className="mb-2 block text-sm font-semibold text-slate-800">
                        Pupil code
                      </label>

                      <div className="flex gap-2">
                        <Input
                          value={firstCode}
                          onChange={(e) => {
                            setFirstCode(e.target.value);
                            if (firstCodeStatus !== "idle") setFirstCodeStatus("idle");
                          }}
                          placeholder="Enter pupil code"
                          className="h-12 border-slate-200 bg-white text-base"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleValidateFirstCode();
                            }
                          }}
                        />

                        <Button
                          type="button"
                          onClick={handleValidateFirstCode}
                          disabled={!firstCode.trim() || firstCodeLoading}
                          className="h-12 bg-sky-600 text-white hover:bg-sky-700"
                        >
                          {firstCodeLoading ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : firstCodeStatus === "valid" ? (
                            <CheckCircle2 className="size-5" />
                          ) : (
                            <Search className="size-5" />
                          )}
                        </Button>
                      </div>

                      <AnimatePresence initial={false}>
                        {firstCodeStatus === "invalid" && (
                          <motion.p
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="mt-3 text-sm text-red-600"
                          >
                            Invalid or already claimed code.
                          </motion.p>
                        )}

                        {firstCodeStatus === "valid" && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                          >
                            Code accepted — opening registration form…
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Start with one code. You can add more pupils on the next step.
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="details-step"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 28, scale: 0.985 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Validated pupils
                        </p>
                        <p className="text-sm font-semibold text-emerald-900">
                          {validatedPupils.length} added
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBackToCode}
                        className="border-emerald-200 bg-white"
                      >
                        <ArrowLeft className="mr-2 size-4" />
                        Start over
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h2 className="text-base font-semibold text-slate-900">
                        Parent details
                      </h2>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800">
                            Name
                          </label>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Your name"
                              className="h-11 border-slate-200 bg-white pl-10"
                            />
                          </div>
                          {submitAttempted && !name.trim() && (
                            <p className="text-xs text-red-600">Name is required.</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800">
                            Email
                          </label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@example.com"
                              className="h-11 border-slate-200 bg-white pl-10"
                            />
                          </div>
                          {submitAttempted && !cleanEmail && (
                            <p className="text-xs text-red-600">Email is required.</p>
                          )}
                          {submitAttempted &&
                            cleanEmail.length > 0 &&
                            !isValidEmail(cleanEmail) && (
                              <p className="text-xs text-red-600">
                                Please enter a valid email address.
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="h-11 border-slate-200 bg-white pl-10"
                          />
                        </div>

                        {passwordTooShort && !(submitAttempted && password.length < 6) && (
                          <p className="text-xs text-slate-500">
                            Use at least 6 characters.
                          </p>
                        )}

                        {submitAttempted && password.length < 6 && (
                          <p className="text-xs text-red-600">
                            Password must be at least 6 characters.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            Pupils
                          </h2>
                          <p className="text-sm text-slate-500">
                            Add up to 5 pupil codes.
                          </p>
                        </div>
                      </div>

                      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={extraCode}
                          onChange={(e) => {
                            setExtraCode(e.target.value);
                            if (extraCodeStatus !== "idle") setExtraCodeStatus("idle");
                          }}
                          placeholder="Add another pupil code"
                          className="h-11 border-slate-200 bg-white"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddAnotherCode();
                            }
                          }}
                        />

                        <Button
                          type="button"
                          onClick={handleAddAnotherCode}
                          disabled={extraCodeLoading || validatedPupils.length >= 5}
                          className="h-11 bg-sky-600 text-white hover:bg-sky-700"
                        >
                          {extraCodeLoading ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 size-4" />
                          )}
                          Add code
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <AnimatePresence initial={false}>
                          {validatedPupils.map((pupil, index) => (
                            <motion.div
                              key={pupil.id}
                              initial={{ opacity: 0, y: 10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.98 }}
                              transition={{ duration: 0.2 }}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                                    Pupil {index + 1}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">
                                    Code: {pupil.code}
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removePupil(pupil.id)}
                                  className="border-slate-200 bg-white"
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Remove
                                </Button>
                              </div>

                              <div className="space-y-4">
                                <div className="space-y-1.5">
                                  <label className="text-sm font-semibold text-slate-800">
                                    Pupil name
                                  </label>
                                  <div className="relative">
                                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                      value={pupil.pupilName}
                                      onChange={(e) =>
                                        updatePupilName(pupil.id, e.target.value)
                                      }
                                      placeholder="Pupil name"
                                      className="h-11 border-slate-200 bg-white pl-10"
                                    />
                                  </div>
                                  {submitAttempted && !pupil.pupilName.trim() && (
                                    <p className="text-xs text-red-600">
                                      Pupil name is required.
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <label className="text-sm font-semibold text-slate-800">
                                    Allergies
                                  </label>

                                  <div className="flex flex-wrap gap-2">
                                    {ALLERGY_OPTIONS.map((option) => {
                                      const selected = pupil.allergies.includes(option);

                                      return (
                                        <button
                                          key={option}
                                          type="button"
                                          onClick={() => toggleAllergy(pupil.id, option)}
                                          className={cn(
                                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                            selected
                                              ? "border-indigo-600 bg-indigo-600 text-white"
                                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                          )}
                                        >
                                          {option}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {pupil.allergies.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {pupil.allergies.map((allergy) => (
                                        <span
                                          key={allergy}
                                          className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-900"
                                        >
                                          {allergy}
                                          <button
                                            type="button"
                                            onClick={() => toggleAllergy(pupil.id, allergy)}
                                            className="rounded-full"
                                            aria-label={`Remove ${allergy}`}
                                          >
                                            <X className="size-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <p className="text-xs text-slate-500">
                                    Click to add or remove allergies.
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitLoading}
                      className="h-12 w-full bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      {submitLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Creating account…
                        </>
                      ) : (
                        `Continue with ${validatedPupils.length} pupil${
                          validatedPupils.length === 1 ? "" : "s"
                        }`
                      )}
                    </Button>

                    <p className="text-center text-sm text-slate-500">
                      By continuing, you agree to our{" "}
                      <Link href="/terms" className="font-medium underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="font-medium underline">
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}