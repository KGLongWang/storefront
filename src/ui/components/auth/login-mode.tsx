"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";
import { buildStorefrontPath } from "@/lib/storefront-path";
import { Button } from "@/ui/components/ui/button";

export function LoginMode() {
	const params = useParams<{ locale: string; channel: string }>();
	const returnTo = buildStorefrontPath(params.locale, params.channel, "/account");
	const [error, setError] = useState("");

	const beginLogin = useCallback(async () => {
		setError("");
		try {
			const response = await fetch("/api/auth/aibibu/start", {
				method: "POST",
				credentials: "same-origin",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				body: JSON.stringify({ returnTo }),
				cache: "no-store",
			});
			if (!response.ok) throw new Error("auth_start_failed");
			const data = (await response.json()) as { protocol?: string; authorizationUrl?: string };
			if (data.protocol !== "pkce" || !data.authorizationUrl) throw new Error("auth_start_invalid");
			window.location.assign(data.authorizationUrl);
		} catch {
			setError("登录服务暂时不可用，请稍后重试。");
		}
	}, [returnTo]);

	useEffect(() => {
		void beginLogin();
	}, [beginLogin]);

	return (
		<div className="mx-auto my-16 flex min-h-64 w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
			{error ? (
				<>
					<p className="text-sm text-destructive" role="alert">{error}</p>
					<Button type="button" variant="outline-solid" onClick={() => void beginLogin()}>
						<RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
						重试登录
					</Button>
				</>
			) : (
				<>
					<LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<p className="text-sm text-muted-foreground">正在跳转到统一登录</p>
				</>
			)}
		</div>
	);
}
