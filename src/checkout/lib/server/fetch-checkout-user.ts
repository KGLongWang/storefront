import "server-only";

import type { CheckoutUser } from "@/checkout/lib/checkout-types";
import { getAibibuStoreAuthState } from "@/lib/auth/aibibu-server-session";

/** Customer profile for checkout — same server auth path as storefront account. */
export async function fetchCheckoutUserOnServer(): Promise<CheckoutUser | null> {
	const auth = await getAibibuStoreAuthState();
	if (auth.status !== "authenticated") return null;
	return {
		id: auth.user.id,
		email: auth.user.email,
		addresses: [],
		defaultBillingAddress: null,
		defaultShippingAddress: null,
	};
}
