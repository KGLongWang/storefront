import { CheckCircle2, Clock3, Ticket } from "lucide-react";

const STATUS_KEY = "aibibu_fulfillment_status";
const FAILURE_KEY = "aibibu_failure_code";
const VOUCHER_KEY = "aibibu_retry_voucher_code";

type MetadataEntry = { key: string; value: string };

type OrderFulfillmentResultProps = {
	metadata: readonly MetadataEntry[];
	title: string;
	successLabel: string;
	pendingLabel: string;
	failureLabel: string;
	voucherLabel: string;
};

/** Customer-safe fulfillment outcome. Never render raw provider messages here. */
export function OrderFulfillmentResult({
	metadata,
	title,
	successLabel,
	pendingLabel,
	failureLabel,
	voucherLabel,
}: OrderFulfillmentResultProps) {
	const values = new Map(metadata.map(({ key, value }) => [key, value]));
	const status = values.get(STATUS_KEY);
	const failureCode = values.get(FAILURE_KEY);
	const voucherCode = values.get(VOUCHER_KEY);

	if (!status && !failureCode && !voucherCode) return null;

	const isSuccess = status === "fulfilled";
	const isPending = status === "manual_review" || Boolean(failureCode);

	return (
		<section className="rounded-lg border border-border bg-card p-4" aria-live="polite">
			<div className="flex items-start gap-3">
				{isSuccess ? (
					<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
				) : (
					<Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
				)}
				<div className="min-w-0 space-y-1">
					<h2 className="text-sm font-semibold">{title}</h2>
					<p className="text-sm text-muted-foreground">
						{isSuccess ? successLabel : isPending ? pendingLabel : failureLabel}
					</p>
					{failureCode && (
						<p className="text-xs text-muted-foreground">
							{failureLabel}: <code className="font-mono">{failureCode}</code>
						</p>
					)}
					{voucherCode && (
						<div className="mt-3 flex items-center gap-2 rounded-md border border-dashed px-3 py-2">
							<Ticket className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<div className="min-w-0">
								<p className="text-xs text-muted-foreground">{voucherLabel}</p>
								<code className="break-all font-mono text-sm font-semibold">{voucherCode}</code>
							</div>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
