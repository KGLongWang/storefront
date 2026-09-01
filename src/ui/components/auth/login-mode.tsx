"use client";

import { useParams, useRouter } from "next/navigation";
import { syncAuthSurfacesAfterSignIn } from "@/lib/auth";
import { buildStorefrontPath } from "@/lib/storefront-path";
import { AibibuAuthFrame } from "@/ui/components/auth/aibibu-auth-frame";

export function LoginMode() {
	const params = useParams<{ locale: string; channel: string }>();
	const router = useRouter();

	return (
		<div className="mx-auto my-10 w-full max-w-xl">
			<AibibuAuthFrame
				onSuccess={() =>
					syncAuthSurfacesAfterSignIn(params.channel, router, {
						redirectTo: buildStorefrontPath(params.locale, params.channel, "/account"),
					})
				}
			/>
		</div>
	);
}
