const usernamePattern = /^[a-zA-Z0-9_.]+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string) {
  return emailPattern.test(value.trim());
}

export function isValidUsername(value: string) {
  return value.length >= 3 && value.length <= 30 && usernamePattern.test(value);
}

export function validateLoginId(value: string, allowEmail: boolean) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your username or email";
  }
  if (allowEmail && isEmail(trimmed)) {
    return null;
  }
  if (isValidUsername(trimmed)) {
    return null;
  }
  return allowEmail ? "Enter a valid email or username" : "Enter a valid username";
}

export function validatePassword(value: string) {
  if (value.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}
