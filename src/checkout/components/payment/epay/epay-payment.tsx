"use client";

import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { CircleDollarSign, MessageCircle, QrCode, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type CheckoutFragment } from "@/checkout/graphql";
import {
	type CheckoutPriceChangeNotice,
	isCheckoutFreeOrder,
} from "@/checkout/lib/payment/checkout-pay-amount";
import { canCallCheckoutComplete } from "@/checkout/lib/payment/checkout-payment-status";
import { clearPaymentCompleting } from "@/checkout/lib/payment/checkout-payment-completion";
import { finalizeCheckoutOrder } from "@/checkout/lib/payment/finalize-checkout-order";
import { type EpayPaymentMethod } from "@/checkout/lib/payment/providers/epay";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { useLiveCheckoutSearchParams } from "@/checkout/lib/checkout-search-params";
import { formatMoneyWithFallback } from "@/checkout/lib/utils/money";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { PaymentTrustSignals } from "../payment-trust-signals";
import { FreeOrderCheckout } from "../stripe/free-order-checkout";
import { type StripeBillingContext } from "../stripe/stripe-billing-context";
import { buildEpayReturnUrl, executeEpayCheckoutPayment } from "./execute-epay-checkout-payment";

type EpayPaymentProps = {
	checkout: CheckoutFragment;
	billing: StripeBillingContext;
	onPaymentError: (message: string) => void;
	onBillingErrors: (errors: Record<string, string>, focusField?: string) => void;
	onPriceChangeNotice: (notice: CheckoutPriceChangeNotice) => void;
	onPaymentActivityChange?: (active: boolean) => void;
};

type ReturnState = "idle" | "checking" | "pending" | "completing";

