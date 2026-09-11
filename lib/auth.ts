import crypto from "crypto";

export const DEFAULT_APP_PASSWORD = "1234";

export function getAppPassword(): string {
  const envPassword = process.env.APP_PASSWORD;
  if (typeof envPassword === "string" && envPassword.trim().length > 0) {
    return envPassword.trim();
  }
  return DEFAULT_APP_PASSWORD;
}

export function getExpectedToken(): string {
  const pwd = getAppPassword();
  return crypto
    .createHmac("sha256", "revmarks_auth_secret_key_v1")
    .update(pwd)
    .digest("hex");
}

export function verifyToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  return token === getExpectedToken();
}
