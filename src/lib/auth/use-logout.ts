"use client";

import { useCallback } from "react";

import { logout } from "@/app/actions";
import { resolveBrowseLocaleSlugWithFallback } from "@/lib/browse-locale";
import { bumpChromeVersion } from "@/lib/chrome-sync";
import { buildStorefrontPath } from "@/lib/storefront-path";

export type LogoutOptions = {
	locale?: string;
	channel?: string;
	/** Override post-logout destination. Defaults to canonical browse home or `/`. */
	redirectTo?: string;
	/** Reload the current URL (e.g. checkout in-flow sign-out). */
	stayOnPage?: boolean;
};

function centralAuthLogoutUrl(returnTo: string): string {
	const configured =
		process.env.NEXT_PUBLIC_AIBIBU_AUTH_WEB_URL?.trim() ||
		(process.env.NODE_ENV === "production" ? "https://auth.aibibu.com" : "http://127.0.0.1:4174");
	const authUrl = new URL(configured);
	if (authUrl.protocol !== "http:" && authUrl.protocol !== "https:") {
		throw new Error("Invalid central Auth URL");
	}
	const returnUrl = new URL(returnTo, window.location.origin);
	authUrl.pathname = "/";
	authUrl.search = "";
	authUrl.hash = "";
	authUrl.searchParams.set("action", "logout");
	authUrl.searchParams.set("return_to", returnUrl.toString());
	return authUrl.toString();
}

/** End the Aibibu/Supabase session on the server and hard-navigate to bust Router Cache. */
export function useLogout() {
	return useCallback(async (options?: LogoutOptions) => {
		try {
			await logout();
		} catch {
			// Remote session revocation / server cookie clear is best-effort.
		}

		// Other tabs re-render their auth chrome on next focus; this tab hard-navigates.
		bumpChromeVersion();

		let destination: string;
		if (options?.stayOnPage) {
			destination = window.location.href;
		} else if (options?.redirectTo) {
			destination = options.redirectTo;
		} else if (options?.channel) {
			const locale = resolveBrowseLocaleSlugWithFallback(options.locale);
			destination = buildStorefrontPath(locale, options.channel);
		} else {
			destination = "/";
		}

		try {
			window.location.assign(centralAuthLogoutUrl(destination));
		} catch {
			// Local cookies are already cleared; keep logout usable if Auth is misconfigured.
			if (options?.stayOnPage) window.location.reload();
			else window.location.assign(destination);
		}
	}, []);
}