const RETURN_POLL_ATTEMPTS = 12;
const RETURN_POLL_INTERVAL_MS = 1500;

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const EpayPayment: FC<EpayPaymentProps> = ({
	checkout,
	billing,
	onPaymentError,
	onBillingErrors,
	onPriceChangeNotice,
	onPaymentActivityChange,
}) => {
	const searchParams = useSearchParams();
	const liveSearchParams = useLiveCheckoutSearchParams(searchParams);
	const { refreshCheckout } = useCheckoutData();
	const tActions = useTranslations("checkout.actions");
	const [paymentMethod, setPaymentMethod] = useState<EpayPaymentMethod>("wxpay");
	const [isLoading, setIsLoading] = useState(false);
	const [returnState, setReturnState] = useState<ReturnState>("idle");
	const verifyInFlight = useRef<Promise<void> | null>(null);
	const isReturn = liveSearchParams.get("epayReturn") === "1" && !!liveSearchParams.get("transaction");
	const totalStr = formatMoneyWithFallback(checkout.totalPrice?.gross);

	const verifyReturnedPayment = useCallback(() => {
		if (verifyInFlight.current) {
			return verifyInFlight.current;
		}

		const run = (async () => {
			setReturnState("checking");
			onPaymentError("");
			onPaymentActivityChange?.(true);

			for (let attempt = 0; attempt < RETURN_POLL_ATTEMPTS; attempt += 1) {
				const freshCheckout = await refreshCheckout({ updateState: false });
				if (freshCheckout && canCallCheckoutComplete(freshCheckout)) {
					setReturnState("completing");
					const result = await finalizeCheckoutOrder(checkout.id, checkout.channel.slug);
					if (!result.ok) {
						clearPaymentCompleting();
						onPaymentError(result.error);
						setReturnState("pending");
						onPaymentActivityChange?.(false);
					}
					return;
				}

				if (attempt < RETURN_POLL_ATTEMPTS - 1) {
					await wait(RETURN_POLL_INTERVAL_MS);
				}
			}

			setReturnState("pending");
			onPaymentError(
				"Payment confirmation is still pending. Do not pay again. Check the status again in a moment or contact support.",
			);
			onPaymentActivityChange?.(false);
		})().finally(() => {
			verifyInFlight.current = null;
		});

		verifyInFlight.current = run;
		return run;
	}, [checkout.channel.slug, checkout.id, onPaymentActivityChange, onPaymentError, refreshCheckout]);

	useEffect(() => {
		if (isReturn) {
			void verifyReturnedPayment();
		}
	}, [isReturn, verifyReturnedPayment]);

	if (isCheckoutFreeOrder(checkout)) {
		return (
			<FreeOrderCheckout
				checkout={checkout}
				billing={billing}
				onError={onPaymentError}
				onBillingErrors={onBillingErrors}
				onPaymentActivityChange={onPaymentActivityChange}
			/>
		);
	}

	if (isReturn) {
		const isChecking = returnState === "checking" || returnState === "completing";
		return (
			<div className="space-y-4 border-y border-border py-6" role="status">
				<div className="flex items-start gap-3">
					{isChecking ? (
						<LoadingSpinner />
					) : (
						<RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
					)}
					<div>
						<p className="font-medium">
							{returnState === "completing" ? "Creating your order" : "Confirming payment"}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{isChecking
								? "We are waiting for the signed payment notification. Do not close this page or pay again."
								: "The payment provider has not confirmed this transaction yet. Do not start another payment."}
						</p>
					</div>
				</div>
				{returnState === "pending" ? (
					<Button type="button" variant="outline-solid" onClick={() => void verifyReturnedPayment()}>
						<RefreshCw className="h-4 w-4" aria-hidden />
						Check payment status
					</Button>
				) : null}
			</div>
		);
	}

	const handlePay = async () => {
		onPaymentError("");
		setIsLoading(true);
		onPaymentActivityChange?.(true);

		const result = await executeEpayCheckoutPayment({
			checkout,
			billing,
			paymentMethod,
			returnUrl: buildEpayReturnUrl(window.location.href),
			refreshCheckout,
		});

		if (!result.ok) {
			if (result.kind === "billing") {
				onBillingErrors(result.errors, result.focusField);
			} else if (result.kind === "price_change") {
				onPriceChangeNotice(result.notice);
			} else {
				onPaymentError(result.message);
			}
			setIsLoading(false);
			onPaymentActivityChange?.(false);
			return;
		}

		window.location.assign(result.payUrl);
	};

	return (
		<div className="space-y-6">
			<fieldset className="space-y-3" disabled={isLoading}>
				<legend className="mb-3 text-sm font-medium">Payment method</legend>
				{(
					[
						{ id: "wxpay" as const, label: "WeChat Pay", detail: "Pay in WeChat", icon: MessageCircle },
						{ id: "alipay" as const, label: "Alipay", detail: "Pay in Alipay", icon: CircleDollarSign },
					] as const
				).map((method) => {
					const Icon = method.icon;
					const selected = paymentMethod === method.id;
					return (
						<label
							key={method.id}
							className={cn(
								"flex min-h-16 cursor-pointer items-center gap-4 border px-4 py-3 transition-colors",
								selected ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20",
							)}
						>
							<input
								type="radio"
								name="epay-method"
								value={method.id}
								checked={selected}
								onChange={() => setPaymentMethod(method.id)}
								className="h-4 w-4"
							/>
							<Icon className="h-5 w-5 text-foreground" aria-hidden />
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-medium">{method.label}</span>
								<span className="block text-xs text-muted-foreground">{method.detail}</span>
							</span>
							<QrCode className="h-5 w-5 text-muted-foreground" aria-hidden />
						</label>
					);
				})}
			</fieldset>

			<PaymentTrustSignals />
			<Button
				type="button"
				className="h-12 w-full md:w-auto md:min-w-[200px]"
				disabled={isLoading}
				onClick={() => void handlePay()}
			>
				{isLoading ? (
					<span className="flex items-center justify-center gap-2">
						<LoadingSpinner />
						{tActions("processingPayment")}
					</span>
				) : (
					tActions("payTotal", { total: totalStr })
				)}
			</Button>
		</div>
	);
};
