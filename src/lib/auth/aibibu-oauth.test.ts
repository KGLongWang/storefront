import { describe, expect, it } from "vitest";

import {
	AIBIBU_OAUTH_CALLBACK_MESSAGE,
	AIBIBU_AUTH_SUCCESS_MESSAGE,
	callbackMessagePayload,
	isAibibuAuthSuccessMessage,
	isAibibuOAuthCallbackMessage,
	isAibibuOAuthRestartMessage,
} from "./aibibu-oauth";

describe("Aibibu OAuth browser messages", () => {
	it("accepts a single-use authorization code bound to state", () => {
		const message = callbackMessagePayload(
			new URLSearchParams({ code: "single-use-code", state: "random-state" }),
		);

		expect(message).toEqual({
			type: AIBIBU_OAUTH_CALLBACK_MESSAGE,
			code: "single-use-code",
			state: "random-state",
		});
		expect(isAibibuOAuthCallbackMessage(message)).toBe(true);
		expect(message).not.toHaveProperty("access_token");
		expect(message).not.toHaveProperty("refresh_token");
	});

	it("recognizes the standalone auth message without treating its token as a PKCE code", () => {
		const message = {
			type: AIBIBU_AUTH_SUCCESS_MESSAGE,
			access_token: "supabase-access-token",
			state: "random-state",
		};

		expect(isAibibuAuthSuccessMessage(message, "random-state")).toBe(true);
		expect(isAibibuOAuthCallbackMessage(message)).toBe(false);
	});

	it("rejects standalone messages with a missing or mismatched state when one is expected", () => {
		const message = { type: AIBIBU_AUTH_SUCCESS_MESSAGE, access_token: "token", state: "other" };

		expect(isAibibuAuthSuccessMessage(message, "expected")).toBe(false);
		expect(isAibibuAuthSuccessMessage({ ...message, state: undefined }, "expected")).toBe(false);
	});

	it("rejects callbacks without state or with both code and error", () => {
		expect(callbackMessagePayload(new URLSearchParams({ code: "single-use-code" }))).toBeNull();
		expect(
			callbackMessagePayload(
				new URLSearchParams({ code: "single-use-code", error: "access_denied", state: "state" }),
			),
		).toBeNull();
	});

	it("accepts a credential-free restart request only by its exact type", () => {
		expect(isAibibuOAuthRestartMessage({ type: "aibibu.auth.oauth.retry" })).toBe(true);
		expect(isAibibuOAuthRestartMessage({ type: "aibibu.auth.oauth.retry", access_token: "bad" })).toBe(false);
		expect(isAibibuOAuthRestartMessage({ type: "aibibu.auth.success" })).toBe(false);
	});
});
