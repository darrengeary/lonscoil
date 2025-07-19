// app/(auth)/register/verify-request/page.tsx
export default function VerifyRequestPage() {
  return (
    <div className="container flex h-screen w-screen items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p>We’ve sent you a magic link—click it to complete your registration.</p>
      </div>
    </div>
  );
}