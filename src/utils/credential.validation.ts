export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_BLOCKLIST = [
  'tocs',
  'password',
  'admin',
  '123456',
  'qwerty',
] as const;

export interface PasswordValidationContext {
  email?: string;
  companyName?: string;
}

export interface PasswordValidationResult {
  valid: true;
}

export class PasswordValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PasswordValidationError';
    this.code = code;
  }
}

export function normalizePassword(value: string): string {
  return value.normalize('NFC');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCompanyToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validatePassword(
  rawPassword: string,
  context: PasswordValidationContext = {},
): PasswordValidationResult {
  const password = normalizePassword(rawPassword);

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new PasswordValidationError(
      'PASSWORD_TOO_SHORT',
      'Password must be at least 12 characters',
    );
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordValidationError(
      'PASSWORD_TOO_LONG',
      'Password must be at most 128 characters',
    );
  }

  const hasLetters = /\p{L}/u.test(password);
  const hasDigits = /\d/.test(password);
  const hasSymbols = /[^\p{L}\p{N}\s]/u.test(password);
  const categoryCount = [hasLetters, hasDigits, hasSymbols].filter(Boolean).length;

  if (categoryCount < 2) {
    throw new PasswordValidationError(
      'PASSWORD_WEAK',
      'Password must include at least two character categories',
    );
  }

  const lowerPassword = password.toLowerCase();

  if (context.email !== undefined) {
    const normalizedEmail = normalizeEmail(context.email);
    const localPart = normalizedEmail.split('@')[0] ?? '';

    if (
      lowerPassword === normalizedEmail ||
      (localPart.length > 0 && lowerPassword === localPart)
    ) {
      throw new PasswordValidationError(
        'PASSWORD_EMAIL',
        'Password must not match email',
      );
    }
  }

  for (const token of PASSWORD_BLOCKLIST) {
    if (lowerPassword.includes(token)) {
      throw new PasswordValidationError(
        'PASSWORD_BLOCKLIST',
        'Password contains a blocked token',
      );
    }
  }

  if (context.companyName !== undefined && context.companyName.trim() !== '') {
    const normalizedCompany = normalizeCompanyToken(context.companyName);

    if (normalizedCompany.length > 0 && lowerPassword.includes(normalizedCompany)) {
      throw new PasswordValidationError(
        'PASSWORD_COMPANY',
        'Password must not contain company name',
      );
    }
  }

  return { valid: true };
}
