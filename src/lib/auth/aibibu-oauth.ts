export const AIBIBU_OAUTH_CALLBACK_MESSAGE = "aibibu.auth.oauth.callback";
export const AIBIBU_OAUTH_RESTART_MESSAGE = "aibibu.auth.oauth.retry";

export type AibibuOAuthCallbackMessage = {
	type: typeof AIBIBU_OAUTH_CALLBACK_MESSAGE;
	state: string;
	code?: string;
	error?: string;
	errorDescription?: string;
};

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
