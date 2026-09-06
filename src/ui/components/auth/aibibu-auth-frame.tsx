"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { isAibibuOAuthCallbackMessage, isAibibuOAuthRestartMessage } from "@/lib/auth/aibibu-oauth";
import { Button } from "@/ui/components/ui/button";

type OAuthStartResponse = {
	protocol: "pkce";
	authorizationUrl: string;
	state: string;
	authOrigin: string;
};

export function AibibuAuthFrame({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
	const t = useTranslations("account.login");
	const frameRef = useRef<HTMLIFrameElement>(null);
	const expectedState = useRef("");
	const authOrigin = useRef("");
	const completing = useRef(false);
	const [authorizationUrl, setAuthorizationUrl] = useState("");
	const [status, setStatus] = useState<"loading" | "ready" | "processing" | "error">("loading");
	const [error, setError] = useState("");

	const beginAuthorization = useCallback(async () => {
		completing.current = false;
		expectedState.current = "";
		authOrigin.current = "";
		setAuthorizationUrl("");
		setError("");
		setStatus("loading");
		try {
			const response = await fetch("/api/auth/aibibu/start", {
				method: "POST",
				credentials: "same-origin",
				headers: { Accept: "application/json" },
			});
			if (!response.ok) throw new Error("oauth_start_failed");
			const data = (await response.json()) as Partial<OAuthStartResponse>;
			if (data.protocol !== "pkce" || !data.authorizationUrl || !data.state || !data.authOrigin) {
				throw new Error("oauth_start_invalid");
			}
			expectedState.current = data.state;
			authOrigin.current = new URL(data.authOrigin).origin;
			setAuthorizationUrl(data.authorizationUrl);
			setStatus("ready");
		} catch {
			setError(t("authUnavailable"));
			setStatus("error");
		}
	}, [t]);

	useEffect(() => {
		void beginAuthorization();
	}, [beginAuthorization]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<unknown>) => {
			if (event.source !== frameRef.current?.contentWindow) return;

			if (isAibibuOAuthRestartMessage(event.data)) {
				if (!authOrigin.current || event.origin !== authOrigin.current) return;
				void beginAuthorization();
				return;
			}

			if (event.origin !== window.location.origin || !isAibibuOAuthCallbackMessage(event.data)) return;
			if (event.data.state !== expectedState.current || completing.current) {
				setError(t("invalidAuthorization"));
				setStatus("error");
				return;
			}
			if (event.data.error) {
				setError(
					event.data.error === "access_denied"
						? t("authorizationCancelled")
						: event.data.errorDescription || t("authUnavailable"),
				);
				setStatus("error");
				return;
			}

			completing.current = true;
			setStatus("processing");
			setError("");
			void fetch("/api/auth/aibibu/exchange", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: event.data.code, state: event.data.state }),
			})
				.then(async (response) => {
					if (!response.ok) throw new Error("oauth_exchange_failed");
					await onSuccess();
				})
				.catch(() => {
					completing.current = false;
					setError(t("authUnavailable"));
					setStatus("error");
				});
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [beginAuthorization, onSuccess, t]);

	return (
		<div className="relative min-h-[38rem] w-full overflow-hidden rounded-lg border border-border bg-background">
			{authorizationUrl ? (
				<iframe
					ref={frameRef}
					src={authorizationUrl}
					title={t("frameTitle")}
					className="h-[38rem] w-full border-0 bg-background"
					referrerPolicy="no-referrer"
					sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
				/>
			) : null}

			{status === "loading" || status === "processing" ? (
				<div className="absolute inset-0 flex min-h-[38rem] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
					<LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<p className="text-sm text-muted-foreground">
						{status === "processing" ? t("processingAuthorization") : t("connecting")}
					</p>
				</div>
			) : null}

			{status === "error" ? (
				<div className="absolute inset-0 flex min-h-[38rem] flex-col items-center justify-center gap-5 bg-background px-6 text-center">
					<p className="max-w-sm text-sm text-destructive" role="alert">
						{error}
					</p>
					<Button type="button" variant="outline-solid" onClick={() => void beginAuthorization()}>
						<RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
						{t("retryAuthorization")}
					</Button>
				</div>
			) : null}
		</div>
	);
}
