import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getAibibuStoreOrders } from "@/lib/auth/aibibu-server-session";
import { OrderRow } from "@/ui/components/account/order-row";
import { buildOrderRowLabels } from "@/ui/components/account/order-row-labels";
import { AccountOrdersListSkeleton } from "@/ui/components/account/account-skeleton";

type Props = {
	params: Promise<{ locale: string }>;
};

export default function AccountOrdersPage({ params }: Props) {
	return (
		<Suspense fallback={<AccountOrdersListSkeleton />}>
			<AccountOrdersContent params={params} />
		</Suspense>
	);
}

async function AccountOrdersContent({ params }: Props) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "account.orders" });
	const tErrors = await getTranslations({ locale, namespace: "account.errors" });
	const tOrder = await getTranslations({ locale, namespace: "account" });
	const tStatus = await getTranslations({ locale, namespace: "account.orderStatus" });

	const result = await getAibibuStoreOrders(100);

	if (result.status === "unavailable") {
		return <AccountOrdersError title={t("title")} message={tErrors("loadOrdersFailed")} />;
	}

	if (result.status === "guest") {
		return <AccountOrdersError title={t("title")} message={t("signInRequired")} />;
	}

	const orders = result.orders;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-balance text-h1">{t("title")}</h1>
				<p className="mt-1 text-sm text-muted-foreground">{t("count", { count: orders.length })}</p>
			</div>

			{orders.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<p className="text-muted-foreground">{t("empty")}</p>
				</div>
			) : (
				<div className="space-y-2">
					{orders.map((order) => (
						<OrderRow
							key={order.id}
							order={order}
							localeSlug={locale}
							labels={buildOrderRowLabels(tOrder, tStatus, order)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function AccountOrdersError({ title, message }: { title: string; message: string }) {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-balance text-h1">{title}</h1>
			</div>
			<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
				{message}
			</div>
		</div>
	);
}
