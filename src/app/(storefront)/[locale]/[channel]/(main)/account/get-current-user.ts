import { cache } from "react";
import {
	getAibibuStoreAuthState,
	type AibibuStoreAuthState,
	type AibibuStorefrontUser,
} from "@/lib/auth/aibibu-server-session";

export type AccountUser = AibibuStorefrontUser;
export type AccountAuthState = AibibuStoreAuthState;

/**
 * Fetch the current user profile, memoized per request via React cache().
 * Returns guest / authenticated / unavailable — never conflates transient errors with signed out.
 */
export const getAccountAuthState = cache(async (): Promise<AccountAuthState> => {
	return getAibibuStoreAuthState();
});
