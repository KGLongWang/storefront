import "server-only";

import {
	getAibibuStoreAuthState,
	type AibibuStoreAuthState,
	type AibibuStorefrontUser,
} from "./aibibu-server-session";

export type HeaderUser = AibibuStorefrontUser;
export type HeaderAuthState = AibibuStoreAuthState;

/** Header user menu — Aibibu/Supabase session only, resolved server-side. */
export const getHeaderAuthState = getAibibuStoreAuthState;
