import { type NextRequest, NextResponse } from "next/server";
import { DefaultChannelSlug } from "@/app/config";
import { getStaticStorefrontChannelSlugs, isAllowedStorefrontChannel } from "@/config/channels";
import { getDefaultLocaleSlug, isLocaleSlug, isStorefrontLocaleSlug } from "@/config/locale";
import { BROWSE_LOCALE_COOKIE, getBrowseLocaleCookieOptions } from "@/lib/browse-locale";
import { buildStorefrontPath } from "@/lib/storefront-path";
import { refreshAibibuSession } from "@/lib/auth/aibibu-auth-client";
import { AIBIBU_ACCESS_COOKIE, AIBIBU_REFRESH_COOKIE, persistAibibuSession } from "@/lib/auth/aibibu-session";

const RESERVED_ROOT_SEGMENTS = new Set([
	"api",
	"checkout",
	"_next",
	"favicon.ico",
	"robots.txt",
	"sitemap.xml",
]);

function isChannelSlug(segment: string): boolean {
	const allowed = getStaticStorefrontChannelSlugs();
	return isAllowedStorefrontChannel(segment, allowed);
}

function withBrowseLocaleCookie(request: NextRequest, response: NextResponse, locale: string): NextResponse {
	if (!isStorefrontLocaleSlug(locale)) {
		return response;
	}

	// Skip Set-Cookie when the value is already correct — re-setting on every HTML response
	// marks responses as uncacheable at shared CDNs even when nothing changed.
	const current = request.cookies.get(BROWSE_LOCALE_COOKIE)?.value;
	if (current === locale) {
		return response;
	}

	response.cookies.set(BROWSE_LOCALE_COOKIE, locale, getBrowseLocaleCookieOptions());
	return response;
}

function accessTokenExpiresSoon(token: string | undefined): boolean {
	if (!token) return true;
	try {
		const payload = token.split(".")[1];
		if (!payload) return true;
		const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
		const decoded = JSON.parse(atob(padded)) as { exp?: number };
		return typeof decoded.exp !== "number" || decoded.exp <= Math.floor(Date.now() / 1000) + 300;
	} catch {
		return true;
	}
}

async function withAibibuSessionRefresh(request: NextRequest, response: NextResponse): Promise<NextResponse> {
	const refreshToken = request.cookies.get(AIBIBU_REFRESH_COOKIE)?.value;
	const accessToken = request.cookies.get(AIBIBU_ACCESS_COOKIE)?.value;
	if (!refreshToken || !accessTokenExpiresSoon(accessToken)) return response;

	try {
		const session = await refreshAibibuSession(refreshToken);
		persistAibibuSession(response.cookies, session, { secure: process.env.NODE_ENV === "production" });
	} catch {
		// Keep the current cookies on transient failures; authenticated routes still validate upstream.
	}
	return response;
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.includes(".") // static files
	) {
		return NextResponse.next();
	}

	const segments = pathname.split("/").filter(Boolean);
	const defaultLocale = getDefaultLocaleSlug();
	const defaultChannel = DefaultChannelSlug ?? getStaticStorefrontChannelSlugs()[0];

	// Root → default browse home
	if (segments.length === 0) {
		if (!defaultChannel) {
			return withAibibuSessionRefresh(request, NextResponse.next());
		}
		const url = request.nextUrl.clone();
		url.pathname = buildStorefrontPath(defaultLocale, defaultChannel);
		return withAibibuSessionRefresh(
			request,
			withBrowseLocaleCookie(request, NextResponse.redirect(url, 308), defaultLocale),
		);
	}

	const [first, second, ...rest] = segments;

	if (RESERVED_ROOT_SEGMENTS.has(first)) {
		return NextResponse.next();
	}

	// Disabled locale slug (defined but not in NEXT_PUBLIC_STOREFRONT_LOCALES) → canonical default locale
	if (isLocaleSlug(first) && !isStorefrontLocaleSlug(first)) {
		if (second && isChannelSlug(second)) {
			const url = request.nextUrl.clone();
			const suffix = rest.length > 0 ? `/${rest.join("/")}` : "";
			url.pathname = buildStorefrontPath(defaultLocale, second, suffix);
			return withAibibuSessionRefresh(
				request,
				withBrowseLocaleCookie(request, NextResponse.redirect(url, 308), defaultLocale),
			);
		}
		return withAibibuSessionRefresh(request, NextResponse.next());
	}

	// Canonical format: /{locale}/{channel}/…
	if (isStorefrontLocaleSlug(first)) {
		if (second && isChannelSlug(second)) {
			return withAibibuSessionRefresh(request, withBrowseLocaleCookie(request, NextResponse.next(), first));
		}

		// /{locale} only → add default channel
		if (!second && defaultChannel) {
			const url = request.nextUrl.clone();
			url.pathname = buildStorefrontPath(first, defaultChannel);
			return withAibibuSessionRefresh(
				request,
				withBrowseLocaleCookie(request, NextResponse.redirect(url, 308), first),
			);
		}

		return withAibibuSessionRefresh(request, NextResponse.next());
	}

	// Legacy: /{channel}/… → /{defaultLocale}/{channel}/…
	if (isChannelSlug(first)) {
		const url = request.nextUrl.clone();
		const suffix = [second, ...rest].filter(Boolean).join("/");
		url.pathname = buildStorefrontPath(defaultLocale, first, suffix ? `/${suffix}` : "");
		return withAibibuSessionRefresh(
			request,
			withBrowseLocaleCookie(request, NextResponse.redirect(url, 308), defaultLocale),
		);
	}

	return withAibibuSessionRefresh(request, NextResponse.next());
}

export const config = {
	/**
	 * Vercel bills an Edge Middleware invocation for every matched request, including the
	 * ones this function immediately no-ops on. Excluding them here means they are never
	 * invoked at all: API routes, the checkout surface, all `_next` internals, and any
	 * path ending in a file extension (public/ assets, fonts, icons — this also covers
	 * favicon.ico, robots.txt and sitemap.xml).
	 *
	 * Prefixes are anchored with `/` or `$` so they exclude `/api/…` without also
	 * excluding a channel or locale slug that merely starts with those letters.
	 *
	 * The equivalent guards at the top of `middleware()` stay as a backstop for runtimes
	 * that apply the matcher differently (self-hosted, `next start`).
	 */
	matcher: ["/((?!api/|api$|_next/|.*\\.[\\w]+$).*)"],
};
