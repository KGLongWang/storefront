import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
	AIBIBU_OAUTH_STATE_COOKIE,
	AIBIBU_OAUTH_RETURN_COOKIE,
	AIBIBU_OAUTH_VERIFIER_COOKIE,
	getAibibuOAuthConfig,
	transientOAuthCookieOptions,
} from "@/lib/auth/aibibu-oauth-server";
import { httpStatusForAuthErrors } from "@/lib/auth/auth-api-utils";
import { signInWithOAuthCode } from "@/lib/auth/bff-server";

function statesMatch(actual: string, expected: string): boolean {
	const actualBytes = Buffer.from(actual);
	const expectedBytes = Buffer.from(expected);
	return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function clearTransientCookies(response: NextResponse) {
	const options = { ...transientOAuthCookieOptions(), maxAge: 0 };
	response.cookies.set(AIBIBU_OAUTH_STATE_COOKIE, "", options);
	response.cookies.set(AIBIBU_OAUTH_VERIFIER_COOKIE, "", options);
	response.cookies.set(AIBIBU_OAUTH_RETURN_COOKIE, "", options);
	return response;
}

export async function POST(request: NextRequest) {
	const body = (await request.json().catch(() => null)) as { code?: string; state?: string } | null;
	const cookieStore = await cookies();
	const expectedState = cookieStore.get(AIBIBU_OAUTH_STATE_COOKIE)?.value || "";
	const verifier = cookieStore.get(AIBIBU_OAUTH_VERIFIER_COOKIE)?.value || "";
	const returnTo = cookieStore.get(AIBIBU_OAUTH_RETURN_COOKIE)?.value || "/account";
	if (
		!body?.code ||
		body.code.length > 4096 ||
		!body.state ||
		!expectedState ||
		!verifier ||
		!statesMatch(body.state, expectedState)
	) {
		return clearTransientCookies(
			NextResponse.json({ errors: [{ code: "INVALID_OAUTH_STATE" }] }, { status: 400 }),
		);
	}

	let config;
	try {
		config = getAibibuOAuthConfig();
	} catch {
		return clearTransientCookies(NextResponse.json({ errors: [{ code: "UNAVAILABLE" }] }, { status: 503 }));
	}
	const result = await signInWithOAuthCode({
		code: body.code,
		codeVerifier: verifier,
		clientId: config.clientId,
		redirectUri: config.redirectUri,
	});
	if (!result.ok) {
		return clearTransientCookies(
			NextResponse.json({ errors: result.errors }, { status: httpStatusForAuthErrors(result.errors) }),
		);
	}
	return clearTransientCookies(NextResponse.json({ ok: true, redirectTo: returnTo }));
}
