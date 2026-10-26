import { Check, Circle } from "lucide-react";

// Must stay in step with assessPasswordStrength in server/middleware/validation.ts
// (8+ characters plus upper, lower, number and special character).
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string, confirmPassword?: string): PasswordRequirement[] {
  const requirements: PasswordRequirement[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "One number (0-9)", met: /\d/.test(password) },
    { label: "One special character (! @ # $ % & * _ - ...)", met: SPECIAL_CHARS.test(password) },
  ];
  if (confirmPassword !== undefined) {
    requirements.push({ label: "Both passwords match", met: password.length > 0 && password === confirmPassword });
  }
  return requirements;
}

interface PasswordRequirementsProps {
  password: string;
  confirmPassword?: string;
}

export default function PasswordRequirements({ password, confirmPassword }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password, confirmPassword);

  return (
    <ul className="space-y-1" aria-label="Password requirements" data-testid="password-requirements">
      {requirements.map((req) => (
        <li
          key={req.label}
          className={`flex items-center gap-2 text-xs ${req.met ? "text-green-600" : "text-gray-500"}`}
        >
          {req.met ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
          <span>{req.label}</span>
        </li>
      ))}
    </ul>
  );
}
