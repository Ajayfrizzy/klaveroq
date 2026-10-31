// Shared with server validation; never relax this policy in a form.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[\\s\\S]{12,128}";
