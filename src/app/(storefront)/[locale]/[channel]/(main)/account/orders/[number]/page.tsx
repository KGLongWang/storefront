import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAibibuStoreOrders } from "@/lib/auth/aibibu-server-session";
import { resolveLocaleFromSlug } from "@/config/locale";
import { formatDate, formatMoney } from "@/lib/utils";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { OrderStatusBadge } from "@/ui/components/account/order-status-badge";
import { OrderFulfillmentResult } from "@/ui/components/order-fulfillment-result";
import { AccountOrderDetailSkeleton } from "@/ui/components/account/account-skeleton";

type Props = {
	params: Promise<{ locale: string; number: string }>;
};

export default function OrderDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<AccountOrderDetailSkeleton />}>
			<OrderDetailContent params={params} />
		</Suspense>
	);
}

async function OrderDetailContent({ params }: Props) {
	const { number, locale } = await params;
	const intlLocale = resolveLocaleFromSlug(locale).bcp47;
	const t = await getTranslations({ locale, namespace: "account.orderDetail" });
	const tCommon = await getTranslations({ locale, namespace: "account.common" });
	const tOrders = await getTranslations({ locale, namespace: "account.orders" });
	const result = await getAibibuStoreOrders(100);

	if (result.status === "guest") {
		return <p className="text-sm text-muted-foreground">{t("signInRequired")}</p>;
	}
	if (result.status === "unavailable") {
		return <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>;
	}

	const order = result.orders.find((candidate) => candidate.number === number);
	if (!order) notFound();

	const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
	const placedDate = formatDate(new Date(order.created), undefined, intlLocale);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-balance text-h1">{tOrders("orderNumber", { number: order.number })}</h1>
					<p className="mt-1 text-sm text-muted-foreground">{t("placedOn", { date: placedDate })}</p>
				</div>
				<OrderStatusBadge status={order.status} statusDisplay={order.status_display} localeSlug={locale} />
			</div>

			<OrderFulfillmentResult
				orderStatus={order.status}
				metadata={order.metadata ?? []}
				title={t("fulfillmentResultTitle")}
				successLabel={t("fulfillmentSuccess")}
				pendingLabel={t("fulfillmentPending")}
				manualLabel={t("fulfillmentNeedsReview")}
				failureLabel={t("fulfillmentFailureCode")}
			/>

			<div className="rounded-lg border">
				<div className="border-b px-5 py-4">
					<h2 className="text-sm font-semibold">{t("items", { count: itemCount })}</h2>
				</div>
				<div className="divide-y">
					{order.lines.map((line) => (
						<div key={line.id} className="flex items-center gap-4 px-5 py-4">
							{line.thumbnail_url ? (
								<div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-secondary/30">
									<Image
										src={line.thumbnail_url}
										alt={line.product_name}
										width={128}
										height={128}
										className="h-full w-full object-contain"
									/>
								</div>
							) : null}
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{line.product_name}</p>
								{line.variant_name ? (
									<p className="text-[13px] text-muted-foreground">{line.variant_name}</p>
								) : null}
								<p className="text-[13px] text-muted-foreground">
									{tCommon("qty", { count: line.quantity })}
								</p>
							</div>
							<span className="text-sm font-medium tabular-nums">
								{formatMoney(line.unit_price.amount * line.quantity, line.unit_price.currency, intlLocale)}
							</span>
						</div>
					))}
				</div>
				<div className="flex justify-between border-t px-5 py-4 text-sm font-semibold">
					<span>{t("total")}</span>
					<span className="tabular-nums">
						{formatMoney(order.total.amount, order.total.currency, intlLocale)}
					</span>
				</div>
			</div>

			<LinkWithChannel
				href="/contact"
				className="block w-full rounded-lg border px-5 py-3 text-center text-sm font-medium transition-colors hover:bg-secondary/50"
			>
				{t("needHelp")}
			</LinkWithChannel>
		</div>
	);
}
