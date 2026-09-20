import type { PaymentGatewayLike, TransactionInitializePayload } from "../types";

export const WALLET_GATEWAY_ID = "app.linkflow.wallet";
export const isWalletGateway = (id: string) => id === WALLET_GATEWAY_ID;
export const findWalletGateway = (gateways: ReadonlyArray<PaymentGatewayLike>) =>
	gateways.find((g) => isWalletGateway(g.id));
export function isWalletPaymentEnabled() {
	return (
		process.env.NODE_ENV !== "production" ||
		process.env.NEXT_PUBLIC_ENABLE_WALLET_PAYMENTS === "true" ||
		process.env.ENABLE_WALLET_PAYMENTS === "true"
	);
}
export function getWalletPaymentGuardError(id: string | null | undefined) {
	return id && isWalletGateway(id) && !isWalletPaymentEnabled() ? "账户余额付款尚未开放。" : null;
}
export function walletChargeConfirmed(payload: TransactionInitializePayload) {
	return (
		!payload?.errors?.length &&
		!!payload?.transaction?.id &&
		payload.transactionEvent?.type === "CHARGE_SUCCESS"
	);
}
