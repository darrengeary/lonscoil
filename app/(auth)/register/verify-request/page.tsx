// app/(auth)/register/verify-request/page.tsx
export default function VerifyRequestPage() {
  return (
    <div className="container flex h-screen w-screen items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p>We’ve sent you a verification link—click it to verify your email.</p>
        <p className="text-sm text-muted-foreground">
          After verifying, you’ll be brought to the login page to sign in with your password.
        </p>
      </div>
    </div>
  );
}