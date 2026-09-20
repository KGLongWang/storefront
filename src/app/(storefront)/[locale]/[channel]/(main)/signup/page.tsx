import { redirect } from "next/navigation";
import { buildStorefrontPath } from "@/lib/storefront-path";

export default async function SignUpPage({
	params,
}: {
	params: Promise<{ locale: string; channel: string }>;
}) {
	const { locale, channel } = await params;
	redirect(buildStorefrontPath(locale, channel, "/login"));
}
