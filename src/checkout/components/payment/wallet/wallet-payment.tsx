"use client";

import { useRef, useState } from "react";
import { requestWalletAuthorization, confirmWalletAuthorization } from "@/app/(checkout)/wallet-actions";
import { useCheckoutData } from "@/checkout/providers/checkout-data";
import { getCheckoutTransport } from "@/checkout/lib/checkout-transport";
import { updateCheckoutBilling } from "@/checkout/lib/payment/update-billing";
import {
	getCheckoutPayAmount,
	getCheckoutPayCurrency,
	isCheckoutFreeOrder,
} from "@/checkout/lib/payment/checkout-pay-amount";
import { canCallCheckoutComplete } from "@/checkout/lib/payment/checkout-payment-status";
import { finalizeCheckoutOrder } from "@/checkout/lib/payment/finalize-checkout-order";
import { Button } from "@/ui/components/ui/button";
import { FreeOrderCheckout } from "../stripe/free-order-checkout";
import type { IntegratedPaymentUiProps } from "../integrated-payment-ui";
import { executeWalletPayment, type WalletAuthorization } from "./execute-wallet-payment";

type Props = Required<Pick<IntegratedPaymentUiProps, "checkout" | "billing">> &
	Omit<IntegratedPaymentUiProps, "checkout" | "billing" | "provider">;

export function WalletPayment({
	checkout,
	billing,
	onPaymentError,
	onBillingErrors,
	onPaymentActivityChange,
}: Props) {
	const { refreshCheckout } = useCheckoutData();
	const [authorization, setAuthorization] = useState<WalletAuthorization | null>(null);
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [unconfirmed, setUnconfirmed] = useState(false);
	const active = useRef(false);
	const refresh = () => refreshCheckout({ updateState: false });
	if (!checkout || !billing) return null;
	if (isCheckoutFreeOrder(checkout))
		return (
			<FreeOrderCheckout
				checkout={checkout}
				billing={billing}
				onError={onPaymentError ?? (() => {})}
				onBillingErrors={onBillingErrors ?? (() => {})}
				onPaymentActivityChange={onPaymentActivityChange}
			/>
		);

	async function finish() {
		const result = await finalizeCheckoutOrder(checkout!.id, checkout!.channel.slug);
		if (!result.ok) {
			setUnconfirmed(true);
			onPaymentError?.(result.error);
		}
	}

	async function submit() {
		if (active.current || !checkout || !billing) return;
		active.current = true;
		setBusy(true);
		onPaymentError?.("");
		try {
			if (unconfirmed) {
				const live = await refresh();
				if (live && canCallCheckoutComplete(live)) await finish();
				else onPaymentError?.("付款结果仍待核对，请勿重复支付。若已扣款，请联系人工处理。");
				return;
			}
			if (!authorization) {
				if (!billing.authenticated) {
					onPaymentError?.("请先登录后使用账户余额付款。");
					return;
				}
				const updated = await updateCheckoutBilling({ checkoutId: checkout.id, ...billing });
				if (!updated.ok) {
					onBillingErrors?.(updated.errors, updated.focusField);
					return;
				}
				const attached = await getCheckoutTransport().attachCustomer(checkout.id);
				if (!attached.ok) {
					onPaymentError?.(attached.error || "无法绑定付款账号。");
					return;
				}
				const live = await refresh();
				if (!live) {
					onPaymentError?.("无法核对订单金额，请稍后重试。");
					return;
				}
				if (canCallCheckoutComplete(live)) {
					await finish();
					return;
				}
				const amount = getCheckoutPayAmount(live),
					currency = getCheckoutPayCurrency(live);
				if (
					amount === null ||
					!currency ||
					amount !== getCheckoutPayAmount(checkout) ||
					currency !== getCheckoutPayCurrency(checkout)
				) {
					onPaymentError?.("订单金额已变化，请刷新页面后重新确认。");
					return;
				}
				const response = await requestWalletAuthorization(checkout.id, amount, currency);
				if (!response.ok) {
					onPaymentError?.(response.error);
					return;
				}
				setAuthorization({
					id: response.data.authorization_id,
					checkoutId: checkout.id,
					amount,
					currency,
					email: response.data.masked_email,
				});
				return;
			}
			onPaymentActivityChange?.(true);
			const result = await executeWalletPayment({
				authorization,
				code,
				confirm: confirmWalletAuthorization,
				refresh,
			});
			if (result.status === "charged") {
				setUnconfirmed(true);
				await finish();
			} else if (result.status === "unconfirmed") {
				setUnconfirmed(true);
				onPaymentError?.(result.message);
			} else {
				onPaymentActivityChange?.(false);
				onPaymentError?.(result.message);
			}
		} catch {
			onPaymentError?.("付款结果无法核对，请稍后查询，勿重复支付。");
		} finally {
			active.current = false;
			setBusy(false);
		}
	}

	return (
		<div className="space-y-4 border-y border-border py-6">
			<p className="font-medium">使用账户余额付款</p>
			<p className="text-sm text-muted-foreground">
				{unconfirmed
					? "请先核对这笔付款的结果。"
					: authorization
						? `验证码已发送至 ${authorization.email}，验证后扣除 ${authorization.amount.toFixed(2)} ${authorization.currency}。`
						: "通过邮箱验证后，从当前账号余额扣款。"}
			</p>
			{authorization && !unconfirmed ? (
				<label className="block space-y-2 text-sm">
					邮箱验证码
					<input
						className="block w-full rounded border border-border bg-background px-3 py-2"
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						value={code}
						onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
						disabled={busy}
					/>
				</label>
			) : null}
			{authorization && !unconfirmed ? (
				<Button
					type="button"
					variant="outline-solid"
					disabled={busy}
					onClick={() => {
						setAuthorization(null);
						setCode("");
						onPaymentError?.("");
					}}
				>
					重新获取验证码
				</Button>
			) : null}
			<Button
				type="button"
				disabled={busy || (!!authorization && !unconfirmed && code.length !== 6)}
				onClick={() => void submit()}
			>
				{busy
					? "处理中…"
					: unconfirmed
						? "查询付款状态并完成订单"
						: authorization
							? "验证并确认扣款"
							: "发送邮箱验证码"}
			</Button>
		</div>
	);
}
