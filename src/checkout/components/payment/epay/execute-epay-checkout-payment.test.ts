import { describe, expect, it } from "vitest";
import { buildEpayReturnUrl } from "./execute-epay-checkout-payment";

describe("buildEpayReturnUrl", () => {
	it("preserves checkout routing and replaces stale payment return state", () => {
		const url = buildEpayReturnUrl(
			"https://shop.example.com/en/cny/checkout?checkout=abc&step=payment&transaction=old#payment",
		);
		const parsed = new URL(url);

		expect(parsed.pathname).toBe("/en/cny/checkout");
		expect(parsed.searchParams.get("checkout")).toBe("abc");
		expect(parsed.searchParams.get("step")).toBe("payment");
		expect(parsed.searchParams.get("transaction")).toBeNull();
		expect(parsed.searchParams.get("epayReturn")).toBe("1");
		expect(parsed.hash).toBe("");
	});
});
