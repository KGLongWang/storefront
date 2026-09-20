import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutFragment } from "@/checkout/graphql";
import { setCheckoutTransport, type CheckoutTransport } from "@/checkout/lib/checkout-transport";
import { executeWalletPayment, type WalletAuthorization } from "./execute-wallet-payment";

const authorization: WalletAuthorization = {
	id: "auth",
	checkoutId: "checkout",
	amount: 10,
	currency: "CNY",
	email: "a***@example.test",
};
const checkout = {
	id: "checkout",
	chargeStatus: "NONE",
	authorizeStatus: "NONE",
	totalPrice: { gross: { amount: 10, currency: "CNY" } },
} as CheckoutFragment;
const initialize = vi.fn();
const confirm = vi.fn();
const refresh = vi.fn();
beforeEach(() => {
	vi.resetAllMocks();
	setCheckoutTransport({ initializeTransaction: initialize } as unknown as CheckoutTransport);
	refresh.mockResolvedValue(checkout);
	confirm.mockResolvedValue({ ok: true, data: { payment_token: "one-time-token" } });
	initialize.mockResolvedValue({
		ok: true,
		data: { transaction: { id: "txn" }, transactionEvent: { type: "CHARGE_SUCCESS" }, errors: [] },
	});
});
describe("wallet checkout", () => {
	it("sends one-time authorization and the exact total to Saleor", async () => {
		expect(await executeWalletPayment({ authorization, code: "123456", confirm, refresh })).toEqual({
			status: "charged",
		});
		expect(initialize).toHaveBeenCalledWith({
			checkoutId: "checkout",
			amount: 10,
			action: "CHARGE",
			paymentGateway: { id: "app.linkflow.wallet", data: { payment_token: "one-time-token" } },
		});
	});
	it("coalesces double clicks into one confirmation and one charge", async () => {
		await Promise.all(
			Array.from({ length: 8 }, () =>
				executeWalletPayment({ authorization, code: "123456", confirm, refresh }),
			),
		);
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(initialize).toHaveBeenCalledTimes(1);
	});
	it.each([
		{ totalPrice: { gross: { amount: 11, currency: "CNY" } } },
		{ id: "other", chargeStatus: "FULL" },
	])("does not charge when the checkout binding changed", async (changes) => {
		refresh.mockResolvedValue({ ...checkout, ...changes });
		expect((await executeWalletPayment({ authorization, code: "123456", confirm, refresh })).status).toBe(
			"not_started",
		);
		expect(initialize).not.toHaveBeenCalled();
		expect(confirm).not.toHaveBeenCalled();
	});
	it("does not charge on invalid OTP", async () => {
		confirm.mockResolvedValue({ ok: false, error: "invalid code" });
		expect((await executeWalletPayment({ authorization, code: "wrong", confirm, refresh })).status).toBe(
			"not_started",
		);
		expect(initialize).not.toHaveBeenCalled();
	});
	it.each(["CHARGE_FAILURE", "CHARGE_ACTION_REQUIRED", undefined])(
		"does not report %s as paid",
		async (event) => {
			initialize.mockResolvedValue({
				ok: true,
				data: { transaction: { id: "txn" }, transactionEvent: { type: event } },
			});
			expect((await executeWalletPayment({ authorization, code: "123456", confirm, refresh })).status).toBe(
				"unconfirmed",
			);
		},
	);
	it("keeps an unknown network outcome unconfirmed", async () => {
		initialize.mockRejectedValue(new Error("timeout"));
		expect((await executeWalletPayment({ authorization, code: "123456", confirm, refresh })).status).toBe(
			"unconfirmed",
		);
		expect(initialize).toHaveBeenCalledTimes(1);
	});
	it("recovers an already paid checkout without charging again", async () => {
		refresh.mockResolvedValue({ ...checkout, chargeStatus: "FULL", authorizeStatus: "FULL" });
		expect((await executeWalletPayment({ authorization, code: "123456", confirm, refresh })).status).toBe(
			"charged",
		);
		expect(initialize).not.toHaveBeenCalled();
		expect(confirm).not.toHaveBeenCalled();
	});
});
