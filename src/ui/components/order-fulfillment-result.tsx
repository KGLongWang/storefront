import { CheckCircle2, CircleX } from "lucide-react";

const STATUS_KEY = "aibibu_fulfillment_status";
const FAILURE_KEY = "aibibu_failure_code";

type MetadataEntry = { key: string; value: string };

type OrderFulfillmentResultProps = {
	metadata: readonly MetadataEntry[];
	title: string;
	successLabel: string;
	pendingLabel: string;
	failureLabel: string;
};

/** Customer-safe fulfillment outcome. Never render raw provider messages here. */
export function OrderFulfillmentResult({
	metadata,
	title,
	successLabel,
	pendingLabel,
	failureLabel,
}: OrderFulfillmentResultProps) {
	const values = new Map(metadata.map(({ key, value }) => [key, value]));
	const status = values.get(STATUS_KEY);
	const failureCode = values.get(FAILURE_KEY);

	if (!status && !failureCode) return null;

	const isSuccess = status === "fulfilled";

	return (
		<section className="rounded-lg border border-border bg-card p-4" aria-live="polite">
			<div className="flex items-start gap-3">
				{isSuccess ? (
					<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
				) : (
					<CircleX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
				)}
				<div className="min-w-0 space-y-1">
					<h2 className="text-sm font-semibold">{title}</h2>
					<p className="text-sm text-muted-foreground">
						{isSuccess ? successLabel : pendingLabel}
					</p>
					{failureCode && !isSuccess && (
						<p className="text-xs text-muted-foreground">
							{failureLabel}: <code className="font-mono">{failureCode}</code>
						</p>
					)}

				</div>
			</div>
		</section>
	);
}
