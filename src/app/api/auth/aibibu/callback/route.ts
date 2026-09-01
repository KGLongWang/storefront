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
<body><p>Completing sign in...</p><script>
window.parent.postMessage(${inlineJson(payload)}, ${inlineJson(targetOrigin)});
</script></body>
</html>`;
	return new Response(html, {
		headers: {
			"Cache-Control": "private, no-store",
			"Content-Type": "text/html; charset=utf-8",
			"Content-Security-Policy":
				"default-src 'none'; script-src 'unsafe-inline'; style-src 'none'; frame-ancestors 'self'; base-uri 'none'",
			"Referrer-Policy": "no-referrer",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
