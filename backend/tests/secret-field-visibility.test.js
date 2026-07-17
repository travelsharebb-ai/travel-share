import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = resolve(process.cwd(), "../frontend/src");

async function source(relativePath) {
  return readFile(resolve(frontendRoot, relativePath), "utf8");
}

describe("password and PIN visibility controls", () => {
  it("uses one accessible reusable control without changing the field value", async () => {
    const component = await source("components/SecretInput.jsx");
    expect(component).toContain('type="button"');
    expect(component).toContain("aria-label={toggleLabel}");
    expect(component).toContain('type={visible ? "text" : "password"}');
    expect(component).toContain("{...inputProps}");
  });

  it.each([
    ["pages/AuthPage.jsx", ["auth-password"]],
    ["pages/ResetPassword.jsx", ["reset-password-new", "reset-password-confirm"]],
    ["pages/Settings.jsx", ["currentPassword", "newPassword", "confirmPassword", "currentPin", "newPin", "confirmPin"]],
    ["pages/GuestMode.jsx", ["guestPasscode", "guestResumePasscode"]],
    ["pages/GuestAccess.jsx", ["guest-access-passcode"]],
    ["pages/GuestPinReset.jsx", ["newPin", "confirmPin"]]
  ])("renders every secret field through SecretInput in %s", async (relativePath, fieldNames) => {
    const page = await source(relativePath);
    expect(page).toContain("SecretInput");
    for (const fieldName of fieldNames) expect(page).toContain(fieldName);
    expect(page).not.toMatch(/type\s*=\s*["']password["']/);
  });
});
