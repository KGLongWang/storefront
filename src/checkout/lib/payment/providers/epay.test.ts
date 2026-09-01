import { afterEach, describe, expect, it, vi } from "vitest";
import {
	EPAY_GATEWAY_ID,
	findEpayGateway,
	getEpayPayUrl,
	getEpayPaymentGuardError,
	getEpayTransactionError,
	isEpayGateway,
	isEpayPaymentEnabled,
	parseEpayTransactionData,
} from "./epay";

describe("Epay provider", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("matches only the Linkflow Epay app id", () => {
		expect(isEpayGateway(EPAY_GATEWAY_ID)).toBe(true);
		expect(isEpayGateway("app.linkflow.wallet")).toBe(false);
		expect(findEpayGateway([{ id: EPAY_GATEWAY_ID, name: "Epay" }])?.id).toBe(EPAY_GATEWAY_ID);
	});

	it("is enabled locally and requires an explicit production flag", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(isEpayPaymentEnabled()).toBe(true);

		vi.stubEnv("NODE_ENV", "production");
		expect(isEpayPaymentEnabled()).toBe(false);
		expect(getEpayPaymentGuardError(EPAY_GATEWAY_ID)).toMatch(/disabled/i);

		vi.stubEnv("NEXT_PUBLIC_ENABLE_EPAY_PAYMENTS", "true");
		expect(isEpayPaymentEnabled()).toBe(true);
		expect(getEpayPaymentGuardError(EPAY_GATEWAY_ID)).toBeNull();
	});

	it("parses submit-mode payment URLs", () => {
		const data = { epayResponse: { payUrl: "https://pay.example.com/submit.php?id=1", mode: "submit" } };
		expect(parseEpayTransactionData(data)).toEqual(data);
		expect(getEpayPayUrl(data)).toBe("https://pay.example.com/submit.php?id=1");
	});

	it("rejects missing and unsafe payment URLs", () => {
		expect(getEpayPayUrl({ epayResponse: {} })).toBeNull();
		expect(getEpayPayUrl({ epayResponse: { payUrl: "javascript:alert(1)" } })).toBeNull();
	});

	it("surfaces transaction failures and requires a transaction id", () => {
		expect(
			getEpayTransactionError({
				transactionEvent: { type: "CHARGE_FAILURE", message: "Gateway rejected payment" },
				transaction: { id: "tx-1" },
			}),
		).toBe("Gateway rejected payment");
		expect(getEpayTransactionError({ transactionEvent: { type: "CHARGE_ACTION_REQUIRED" } })).toMatch(
			/not created/i,
		);
	});
});
