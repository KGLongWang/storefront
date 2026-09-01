export type AibibuIdentity = {
	user_id: string;
	email: string | null;
	platform_role?: string;
};

export type AibibuStoreCustomer = {
	saleor_id: string;
	external_reference: string;
	email: string;
};

export type AibibuStoreMe = {
	identity: AibibuIdentity;
	customer: AibibuStoreCustomer;
};

export type AibibuMoney = {
	amount: number;
	currency: string;
};

export type AibibuOrderLine = {
	id: string;
	product_name: string;
	variant_name: string;
	quantity: number;
	thumbnail_url: string;
	unit_price: AibibuMoney;
};

export type AibibuOrder = {
	id: string;
	number: string;
	status: string;
	status_display: string;
	created: string;
	total: AibibuMoney;
	lines: AibibuOrderLine[];
};

export type AibibuStoreCheckout = {
	id: string;
	token: string;
	email: string;
	total: AibibuMoney;
	lines: Array<{
		id: string;
		variant_id: string;
		sku: string;
		name: string;
		quantity: number;
		unit_price: AibibuMoney;
	}>;
};

export type AibibuApiResult<T> =
	| { ok: true; data: T }
	| { ok: false; kind: "unauthenticated" | "unavailable" };

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function createAibibuStoreClient({
	baseUrl,
	fetcher = fetch,
}: {
	baseUrl: string;
	fetcher?: Fetcher;
}) {
	const root = baseUrl.replace(/\/$/, "");

	async function get<T>(path: string, accessToken: string): Promise<AibibuApiResult<T>> {
		try {
			const response = await fetcher(`${root}${path}`, {
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
				cache: "no-store",
			});
			if (response.status === 401 || response.status === 403) {
				return { ok: false, kind: "unauthenticated" };
			}
			if (!response.ok) {
				return { ok: false, kind: "unavailable" };
			}
			return { ok: true, data: (await response.json()) as T };
		} catch {
			return { ok: false, kind: "unavailable" };
		}
	}

	async function post<T>(path: string, accessToken: string, body: unknown): Promise<AibibuApiResult<T>> {
		try {
			const response = await fetcher(`${root}${path}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				cache: "no-store",
			});
			if (response.status === 401 || response.status === 403) {
				return { ok: false, kind: "unauthenticated" };
			}
			if (!response.ok) return { ok: false, kind: "unavailable" };
			return { ok: true, data: (await response.json()) as T };
		} catch {
			return { ok: false, kind: "unavailable" };
		}
	}

	return {
		me(accessToken: string) {
			return get<AibibuStoreMe>("/v1/store/me", accessToken);
		},
		orders(accessToken: string, first = 50) {
			const safeFirst = Math.max(1, Math.min(100, Math.trunc(first)));
			return get<{ orders: AibibuOrder[] }>(`/v1/store/orders?first=${safeFirst}`, accessToken);
		},
		createCheckout(accessToken: string, lines: Array<{ variantId: string; quantity: number }>) {
			return post<AibibuStoreCheckout>("/v1/store/checkouts", accessToken, {
				lines: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
			});
		},
		attachCheckout(accessToken: string, checkoutId: string) {
			return post<AibibuStoreCheckout>(
				`/v1/store/checkouts/${encodeURIComponent(checkoutId)}/attach`,
				accessToken,
				{},
			);
		},
	};
}
