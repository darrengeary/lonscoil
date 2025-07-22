"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Search as SearchIcon, Loader as LoaderIcon, Check as CheckIcon, X as XIcon } from "lucide-react";

type Status = "idle" | "checking" | "valid" | "invalid";

interface Props {
  open: boolean;
  onClose: () => void;
  onClaimed: () => void;
}

export default function AddPupilModal({ open, onClose, onClaimed }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [loading, setLoading] = useState(false);
  const [showName, setShowName] = useState(false);

  async function validateCode() {
    if (!code.trim()) return;
    setStatus("checking");
    try {
      const res = await fetch("/api/pupils/validate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: [code.trim()] }),
      });
      const { valid } = await res.json();
      setStatus(valid ? "valid" : "invalid");
      setShowName(valid);
    } catch {
      setStatus("invalid");
      setShowName(false);
    }
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "valid") return;
    if (!name.trim()) {
      toast({ title: "Please enter a name.", variant: "destructive" });
      return;
    }
    setLoading(true);
    // First claim the pupil
    const claimRes = await fetch("/api/pupils/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes: [code.trim()] }),
    });
    if (claimRes.status === 204) {
      // Then update the name
      await fetch("/api/pupils", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: code.trim(), name }),
      });
      toast({ title: "Pupil claimed and name set!" });
      setCode(""); setName(""); setStatus("idle"); setShowName(false);
      onClaimed?.();
      onClose();
    } else {
      toast({ title: "Could not claim this pupil.", variant: "destructive" });
    }
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form
        onSubmit={handleClaim}
        className="bg-[#fff] p-6 rounded-xl shadow-xl w-full max-w-sm space-y-4"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Claim Pupil
        </h2>
        <div className="flex items-center gap-2">
          <Input
            value={code}
            onChange={e => {
              setCode(e.target.value);
              setStatus("idle");
              setShowName(false);
            }}
            placeholder="Enter pupil code"
            required
            className="flex-1"
            autoFocus
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={validateCode}
            disabled={status === "checking" || !code.trim()}
          >
            {status === "checking" ? (
              <LoaderIcon className="animate-spin size-5" />
            ) : status === "valid" ? (
              <CheckIcon className="size-5 text-green-500" />
            ) : status === "invalid" ? (
              <XIcon className="size-5 text-red-500" />
            ) : (
              <SearchIcon className="size-5" />
            )}
          </Button>
        </div>
        {showName && (
          <div>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Set pupil name"
              required
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={status !== "valid" || !name.trim() || loading}
          >
            {loading ? "Claiming..." : "Claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
