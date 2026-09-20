"use server";

import { getAibibuStoreAuthState } from "@/lib/auth/aibibu-server-session";
import { getAibibuApiUrl } from "@/lib/auth/aibibu-auth-client";
import { isWalletPaymentEnabled } from "@/checkout/lib/payment/providers/wallet";

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function paymentRequest<T>(path: string, body: unknown): Promise<ApiResult<T>> {
	if (!isWalletPaymentEnabled()) return { ok: false, error: "账户余额付款尚未开放。" };
	const auth = await getAibibuStoreAuthState();
	if (auth.status !== "authenticated") return { ok: false, error: "请先登录已验证邮箱的账号。" };
	try {
		const response = await fetch(`${getAibibuApiUrl().replace(/\/$/, "")}${path}`, {
			method: "POST",
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(15000),
			headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const payload = (await response.json()) as { detail?: { message?: unknown } } & T;
		if (!response.ok)
			return {
				ok: false,
				error:
					typeof payload?.detail?.message === "string"
						? payload.detail.message
						: "支付验证未完成，请稍后重试。",
			};
		return { ok: true, data: payload as T };
	} catch {
		return { ok: false, error: "支付验证暂时不可用，请稍后重试。" };
	}
}

export async function requestWalletAuthorization(checkoutId: string, amount: number, currency: string) {
	if (
		!checkoutId ||
		checkoutId.length > 256 ||
		!Number.isFinite(amount) ||
		amount <= 0 ||
		!/^[A-Z]{3}$/.test(currency)
	)
		return { ok: false as const, error: "订单金额或币种无效。" };
	return paymentRequest<{
		authorization_id: string;
		masked_email: string;
		expires_at: string;
		resend_after_seconds: number;
	}>("/v1/payments/lago/authorizations", {
		source_object_id: checkoutId,
		source_object_type: "Checkout",
		amount: amount.toFixed(2),
		currency,
	});
}

export async function confirmWalletAuthorization(authorizationId: string, code: string) {
	if (!/^[0-9a-f-]{36}$/i.test(authorizationId) || !/^\d{6}$/.test(code))
		return { ok: false as const, error: "请输入 6 位邮箱验证码。" };
	return paymentRequest<{ payment_token: string }>(
		`/v1/payments/lago/authorizations/${authorizationId}/confirm`,
		{ code },
	);
}
