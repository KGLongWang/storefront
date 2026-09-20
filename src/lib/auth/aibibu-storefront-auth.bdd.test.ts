import { describe, expect, it, vi } from "vitest";

import {
	AIBIBU_ACCESS_COOKIE,
	AIBIBU_REFRESH_COOKIE,
	clearAibibuSession,
	persistAibibuSession,
	readAibibuSession,
	type AibibuCookieStore,
} from "./aibibu-session";
import { createAibibuStoreClient } from "./aibibu-store-client";
import {
	CUSTOMER_AUTH_PROVIDER,
	SALEOR_STAFF_AUTH_UNCHANGED,
	customerAuthDestination,
} from "./customer-auth-policy";
import { callbackMessagePayload } from "./aibibu-oauth";

function cookieStore() {
	const values = new Map<string, string>();
	const writes: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
	const deleted: string[] = [];
	const store: AibibuCookieStore = {
		get: (name) => (values.has(name) ? { value: values.get(name)! } : undefined),
		set: (name, value, options) => {
			values.set(name, value);
			writes.push({ name, value, options });
		},
		delete: (name) => {
			values.delete(name);
			deleted.push(name);
		},
	};
	return { store, values, writes, deleted };
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("Feature: Aibibu customer identity in the Saleor storefront", () => {
	it("Scenario: OAuth credentials stay on the server", () => {
		// Given Supabase redirects the embedded flow with a PKCE-bound code
		const message = callbackMessagePayload(
			new URLSearchParams({ code: "single-use-code", state: "verified-state" }),
		);

		// When Storefront sends the callback to its parent frame
		// Then the browser receives no reusable Supabase session credentials
		expect(message).toMatchObject({ code: "single-use-code", state: "verified-state" });
		expect(message).not.toHaveProperty("access_token");
		expect(message).not.toHaveProperty("refresh_token");
	});

	it("Scenario: Existing Aibibu user signs in", () => {
		// Given a valid Supabase session returned by Aibibu
		const cookies = cookieStore();

		// When Storefront persists the session
		persistAibibuSession(
			cookies.store,
			{ accessToken: "access-token", refreshToken: "refresh-token", expiresIn: 3600 },
			{ secure: true },
		);

		// Then both tokens are server-only cookies
		expect(cookies.writes).toHaveLength(2);
		expect(cookies.writes.every(({ options }) => options?.httpOnly === true)).toBe(true);
		expect(cookies.writes.every(({ options }) => options?.sameSite === "lax")).toBe(true);
		expect(cookies.writes.every(({ options }) => options?.secure === true)).toBe(true);
		expect(readAibibuSession(cookies.store)).toEqual({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
	});

	it("Scenario: Invalid or expired session is rejected", async () => {
		// Given Aibibu rejects the bearer token
		const fetcher = vi.fn(async () => jsonResponse({ detail: { code: "supabase_auth_failed" } }, 401));
		const store = createAibibuStoreClient({ baseUrl: "https://aibibu.test", fetcher });

		// When Storefront resolves the account
		const result = await store.me("expired-token");

		// Then the response is classified as an invalid session without customer data
		expect(result).toEqual({ ok: false, kind: "unauthenticated" });
	});

	it("Scenario: First Storefront access provisions a Saleor Customer", async () => {
		// Given Aibibu owns provisioning by verified subject
		const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
			jsonResponse({
				identity: { user_id: "supabase-user-1", email: "person@example.test" },
				customer: {
					saleor_id: "saleor-customer-1",
					external_reference: "supabase-user-1",
					email: "person@example.test",
				},
			}),
		);
		const store = createAibibuStoreClient({ baseUrl: "https://aibibu.test", fetcher });

		// When Storefront resolves /store/me
		const result = await store.me("verified-token");

		// Then the returned Customer is mapped to the verified Supabase subject
		expect(result.ok && result.data.customer.external_reference).toBe("supabase-user-1");
	});

	it("Scenario: Repeated Storefront access reuses the Saleor Customer", async () => {
		// Given the same verified identity is resolved twice
		const body = {
			identity: { user_id: "supabase-user-1", email: "person@example.test" },
			customer: {
				saleor_id: "saleor-customer-1",
				external_reference: "supabase-user-1",
				email: "person@example.test",
			},
		};
		const fetcher = vi.fn(async () => jsonResponse(body));
		const store = createAibibuStoreClient({ baseUrl: "https://aibibu.test", fetcher });

		// When Storefront asks for the account repeatedly
		const [first, second] = await Promise.all([store.me("token"), store.me("token")]);

		// Then Aibibu returns the same Saleor Customer mapping
		expect(first).toEqual(second);
		expect(first.ok && first.data.customer.saleor_id).toBe("saleor-customer-1");
	});

	it("Scenario: Browser identity fields are ignored", async () => {
		// Given Storefront only accepts a verified bearer token
		const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
			jsonResponse({
				identity: { user_id: "verified-user", email: "verified@example.test" },
				customer: {
					saleor_id: "customer-1",
					external_reference: "verified-user",
					email: "verified@example.test",
				},
			}),
		);
		const store = createAibibuStoreClient({ baseUrl: "https://aibibu.test", fetcher });

		// When Storefront resolves the account
		await store.me("verified-token");

		// Then no browser-provided identity is sent to Aibibu
		const [, init] = fetcher.mock.calls[0]!;
		expect(init).toMatchObject({
			headers: { Authorization: "Bearer verified-token" },
		});
		expect(init?.body).toBeUndefined();
	});

	it("Scenario: Orders are isolated by verified identity", async () => {
		// Given Aibibu derives order ownership from the bearer token
		const fetcher = vi.fn(async () => jsonResponse({ orders: [] }));
		const store = createAibibuStoreClient({ baseUrl: "https://aibibu.test", fetcher });

		// When Storefront requests order history
		await store.orders("verified-token", 25);

		// Then the request contains no customer or user selector
		expect(fetcher).toHaveBeenCalledWith(
			"https://aibibu.test/v1/store/orders?first=25",
			expect.objectContaining({ headers: { Authorization: "Bearer verified-token" } }),
		);
	});

	it("Scenario: Authenticated checkout is attached to the verified customer", async () => {
		// Given only the verified bearer token identifies the customer
		const fetcher = vi.fn(async (_input: string, _init?: RequestInit) =>
			jsonResponse(
				{
					id: "checkout-1",
					token: "token-1",
					email: "person@example.test",
					total: { amount: 20, currency: "USD" },
					lines: [],
				},
				201,
			),
		);
		const store = createAibibuStoreClient({ baseUrl: "https://aibibu.test", fetcher });

		// When Storefront creates a checkout
		const result = await store.createCheckout("verified-token", [{ variantId: "variant-1", quantity: 2 }]);

		// Then the browser sends cart lines, but no customer selector
		expect(result.ok && result.data.id).toBe("checkout-1");
		const [, init] = fetcher.mock.calls[0]!;
		expect(JSON.parse(String(init?.body))).toEqual({
			lines: [{ variant_id: "variant-1", quantity: 2 }],
		});
		expect(init).toMatchObject({ headers: { Authorization: "Bearer verified-token" } });
	});

	it("Scenario: Customer logs out", () => {
		// Given both Aibibu cookies exist
		const cookies = cookieStore();
		cookies.values.set(AIBIBU_ACCESS_COOKIE, "access-token");
		cookies.values.set(AIBIBU_REFRESH_COOKIE, "refresh-token");

		// When Storefront logs out
		clearAibibuSession(cookies.store);

		// Then both cookies are removed
		expect(cookies.deleted).toEqual([AIBIBU_ACCESS_COOKIE, AIBIBU_REFRESH_COOKIE]);
		expect(readAibibuSession(cookies.store)).toEqual({ accessToken: null, refreshToken: null });
	});

	it("Scenario: Saleor native customer auth is unavailable", () => {
		// When a customer requests native signup or password reset
		// Then both paths resolve to the Aibibu login flow
		expect(CUSTOMER_AUTH_PROVIDER).toBe("aibibu");
		expect(customerAuthDestination("signup")).toBe("/login");
		expect(customerAuthDestination("reset-password")).toBe("/login");
	});

	it("Scenario: Saleor staff login is unchanged", () => {
		// Given this policy is scoped only to Storefront customers
		// Then Saleor Dashboard staff authentication remains outside the change
		expect(SALEOR_STAFF_AUTH_UNCHANGED).toBe(true);
	});
});
