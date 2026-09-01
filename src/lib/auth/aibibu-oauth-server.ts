import "server-only";

export const AIBIBU_OAUTH_STATE_COOKIE = "aibibu_store_oauth_state";
export const AIBIBU_OAUTH_VERIFIER_COOKIE = "aibibu_store_oauth_verifier";

export type AibibuOAuthConfig = {
	issuerUrl: string;
	clientId: string;
	redirectUri: string;
	authWebOrigin: string;
};

function absoluteHttpUrl(value: string | undefined, name: string): URL {
	let url: URL;
	try {
		url = new URL(value?.trim() || "");
	} catch {
		throw new Error(`Missing or invalid ${name} env variable`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`Missing or invalid ${name} env variable`);
	}
	return url;
}

export function getAibibuOAuthConfig(): AibibuOAuthConfig {
	const issuer = absoluteHttpUrl(process.env.AIBIBU_OAUTH_ISSUER_URL, "AIBIBU_OAUTH_ISSUER_URL");
	const storefront = absoluteHttpUrl(process.env.NEXT_PUBLIC_STOREFRONT_URL, "NEXT_PUBLIC_STOREFRONT_URL");
	const authWeb = absoluteHttpUrl(process.env.AIBIBU_AUTH_WEB_URL, "AIBIBU_AUTH_WEB_URL");
	const clientId = process.env.AIBIBU_OAUTH_CLIENT_ID?.trim();
	if (!clientId) throw new Error("Missing AIBIBU_OAUTH_CLIENT_ID env variable");

	return {
		issuerUrl: issuer.toString().replace(/\/$/, ""),
		clientId,
		redirectUri: new URL("/api/auth/aibibu/callback", storefront).toString(),
		authWebOrigin: authWeb.origin,
	};
}

export function transientOAuthCookieOptions(): {
	httpOnly: true;
	sameSite: "lax";
	secure: boolean;
	path: string;
	maxAge: number;
} {
	return {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/api/auth/aibibu",
		maxAge: 10 * 60,
	};
}
