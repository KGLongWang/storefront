"use client";

import { useCallback, useState, type FC } from "react";
import { type AddressFragment, type CheckoutFragment } from "@/checkout/graphql";
import { isIntegratedPaymentProvider, type ResolvedPaymentProvider } from "@/checkout/lib/payment";
import { type CheckoutPriceChangeNotice } from "@/checkout/lib/payment/checkout-pay-amount";
import { DummyPaymentPlaceholder } from "./dummy-payment-placeholder";
import { WalletPayment } from "./wallet/wallet-payment";
import { findWalletGateway, isWalletPaymentEnabled } from "@/checkout/lib/payment/providers/wallet";
import { EpayPayment } from "./epay/epay-payment";
import { StripePayment } from "./stripe/stripe-payment";
import { type BillingAddressData } from "./billing-address-section";

export type IntegratedPaymentUiProps = {
	provider: ResolvedPaymentProvider;
	checkout?: CheckoutFragment;
	billing?: {
		billingData: BillingAddressData;
		sameAsBilling: boolean;
		hasShippingAddress: boolean;
		shippingAddress: AddressFragment | null | undefined;
		userAddresses: ReadonlyArray<AddressFragment> | undefined;
		authenticated: boolean;
	};
	onPaymentError?: (message: string) => void;
	onBillingErrors?: (errors: Record<string, string>, focusField?: string) => void;
	onPriceChangeNotice?: (notice: CheckoutPriceChangeNotice) => void;
	onPaymentActivityChange?: (active: boolean) => void;
};

/**
 * Renders UI for integrated payment providers.
 * Add new provider components here when wiring a Saleor payment app.
 */
const GatewayPaymentUi: FC<IntegratedPaymentUiProps> = ({
	provider,
	checkout,
	billing,
	onPaymentError,
	onBillingErrors,
	onPriceChangeNotice,
	onPaymentActivityChange,
}) => {
	if (!isIntegratedPaymentProvider(provider)) {
		return null;
	}

	switch (provider.type) {
		case "wallet":
			if (!checkout || !billing) return null;
			return (
				<WalletPayment
					checkout={checkout}
					billing={billing}
					onPaymentError={onPaymentError}
					onBillingErrors={onBillingErrors}
					onPaymentActivityChange={onPaymentActivityChange}
				/>
			);
		case "epay":
			if (!checkout || !billing || !onPaymentError || !onBillingErrors || !onPriceChangeNotice) {
				return null;
			}

			return (
				<EpayPayment
					checkout={checkout}
					billing={billing}
					onPaymentError={onPaymentError}
					onBillingErrors={onBillingErrors}
					onPriceChangeNotice={onPriceChangeNotice}
					onPaymentActivityChange={onPaymentActivityChange}
				/>
			);
		case "dummy":
			return <DummyPaymentPlaceholder gatewayName={provider.gateway.name} />;
		case "stripe":
			if (!checkout || !billing || !onPaymentError || !onBillingErrors || !onPriceChangeNotice) {
				return null;
			}

			return (
				<StripePayment
					checkout={checkout}
					gatewayName={provider.gateway.name}
					billing={billing}
					onPaymentError={onPaymentError}
					onBillingErrors={onBillingErrors}
					onPriceChangeNotice={onPriceChangeNotice}
					onPaymentActivityChange={onPaymentActivityChange}
				/>
			);
	}
};

export const IntegratedPaymentUi: FC<IntegratedPaymentUiProps> = (props) => {
	const [useWallet, setUseWallet] = useState(false);
	const [active, setActive] = useState(false);
	const notify = props.onPaymentActivityChange;
	const onActivity = useCallback(
		(value: boolean) => {
			setActive(value);
			notify?.(value);
		},
		[notify],
	);
	const wallet =
		props.checkout && isWalletPaymentEnabled()
			? findWalletGateway(props.checkout.availablePaymentGateways)
			: undefined;
	const allowChoice =
		wallet && props.provider.type !== "wallet" && isIntegratedPaymentProvider(props.provider);
	const provider: ResolvedPaymentProvider =
		allowChoice && useWallet ? { type: "wallet", gateway: wallet, submitMode: "client" } : props.provider;
	return (
		<div className="space-y-4">
			{allowChoice ? (
				<fieldset disabled={active} className="flex gap-4 text-sm">
					<legend className="mb-2 font-medium">付款方式</legend>
					<label className="flex items-center gap-2">
						<input
							type="radio"
							name="account-payment-source"
							checked={!useWallet}
							onChange={() => setUseWallet(false)}
						/>
						在线支付
					</label>
					<label className="flex items-center gap-2">
						<input
							type="radio"
							name="account-payment-source"
							checked={useWallet}
							onChange={() => setUseWallet(true)}
						/>
						账户余额
					</label>
				</fieldset>
			) : null}
			<GatewayPaymentUi {...props} provider={provider} onPaymentActivityChange={onActivity} />
		</div>
	);
};
