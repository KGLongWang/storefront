import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { CurrentUserProfileQuery } from "@/gql/graphql";

import { AibibuAuthError, getAibibuApiUrl, refreshAibibuSession } from "./aibibu-auth-client";
import { persistAibibuSession, readAibibuSession } from "./aibibu-session";
import {
	createAibibuStoreClient,
	type AibibuApiResult,
	type AibibuOrder,
	type AibibuStoreCheckout,
	type AibibuStoreMe,
} from "./aibibu-store-client";

type LegacyAccountUser = NonNullable<CurrentUserProfileQuery["me"]>;

export type AibibuStorefrontUser = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	avatar: { url: string; alt?: string | null } | null;
	dateJoined: string;
	addresses: LegacyAccountUser["addresses"];
	defaultShippingAddress: LegacyAccountUser["defaultShippingAddress"];
	defaultBillingAddress: LegacyAccountUser["defaultBillingAddress"];
};

export type AibibuStoreAuthState =
	| { status: "guest" }
	| { status: "authenticated"; user: AibibuStorefrontUser; accessToken: string }
	| { status: "unavailable" };

function toStorefrontUser(me: AibibuStoreMe): AibibuStorefrontUser {
	return {
		id: me.customer.saleor_id,
		email: me.identity.email || me.customer.email,
		firstName: "",
		lastName: "",
		avatar: null,
		dateJoined: "",
		addresses: [],
		defaultShippingAddress: null,
		defaultBillingAddress: null,
	};
}

export const getAibibuStoreAuthState = cache(async (): Promise<AibibuStoreAuthState> => {
	const cookieStore = await cookies();
	const stored = readAibibuSession(cookieStore);
	const store = createAibibuStoreClient({ baseUrl: getAibibuApiUrl() });

	if (stored.accessToken) {
		const current = await store.me(stored.accessToken);
		if (current.ok) {
			return {
				status: "authenticated",
				user: toStorefrontUser(current.data),
				accessToken: stored.accessToken,
			};
		}
		if (current.kind === "unavailable") return { status: "unavailable" };
	}

	if (!stored.refreshToken) return { status: "guest" };

	try {
		const refreshed = await refreshAibibuSession(stored.refreshToken);
		const current = await store.me(refreshed.accessToken);
		if (!current.ok) {
			return current.kind === "unauthenticated" ? { status: "guest" } : { status: "unavailable" };
		}
		try {
			persistAibibuSession(cookieStore, refreshed, { secure: process.env.NODE_ENV === "production" });
		} catch {
			// RSC cookie stores are read-only; the refreshed token still serves this render.
		}
		return {
			status: "authenticated",
			user: toStorefrontUser(current.data),
			accessToken: refreshed.accessToken,
		};
	} catch (error) {
		if (error instanceof AibibuAuthError && error.status >= 500) return { status: "unavailable" };
		return { status: "guest" };
	}
});

export type AibibuOrdersState =
	| { status: "guest" }
	| { status: "authenticated"; orders: AibibuOrder[] }
	| { status: "unavailable" };

export async function getAibibuStoreOrders(first = 50): Promise<AibibuOrdersState> {
	const auth = await getAibibuStoreAuthState();
	if (auth.status !== "authenticated") return auth;

	const store = createAibibuStoreClient({ baseUrl: getAibibuApiUrl() });
	const result = await store.orders(auth.accessToken, first);
	if (!result.ok) {
		return result.kind === "unauthenticated" ? { status: "guest" } : { status: "unavailable" };
	}
	return { status: "authenticated", orders: result.data.orders };
}

export async function createAibibuStoreCheckout(
	lines: Array<{ variantId: string; quantity: number }>,
): Promise<AibibuApiResult<AibibuStoreCheckout> | { status: "guest" | "unavailable" }> {
	const auth = await getAibibuStoreAuthState();
	if (auth.status !== "authenticated") return { status: auth.status };
	return createAibibuStoreClient({ baseUrl: getAibibuApiUrl() }).createCheckout(auth.accessToken, lines);
}

export async function attachAibibuStoreCheckout(
	checkoutId: string,
): Promise<AibibuApiResult<AibibuStoreCheckout> | { status: "guest" | "unavailable" }> {
	const auth = await getAibibuStoreAuthState();
	if (auth.status !== "authenticated") return { status: auth.status };
	return createAibibuStoreClient({ baseUrl: getAibibuApiUrl() }).attachCheckout(auth.accessToken, checkoutId);
}
