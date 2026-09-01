import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const mocks = vi.hoisted(() => ({ createPasswordSession: vi.fn(), createOAuthCodeSession: vi.fn() }));

vi.mock("./aibibu-auth-client", async () => {
	class AibibuAuthError extends Error {
		constructor(
			message: string,
			readonly status: number,
			readonly code = "AIBIBU_AUTH_FAILED",
		) {
			super(message);
		}
	}
	return {
		AibibuAuthError,
		createOAuthCodeSession: mocks.createOAuthCodeSession,
		createPasswordSession: mocks.createPasswordSession,
		createOtpSession: vi.fn(),
		getPreferredAuthMethod: vi.fn(),
		requestEmailOtp: vi.fn(),
		revokeAibibuSession: vi.fn(),
	};
});

import { cookies } from "next/headers";
import { AibibuAuthError } from "./aibibu-auth-client";
import { resetPasswordWithToken, signInWithOAuthCode, signInWithPassword } from "./bff-server";

const setCookie = vi.fn();

describe("Aibibu BFF authentication", () => {
	beforeEach(() => {
		mocks.createPasswordSession.mockReset();
		mocks.createOAuthCodeSession.mockReset();
		setCookie.mockReset();
		vi.mocked(cookies).mockResolvedValue({ set: setCookie } as unknown as Awaited<
			ReturnType<typeof cookies>
		>);
	});

	it("persists password sessions only in HttpOnly cookies", async () => {
		mocks.createPasswordSession.mockResolvedValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			expiresIn: 3600,
		});

		await expect(signInWithPassword("user@example.com", "secret")).resolves.toEqual({ ok: true });
		expect(setCookie).toHaveBeenCalledTimes(2);
		expect(setCookie.mock.calls.every(([, , options]) => options.httpOnly === true)).toBe(true);
	});

	it("maps Supabase credential errors to a stable public error", async () => {
		mocks.createPasswordSession.mockRejectedValue(new AibibuAuthError("upstream detail", 401));

		await expect(signInWithPassword("user@example.com", "bad")).resolves.toEqual({
			ok: false,
			errors: [{ message: "Invalid credentials", code: "INVALID_CREDENTIALS" }],
		});
	});

	it("keeps OAuth tokens server-side after a PKCE code exchange", async () => {
		mocks.createOAuthCodeSession.mockResolvedValue({
			accessToken: "oauth-access-token",
			refreshToken: "oauth-refresh-token",
			expiresIn: 3600,
		});

		await expect(
			signInWithOAuthCode({
				code: "single-use-code",
				codeVerifier: "v".repeat(64),
				clientId: "storefront-client",
				redirectUri: "https://shop.example.test/api/auth/aibibu/callback",
			}),
		).resolves.toEqual({ ok: true });
		expect(setCookie).toHaveBeenCalledTimes(2);
		expect(setCookie.mock.calls.every(([, , options]) => options.httpOnly === true)).toBe(true);
	});

	it("keeps Saleor-native password reset disabled", async () => {
		await expect(resetPasswordWithToken("user@example.com", "token", "new-pass")).resolves.toEqual({
			ok: false,
			errors: [{ message: "Use Aibibu account recovery", code: "AIBIBU_AUTH_REQUIRED" }],
		});
	});
});
