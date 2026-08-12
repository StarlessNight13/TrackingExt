import z from "zod";

const usernamePattern = /^[a-zA-Z0-9_.]+$/;

export function isEmail(value: string) {
  return z.email().safeParse(value).success;
}

export function isValidUsername(value: string) {
  return value.length >= 3 && value.length <= 30 && usernamePattern.test(value);
}

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(usernamePattern, "Username can only contain letters, numbers, underscores, and periods");

export const usernameOrEmailSchema = z
  .string()
  .min(1, "Enter your username or email")
  .superRefine((value, ctx) => {
    if (isEmail(value)) {
      return;
    }

    if (!isValidUsername(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid email or username",
      });
    }
  });
