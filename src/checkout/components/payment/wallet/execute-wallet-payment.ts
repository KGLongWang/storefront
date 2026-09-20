import type { CheckoutFragment } from "@/checkout/graphql";
import { getCheckoutTransport } from "@/checkout/lib/checkout-transport";
import { WALLET_GATEWAY_ID, walletChargeConfirmed } from "@/checkout/lib/payment/providers/wallet";
import { getCheckoutPayAmount, getCheckoutPayCurrency } from "@/checkout/lib/payment/checkout-pay-amount";
import { canCallCheckoutComplete } from "@/checkout/lib/payment/checkout-payment-status";

export type WalletAuthorization = {
	id: string;
	checkoutId: string;
	amount: number;
	currency: string;
	email: string;
};
export type WalletResult = { status: "charged" } | { status: "unconfirmed" | "not_started"; message: string };
type Params = {
	authorization: WalletAuthorization;
	code: string;
	confirm: (
		id: string,
		code: string,
	) => Promise<{ ok: true; data: { payment_token: string } } | { ok: false; error: string }>;
	refresh: () => Promise<CheckoutFragment | null>;
};
const inFlight = new Map<string, Promise<WalletResult>>();

/** Never initialize a second transaction for a duplicate click. A fresh token is still bound server-side. */
export async function executeWalletPayment(params: Params): Promise<WalletResult> {
	const key = params.authorization.checkoutId;
	if (inFlight.has(key)) return inFlight.get(key)!;
	const pending = run(params);
	inFlight.set(key, pending);
	try {
		return await pending;
	} finally {
		if (inFlight.get(key) === pending) inFlight.delete(key);
	}
}

async function run({ authorization, code, confirm, refresh }: Params): Promise<WalletResult> {
	let initialized = false;
	try {
		const checkout = await refresh();
		if (checkout?.id === authorization.checkoutId && canCallCheckoutComplete(checkout))
			return { status: "charged" };
		if (
			!checkout ||
			checkout.id !== authorization.checkoutId ||
			getCheckoutPayAmount(checkout) !== authorization.amount ||
			getCheckoutPayCurrency(checkout) !== authorization.currency
		) {
			return { status: "not_started", message: "订单金额已变化或无法核对，请刷新后重新验证。" };
		}
		const token = await confirm(authorization.id, code);
		if (!token.ok) return { status: "not_started", message: token.error };
		initialized = true;
		const response = await getCheckoutTransport().initializeTransaction({
			checkoutId: authorization.checkoutId,
			amount: authorization.amount,
			action: "CHARGE",
			paymentGateway: { id: WALLET_GATEWAY_ID, data: { payment_token: token.data.payment_token } },
		});
		if (response.ok && walletChargeConfirmed(response.data)) return { status: "charged" };
		return { status: "unconfirmed", message: "本次扣款尚未确认，请查询付款状态，勿重复支付。" };
	} catch {
		return {
			status: initialized ? "unconfirmed" : "not_started",
			message: initialized ? "扣款结果暂时无法确认，请勿重复支付。" : "支付验证未完成，请稍后重试。",
		};
	}
}
