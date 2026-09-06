import { callbackMessagePayload } from "@/lib/auth/aibibu-oauth";
import { getAibibuOAuthConfig } from "@/lib/auth/aibibu-oauth-server";

function inlineJson(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function GET(request: Request) {
	let targetOrigin: string;
	try {
		targetOrigin = new URL(getAibibuOAuthConfig().redirectUri).origin;
	} catch {
		return new Response("Aibibu login is not configured", { status: 503 });
	}
	const payload = callbackMessagePayload(new URL(request.url).searchParams);
	if (!payload) return new Response("Invalid OAuth callback", { status: 400 });

	const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Completing sign in</title></head>
<body><p id="status">Completing sign in...</p><script>
const payload = ${inlineJson(payload)};
if (window.parent !== window) {
  window.parent.postMessage(payload, ${inlineJson(targetOrigin)});
} else if (payload.error) {
  document.getElementById("status").textContent = "Sign in was cancelled. You can close this window and try again.";
} else {
  fetch("/api/auth/aibibu/exchange", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: payload.code, state: payload.state })
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.errors?.[0]?.message || "Unable to complete sign in");
    window.location.replace(data.redirectTo || "/account");
  }).catch((error) => {
    document.getElementById("status").textContent = error instanceof Error ? error.message : "Unable to complete sign in";
  });
}
</script></body>
</html>`;
	return new Response(html, {
		headers: {
			"Cache-Control": "private, no-store",
			"Content-Type": "text/html; charset=utf-8",
			"Content-Security-Policy":
				"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'none'; frame-ancestors 'self'; base-uri 'none'",
			"Referrer-Policy": "no-referrer",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
