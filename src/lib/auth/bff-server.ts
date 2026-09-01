import "server-only";

import { cookies } from "next/headers";

import type { AuthApiError } from "./auth-api-types";
import {
	AibibuAuthError,
	createOAuthCodeSession,
	createOtpSession,
	createPasswordSession,
	getPreferredAuthMethod as getAibibuPreferredAuthMethod,
	requestEmailOtp as requestAibibuEmailOtp,
	revokeAibibuSession,
} from "./aibibu-auth-client";
import { clearAibibuSession, persistAibibuSession, readAibibuSession } from "./aibibu-session";

export type { AuthApiError };

function publicAuthError(error: unknown): AuthApiError {
	if (!(error instanceof AibibuAuthError)) {
		return { message: "Authentication service is unavailable", code: "UNAVAILABLE" };
	}
	if (error.status === 429) return { message: "Too many attempts", code: "RATE_LIMITED" };
	if (error.status === 401 || error.status === 403) {
		return { message: "Invalid credentials", code: "INVALID_CREDENTIALS" };
	}
	return { message: "Authentication service is unavailable", code: "UNAVAILABLE" };
}

async function storeSession(session: Parameters<typeof persistAibibuSession>[1]): Promise<void> {
	const cookieStore = await cookies();
	persistAibibuSession(cookieStore, session, { secure: process.env.NODE_ENV === "production" });
}

/** Sign in through Aibibu/Supabase and persist tokens in HttpOnly cookies. */
export async function signInWithPassword(
	email: string,
	password: string,
): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	try {
		await storeSession(await createPasswordSession(email, password));
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: [publicAuthError(error)] };
	}
}

export async function getPreferredAuthMethod(email: string): Promise<"password" | "otp"> {
	return getAibibuPreferredAuthMethod(email);
}

export async function requestSignInOtp(
	email: string,
): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	try {
		await requestAibibuEmailOtp(email);
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: [publicAuthError(error)] };
	}
}

export async function verifySignInOtp(
	email: string,
	code: string,
): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	try {
		await storeSession(await createOtpSession(email, code));
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: [publicAuthError(error)] };
	}
}

export async function signInWithOAuthCode(input: {
	code: string;
	codeVerifier: string;
	clientId: string;
	redirectUri: string;
}): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	try {
		await storeSession(await createOAuthCodeSession(input));
		return { ok: true };
	} catch (error) {
		return { ok: false, errors: [publicAuthError(error)] };
	}
}

/** Saleor-native password reset is intentionally unavailable to customers. */
export async function resetPasswordWithToken(
	_email: string,
	_token: string,
	_password: string,
): Promise<{ ok: true } | { ok: false; errors: AuthApiError[] }> {
	return { ok: false, errors: [{ message: "Use Aibibu account recovery", code: "AIBIBU_AUTH_REQUIRED" }] };
}

/** Revoke the Supabase session best-effort, then always clear local cookies. */
export async function signOutSession(): Promise<void> {
	const cookieStore = await cookies();
	const { accessToken } = readAibibuSession(cookieStore);
	if (accessToken) {
		try {
			await revokeAibibuSession(accessToken);
		} catch {
			// Local logout remains authoritative when the identity service is down.
		}
	}
	clearAibibuSession(cookieStore);
}
