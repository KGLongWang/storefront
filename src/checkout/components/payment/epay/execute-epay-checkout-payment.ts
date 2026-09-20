import { type CheckoutFragment } from "@/checkout/graphql";
import { getCheckoutTransport } from "@/checkout/lib/checkout-transport";
import {
	buildCheckoutPriceChangeNotice,
	getCheckoutPayAmount,
	getCheckoutPayCurrency,
	hasMaterialCheckoutTotalChange,
	type CheckoutPriceChangeNotice,
} from "@/checkout/lib/payment/checkout-pay-amount";
import {
	EPAY_GATEWAY_ID,
	getEpayPayUrl,
	getEpayTransactionError,
	type EpayPaymentMethod,
} from "@/checkout/lib/payment/providers/epay";
import { updateCheckoutBilling } from "@/checkout/lib/payment/update-billing";
import { type StripeBillingContext } from "@/checkout/components/payment/stripe/stripe-billing-context";

export type EpayCheckoutPayResult =
	| { ok: true; payUrl: string }
	| { ok: false; kind: "error"; message: string }
	| { ok: false; kind: "billing"; errors: Record<string, string>; focusField?: string }
	| { ok: false; kind: "price_change"; notice: CheckoutPriceChangeNotice };

type ExecuteEpayCheckoutPaymentParams = {
	checkout: CheckoutFragment;
	billing: StripeBillingContext;
	paymentMethod: EpayPaymentMethod;
	returnUrl: string;
	refreshCheckout: (options?: { updateState?: boolean }) => Promise<CheckoutFragment | null>;
};

let payInFlight: Promise<EpayCheckoutPayResult> | null = null;

export function buildEpayReturnUrl(currentUrl: string): string {
	const url = new URL(currentUrl);
	url.searchParams.delete("transaction");
	url.searchParams.set("epayReturn", "1");
	url.hash = "";
	return url.toString();
}

export async function executeEpayCheckoutPayment(
	params: ExecuteEpayCheckoutPaymentParams,
): Promise<EpayCheckoutPayResult> {
	if (payInFlight) {
		return payInFlight;
	}

	const run = runEpayCheckoutPayment(params);
	payInFlight = run;

	try {
		return await run;
	} finally {
		if (payInFlight === run) {
			payInFlight = null;
		}
	}
}

async function runEpayCheckoutPayment({
	checkout,
	billing,
	paymentMethod,
	returnUrl,
	refreshCheckout,
}: ExecuteEpayCheckoutPaymentParams): Promise<EpayCheckoutPayResult> {
	const billingResult = await updateCheckoutBilling({
		checkoutId: checkout.id,
		sameAsBilling: billing.sameAsBilling,
		hasShippingAddress: billing.hasShippingAddress,
		billingData: billing.billingData,
		shippingAddress: billing.shippingAddress,
		userAddresses: billing.userAddresses,
		authenticated: billing.authenticated,
	});

	if (!billingResult.ok) {
		return {
			ok: false,
			kind: "billing",
			errors: billingResult.errors,
			focusField: billingResult.focusField,
		};
	}

	const liveCheckout = await refreshCheckout({ updateState: false });
	if (!liveCheckout) {
		return { ok: false, kind: "error", message: "Could not refresh checkout totals. Please try again." };
	}

	const displayedAmount = getCheckoutPayAmount(checkout);
	const payAmount = getCheckoutPayAmount(liveCheckout);
	if (payAmount === null) {
		return { ok: false, kind: "error", message: "Checkout total is unavailable. Please try again." };
	}

	const currency = getCheckoutPayCurrency(liveCheckout);
	if (!currency) {
		return { ok: false, kind: "error", message: "Checkout currency is unavailable. Please try again." };
	}

	if (displayedAmount !== null && hasMaterialCheckoutTotalChange(displayedAmount, payAmount)) {
		return {
			ok: false,
			kind: "price_change",
			notice: buildCheckoutPriceChangeNotice(displayedAmount, payAmount, currency),
		};
	}

	const initResult = await getCheckoutTransport().initializeTransaction({
		checkoutId: liveCheckout.id,
		amount: payAmount,
		paymentGateway: {
			id: EPAY_GATEWAY_ID,
			data: {
				merchantUrls: { success: returnUrl },
				paymentMethod,
				mode: "submit",
			},
		},
	});

	if (!initResult.ok) {
		return { ok: false, kind: "error", message: initResult.error };
	}

	const transactionError = getEpayTransactionError(initResult.data);
	if (transactionError) {
		return { ok: false, kind: "error", message: transactionError };
	}

	const payUrl = getEpayPayUrl(initResult.data.data);
	if (!payUrl) {
		return {
			ok: false,
			kind: "error",
			message: "The payment app did not return a valid checkout URL.",
		};
	}

	return { ok: true, payUrl };
}
