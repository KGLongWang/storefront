export const CUSTOMER_AUTH_PROVIDER = "aibibu" as const;
export const SALEOR_STAFF_AUTH_UNCHANGED = true;

type NativeCustomerAuthRoute = "login" | "signup" | "reset-password";

export function customerAuthDestination(_route: NativeCustomerAuthRoute): "/login" {
	return "/login";
}
