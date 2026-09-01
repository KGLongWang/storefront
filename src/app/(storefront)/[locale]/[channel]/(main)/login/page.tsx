import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthFormSection } from "@/ui/components/auth/auth-form-section";
import { LoginForm } from "@/ui/components/login-form";
import { getAibibuStoreAuthState } from "@/lib/auth/aibibu-server-session";
import { buildStorefrontPath } from "@/lib/storefront-path";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "account.metadata" });
	return {
		title: t("loginTitle"),
		description: t("loginDescription"),
	};
}

type LoginPageProps = {
	params: Promise<{ locale: string; channel: string }>;
};

export default function LoginPage(props: LoginPageProps) {
	return (
		<Suspense fallback={null}>
			<LoginPageEntry {...props} />
		</Suspense>
	);
}

async function LoginPageEntry({ params }: LoginPageProps) {
	const { locale, channel } = await params;
	return (
		<Suspense fallback={<LoginSkeleton />}>
			<LoginContent locale={locale} channel={channel} />
		</Suspense>
	);
}

function LoginSkeleton() {
	return (
		<AuthFormSection>
			<div className="mx-auto my-16 w-full max-w-md">
				<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
					<div className="mb-6 flex flex-col items-center gap-2">
						<div className="h-7 w-40 animate-pulse rounded bg-secondary" />
						<div className="h-4 w-56 animate-pulse rounded bg-secondary" />
					</div>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<div className="h-4 w-24 animate-pulse rounded bg-secondary" />
							<div className="h-12 w-full animate-pulse rounded-md bg-secondary" />
						</div>
						<div className="space-y-1.5">
							<div className="h-4 w-16 animate-pulse rounded bg-secondary" />
							<div className="h-12 w-full animate-pulse rounded-md bg-secondary" />
						</div>
						<div className="flex justify-end">
							<div className="h-4 w-28 animate-pulse rounded bg-secondary" />
						</div>
						<div className="h-12 w-full animate-pulse rounded-md bg-foreground/10" />
					</div>
				</div>
			</div>
		</AuthFormSection>
	);
}

async function LoginContent({ locale, channel }: { locale: string; channel: string }) {
	// Request-dynamic — never serve a cached login redirect from a prior authenticated session.
	await cookies();

	const result = await getAibibuStoreAuthState();

	if (result.status === "authenticated") {
		redirect(buildStorefrontPath(locale, channel));
	}

	return (
		<AuthFormSection>
			<LoginForm />
		</AuthFormSection>
	);
}
