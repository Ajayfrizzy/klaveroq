import { PASSWORD_MIN_LENGTH } from "../password-policy";

export function PasswordGuidance({ password, id }: { password: string; id: string }) {
  return (
    <small id={id} className="auth-password-guidance">
      Use at least 12 characters, with uppercase and lowercase letters and a number (maximum 128).
      <span role="status">
        {password.length >= PASSWORD_MIN_LENGTH ? " Minimum length met." : ""}
      </span>
    </small>
  );
}
