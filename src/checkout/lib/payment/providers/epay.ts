import { type PaymentGatewayLike, type TransactionInitializePayload } from "../types";

export const EPAY_GATEWAY_ID = "app.linkflow.epay";

export type EpayPaymentMethod = "alipay" | "wxpay";

export type EpayTransactionData = {
	epayResponse?: {
		payUrl?: string;
		mode?: "submit" | "mapi";
		tradeNo?: string;
	};
};

export function isEpayGateway(gatewayId: string): boolean {
	return gatewayId === EPAY_GATEWAY_ID;
}

export function findEpayGateway(
	gateways: ReadonlyArray<PaymentGatewayLike> | null | undefined,
): PaymentGatewayLike | undefined {
	return gateways?.find((gateway) => isEpayGateway(gateway.id));
}

export function isEpayPaymentEnabled(): boolean {
	if (process.env.NODE_ENV !== "production") {
		return true;
	}

	return (
		process.env.NEXT_PUBLIC_ENABLE_EPAY_PAYMENTS === "true" || process.env.ENABLE_EPAY_PAYMENTS === "true"
	);
}

export function getEpayPaymentGuardError(gatewayId: string | null | undefined): string | null {
	if (!gatewayId || !isEpayGateway(gatewayId)) {
		return null;
	}

	return isEpayPaymentEnabled() ? null : "Epay payments are disabled";
}

export function parseEpayTransactionData(data: unknown): EpayTransactionData | null {
	if (!data || typeof data !== "object") {
		return null;
	}

	const response = (data as Record<string, unknown>).epayResponse;
	if (!response || typeof response !== "object") {
		return null;
	}

	const record = response as Record<string, unknown>;
	const mode = record.mode;

	return {
		epayResponse: {
			payUrl: typeof record.payUrl === "string" ? record.payUrl : undefined,
			mode: mode === "submit" || mode === "mapi" ? mode : undefined,
			tradeNo: typeof record.tradeNo === "string" ? record.tradeNo : undefined,
		},
	};
}

export function getEpayPayUrl(data: unknown): string | null {
	const payUrl = parseEpayTransactionData(data)?.epayResponse?.payUrl?.trim();
	if (!payUrl) {
		return null;
	}

	try {
		const url = new URL(payUrl);
		return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
	} catch {
		return null;
	}
}

const FAILED_TRANSACTION_EVENT_TYPES = new Set([
	"AUTHORIZATION_FAILURE",
	"AUTHORIZATION_ADJUSTMENT_FAILURE",
	"CHARGE_FAILURE",
	"REFUND_FAILURE",
	"CANCEL_FAILURE",
]);

export function getEpayTransactionError(payload: TransactionInitializePayload): string | null {
	if (payload?.errors?.length) {
		return payload.errors[0]?.message || "Payment could not be initialized";
	}

	const eventType = payload?.transactionEvent?.type;
	if (eventType && FAILED_TRANSACTION_EVENT_TYPES.has(eventType)) {
		return payload?.transactionEvent?.message || "Payment failed";
	}

	if (!payload?.transaction?.id) {
		return "Payment transaction was not created";
	}

	return null;
}
