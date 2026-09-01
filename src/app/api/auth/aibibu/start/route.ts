import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import {
	AIBIBU_OAUTH_STATE_COOKIE,
	AIBIBU_OAUTH_VERIFIER_COOKIE,
	getAibibuOAuthConfig,
	transientOAuthCookieOptions,
} from "@/lib/auth/aibibu-oauth-server";

export function POST() {
	let config;
	try {
		config = getAibibuOAuthConfig();
	} catch {
		return NextResponse.json({ error: "Aibibu login is not configured" }, { status: 503 });
	}

	const state = randomBytes(32).toString("base64url");
	const verifier = randomBytes(64).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	const authorizationUrl = new URL(`${config.issuerUrl}/oauth/authorize`);
	authorizationUrl.searchParams.set("response_type", "code");
	authorizationUrl.searchParams.set("client_id", config.clientId);
	authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
	authorizationUrl.searchParams.set("state", state);
	authorizationUrl.searchParams.set("code_challenge", challenge);
	authorizationUrl.searchParams.set("code_challenge_method", "S256");
	authorizationUrl.searchParams.set("scope", "email profile");

	const response = NextResponse.json({
		authorizationUrl: authorizationUrl.toString(),
		state,
		authOrigin: config.authWebOrigin,
	});
	response.headers.set("Cache-Control", "private, no-store");
	const cookieOptions = transientOAuthCookieOptions();
	response.cookies.set(AIBIBU_OAUTH_STATE_COOKIE, state, cookieOptions);
	response.cookies.set(AIBIBU_OAUTH_VERIFIER_COOKIE, verifier, cookieOptions);
	return response;
}
