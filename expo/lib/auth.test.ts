import { afterEach, expect, spyOn, test } from "bun:test";
import { signInAccount } from "./mediaService";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("sign-in returns the session token and uses the password endpoint", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ access_token: "session-token" }));
  expect(await signInAccount("person@example.com", "password")).toBe("session-token");
  expect(String(request.mock.calls[0][0]).endsWith("/token?grant_type=password")).toBe(true);
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ email: "person@example.com", password: "password" });
});

test("signup requiring email confirmation succeeds without a session", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "new-user", email: "person@example.com", confirmation_sent_at: "2026-10-18T20:00:00Z" }));
  expect(await signInAccount("person@example.com", "password", true)).toBeNull();
  expect(String(request.mock.calls[0][0]).endsWith("/signup")).toBe(true);
});

test("signup with an immediate session returns the token", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ access_token: "new-session", user: { id: "new-user" } }));
  expect(await signInAccount("person@example.com", "password", true)).toBe("new-session");
});

test("sign-in without a token cannot masquerade as email-confirmation success", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "existing-user" }));
  await expect(signInAccount("person@example.com", "password")).rejects.toThrow("incomplete");
});

test("malformed successful signup is rejected", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
  await expect(signInAccount("person@example.com", "password", true)).rejects.toThrow("incomplete");
});

test("rate limits give an actionable error", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}, { status: 429 }));
  await expect(signInAccount("person@example.com", "password")).rejects.toThrow("Too many attempts");
});

test("server failures are not reported as wrong credentials", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}, { status: 503 }));
  await expect(signInAccount("person@example.com", "password")).rejects.toThrow("unavailable");
});

test("invalid or unconfirmed credentials prompt the user to check both", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}, { status: 400 }));
  await expect(signInAccount("person@example.com", "password")).rejects.toThrow("confirm your email");
});

test("network errors propagate for the connection-specific UI message", async () => {
  spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(signInAccount("person@example.com", "password")).rejects.toThrow("Failed to fetch");
});
