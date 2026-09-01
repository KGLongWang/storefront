export const AIBIBU_ACCESS_COOKIE = "aibibu_store_access_token";
export const AIBIBU_REFRESH_COOKIE = "aibibu_store_refresh_token";

const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

export type AibibuCookieStore = {
	get: (name: string) => { value: string } | undefined;
	set: (name: string, value: string, options?: Record<string, unknown>) => void;
	delete: (name: string) => void;
};

export type AibibuSession = {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
};

export function readAibibuSession(store: Pick<AibibuCookieStore, "get">): {
	accessToken: string | null;
	refreshToken: string | null;
} {
	return {
		accessToken: store.get(AIBIBU_ACCESS_COOKIE)?.value || null,
		refreshToken: store.get(AIBIBU_REFRESH_COOKIE)?.value || null,
	};
}

export function persistAibibuSession(
	store: Pick<AibibuCookieStore, "set">,
	session: AibibuSession,
	options: { secure: boolean },
): void {
	const shared = {
		httpOnly: true,
		sameSite: "lax",
		secure: options.secure,
		path: "/",
	};
	store.set(AIBIBU_ACCESS_COOKIE, session.accessToken, {
		...shared,
		maxAge: Math.max(60, session.expiresIn),
	});
	store.set(AIBIBU_REFRESH_COOKIE, session.refreshToken, {
		...shared,
		maxAge: REFRESH_TOKEN_MAX_AGE,
	});
}

export function clearAibibuSession(store: Pick<AibibuCookieStore, "delete">): void {
	store.delete(AIBIBU_ACCESS_COOKIE);
	store.delete(AIBIBU_REFRESH_COOKIE);
}
