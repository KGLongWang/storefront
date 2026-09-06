export const AIBIBU_OAUTH_CALLBACK_MESSAGE = "aibibu.auth.oauth.callback";
export const AIBIBU_OAUTH_RESTART_MESSAGE = "aibibu.auth.oauth.retry";
/**
 * Message emitted by the standalone auth UI. It is intentionally kept
 * separate from the PKCE callback message: an access token cannot be sent to
 * the current storefront exchange route as if it were a one-time code.
 */
export const AIBIBU_AUTH_SUCCESS_MESSAGE = "aibibu.auth.success";

export type AibibuOAuthCallbackMessage = {
	type: typeof AIBIBU_OAUTH_CALLBACK_MESSAGE;
	state: string;
	code?: string;
	error?: string;
	errorDescription?: string;
};

export type AibibuAuthSuccessMessage = {
	type: typeof AIBIBU_AUTH_SUCCESS_MESSAGE;
	access_token: string;
	expires_at?: number;
	state?: string;
};

export function isAibibuAuthSuccessMessage(
	value: unknown,
	expectedState?: string,
): value is AibibuAuthSuccessMessage {
	if (!value || typeof value !== "object") return false;
	const message = value as Record<string, unknown>;
	if (message.type !== AIBIBU_AUTH_SUCCESS_MESSAGE) return false;
	if (typeof message.access_token !== "string" || message.access_token.trim() === "") return false;
	if (message.expires_at !== undefined && typeof message.expires_at !== "number") return false;
	if (expectedState !== undefined && message.state !== expectedState) return false;
	return true;
}

export function isAibibuOAuthCallbackMessage(value: unknown): value is AibibuOAuthCallbackMessage {
	if (!value || typeof value !== "object") return false;
	const message = value as Record<string, unknown>;
	if (message.type !== AIBIBU_OAUTH_CALLBACK_MESSAGE) return false;
	if ("access_token" in message || "refresh_token" in message) return false;
	if (typeof message.state !== "string" || !message.state) return false;
	const hasCode = typeof message.code === "string" && message.code.length >= 10;
	const hasError = typeof message.error === "string" && message.error.length > 0;
	return hasCode !== hasError;
}

export function isAibibuOAuthRestartMessage(value: unknown): boolean {
	if (!value || typeof value !== "object") return false;
	const message = value as Record<string, unknown>;
	return Object.keys(message).length === 1 && message.type === AIBIBU_OAUTH_RESTART_MESSAGE;
}

export function callbackMessagePayload(params: URLSearchParams): AibibuOAuthCallbackMessage | null {
	const state = params.get("state")?.trim() || "";
	const code = params.get("code")?.trim() || "";
	const error = params.get("error")?.trim() || "";
	if (!state || (!code && !error) || (code && error)) return null;
	return {
		type: AIBIBU_OAUTH_CALLBACK_MESSAGE,
		state,
		...(code ? { code } : {}),
		...(error
			? {
					error,
					errorDescription: params.get("error_description")?.trim() || undefined,
				}
			: {}),
	};
}
