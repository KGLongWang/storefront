"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { cn } from "@/lib/utils";
import { fulfillmentFieldAttributes } from "@/checkout/lib/consts/input-attributes";
import type {
	FulfillmentField,
	FulfillmentLineDefinition,
	FulfillmentValues,
} from "@/checkout/lib/fulfillment-params";

type FulfillmentParamsSectionProps = {
	definitions: FulfillmentLineDefinition[];
	values: FulfillmentValues;
	onChange: (lineId: string, fieldKey: string, value: string) => void;
	error?: string;
};

function fieldId(lineIndex: number, field: FulfillmentField): string {
	return `fulfillment-${lineIndex}-${field.key}`;
}

/** Renders only fields declared by Saleor metadata; missing values remain payable for manual fulfillment. */
export const FulfillmentParamsSection: FC<FulfillmentParamsSectionProps> = ({
	definitions,
	values,
	onChange,
	error,
}) => {
	const t = useTranslations("checkout.fulfillment");
	const visibleDefinitions = definitions.filter((definition) => definition.schema?.fields.length);

	if (!visibleDefinitions.length) return null;

	return (
		<section className="space-y-5" aria-labelledby="fulfillment-params-title">
			<div className="space-y-1.5">
				<h2 id="fulfillment-params-title" className="text-xl font-semibold">
					{t("title")}
				</h2>
				<p className="text-sm text-muted-foreground">{t("description")}</p>
			</div>

			{visibleDefinitions.map((definition) => {
				const definitionIndex = definitions.indexOf(definition);
				const fields = definition.schema?.fields ?? [];
				const hasMultipleLines = visibleDefinitions.length > 1;

				return (
					<fieldset key={definition.lineId} className="space-y-4 rounded-lg border border-border p-4">
						{hasMultipleLines ? (
							<legend className="px-1 text-sm font-medium">
								{definition.productName}
								{definition.variantName ? ` — ${definition.variantName}` : ""}
							</legend>
						) : null}

						<div className="grid gap-4 sm:grid-cols-2">
							{fields.map((field) => {
								const id = fieldId(definitionIndex, field);
								const value = values[definition.lineId]?.[field.key] ?? "";
								const attributes = fulfillmentFieldAttributes[field.type];

								return (
									<div key={field.key} className="space-y-1.5">
										<Label htmlFor={id}>
											{field.label}
											{field.required ? (
												<span className="ml-1 font-normal text-muted-foreground">
													({t("requiredForAutomatic")})
												</span>
											) : (
												<span className="ml-1 font-normal text-muted-foreground">({t("optional")})</span>
											)}
										</Label>

										{field.type === "select" ? (
											<select
												id={id}
												name={`fulfillment.${definitionIndex}.${field.key}`}
												value={value}
												onChange={(event) => onChange(definition.lineId, field.key, event.target.value)}
												autoComplete={attributes.autoComplete}
												className={cn(
													"flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
													"ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
												)}
											>
												<option value="">{field.placeholder ?? t("selectPlaceholder")}</option>
												{field.options?.map((option) => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										) : (
											<Input
												id={id}
												name={`fulfillment.${definitionIndex}.${field.key}`}
												type={field.type}
												inputMode={"inputMode" in attributes ? attributes.inputMode : undefined}
												value={value}
												onChange={(event) => onChange(definition.lineId, field.key, event.target.value)}
												placeholder={field.placeholder ?? field.label}
												maxLength={field.maxLength}
												autoComplete={attributes.autoComplete}
												className="h-12"
											/>
										)}
									</div>
								);
							})}
						</div>
					</fieldset>
				);
			})}

			{error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</section>
	);
};
