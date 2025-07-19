// lib/validations/register.ts
import * as z from "zod";

export const userRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be 8+ characters"),
  codes: z
    .array(z.string().min(1), {
      required_error: "At least one pupil code is required",
    })
    .min(1)
    .max(5),
});
