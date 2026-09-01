import "server-only";

import { cookies } from "next/headers";
import { readAibibuSession } from "./aibibu-session";

/** Same cookie resolution as `getServerAuthClient().fetchWithAuth`. */
export async function getAuthTokenPresence(): Promise<{ hasAccess: boolean; hasRefresh: boolean }> {
	try {
		const cookieStore = await cookies();
		const session = readAibibuSession(cookieStore);

		return {
			hasAccess: session.accessToken !== null,
			hasRefresh: session.refreshToken !== null,
		};
	} catch {
		return { hasAccess: false, hasRefresh: false };
	}
}

/**
 * True when Aibibu/Supabase session cookies are present on the request.
 */
export async function hasAuthSession(): Promise<boolean> {
	const { hasAccess, hasRefresh } = await getAuthTokenPresence();
	return hasAccess || hasRefresh;
}
