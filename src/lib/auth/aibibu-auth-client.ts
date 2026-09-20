import type { AibibuSession } from "./aibibu-session";

export class AibibuAuthError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code = "AIBIBU_AUTH_FAILED",
	) {
		super(message);
	}
}

type AibibuSessionPayload = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
};

function apiUrl(): string {
	const configured = process.env.AIBIBU_API_URL?.trim();
	if (configured) return configured.replace(/\/$/, "");
	if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:12350";
	throw new Error("Missing AIBIBU_API_URL env variable");
}

async function request<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${apiUrl()}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify(body),
			cache: "no-store",
		});
	} catch {
		throw new AibibuAuthError("Aibibu authentication service is unavailable", 503, "UNAVAILABLE");
	}

	if (!response.ok) {
		let detail: { detail?: { message?: string; code?: string } } = {};
		try {
			detail = (await response.json()) as typeof detail;
		} catch {
			// Fall through to the stable public error below.
		}
		throw new AibibuAuthError(
			detail.detail?.message || "Authentication failed",
			response.status,
			detail.detail?.code || "AIBIBU_AUTH_FAILED",
		);
	}

	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

function toSession(payload: AibibuSessionPayload): AibibuSession {
	return {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token,
		expiresIn: payload.expires_in,
	};
}

export async function getPreferredAuthMethod(email: string): Promise<"password" | "otp"> {
	const result = await request<{ method: "password" | "otp" }>("/v1/auth/method", { email });
	return result.method;
}

export async function createPasswordSession(email: string, password: string): Promise<AibibuSession> {
	return toSession(await request<AibibuSessionPayload>("/v1/auth/password", { email, password }));
}

export async function requestEmailOtp(email: string): Promise<void> {
	await request<void>("/v1/auth/otp/request", { email });
}

export async function createOtpSession(email: string, code: string): Promise<AibibuSession> {
	return toSession(await request<AibibuSessionPayload>("/v1/auth/otp/verify", { email, code }));
}

export async function createOAuthCodeSession(input: {
	code: string;
	codeVerifier: string;
	clientId: string;
	redirectUri: string;
}): Promise<AibibuSession> {
	return toSession(
		await request<AibibuSessionPayload>("/v1/auth/oauth/token", {
			code: input.code,
			code_verifier: input.codeVerifier,
			client_id: input.clientId,
			redirect_uri: input.redirectUri,
		}),
	);
}

export async function refreshAibibuSession(refreshToken: string): Promise<AibibuSession> {
	return toSession(await request<AibibuSessionPayload>("/v1/auth/refresh", { refresh_token: refreshToken }));
}

export async function revokeAibibuSession(accessToken: string): Promise<void> {
	await request<void>("/v1/auth/logout", {}, accessToken);
}

export function getAibibuApiUrl(): string {
	return apiUrl();
}
