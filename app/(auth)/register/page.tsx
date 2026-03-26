// app/(auth)/register/page.tsx
import RegisterForm from "./RegisterForm";

export const metadata = {
  title: "Register",
  description: "Register and claim lunches.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
