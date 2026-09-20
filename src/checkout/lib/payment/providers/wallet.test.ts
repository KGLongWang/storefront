import { afterEach, expect, it, vi } from "vitest";
import { getWalletPaymentGuardError, isWalletPaymentEnabled, walletChargeConfirmed } from "./wallet";
import { resolvePaymentProvider, usesClientPaymentSubmit } from "../resolve-provider";

afterEach(() => vi.unstubAllEnvs());
it("keeps wallet payments disabled in production until configured", () => {
	vi.stubEnv("NODE_ENV", "production");
	vi.stubEnv("NEXT_PUBLIC_ENABLE_WALLET_PAYMENTS", "false");
	vi.stubEnv("ENABLE_WALLET_PAYMENTS", "false");
	expect(isWalletPaymentEnabled()).toBe(false);
	expect(getWalletPaymentGuardError("app.linkflow.wallet")).not.toBeNull();
});
it("registers the installed wallet app as a client payment flow", () => {
	vi.stubEnv("NODE_ENV", "test");
	const provider = resolvePaymentProvider([{ id: "app.linkflow.wallet", name: "Wallet" }]);
	expect(provider.type).toBe("wallet");
	expect(usesClientPaymentSubmit(provider)).toBe(true);
});
it("requires a successful charge event, not merely a transaction ID", () => {
	expect(walletChargeConfirmed({ transaction: { id: "txn" } })).toBe(false);
	expect(
		walletChargeConfirmed({
			transaction: { id: "txn" },
			transactionEvent: { type: "CHARGE_SUCCESS" },
			errors: [{ message: "failed" }],
		}),
	).toBe(false);
});
