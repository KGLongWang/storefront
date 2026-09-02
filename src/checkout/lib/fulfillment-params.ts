/**
 * Public product metadata keys that describe what the post-payment fulfillment app needs.
 * Values entered by a shopper are stored separately on Checkout under `fulfillment_params`.
 */
export const FULFILLMENT_METADATA_KEYS = {
	type: "fulfillment_type",
	schema: "fulfillment_params_schema",
	params: "fulfillment_params",
} as const;

const FULFILLMENT_KEY_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const MAX_SCHEMA_FIELDS = 32;
const MAX_OPTIONS = 100;
const MAX_TEXT_LENGTH = 2000;

export type FulfillmentFieldType = "text" | "email" | "select";

export type FulfillmentFieldOption = {
	value: string;
	label: string;
};

export type FulfillmentField = {
	key: string;
	type: FulfillmentFieldType;
	required: boolean;
	label: string;
	placeholder?: string;
	maxLength?: number;
	options?: FulfillmentFieldOption[];
};

export type FulfillmentSchema = {
	fields: FulfillmentField[];
};

export type FulfillmentLineDefinition = {
	lineId: string;
	variantId: string;
	productName: string;
	variantName: string;
	fulfillmentType?: string;
	schema: FulfillmentSchema | null;
	/** Invalid schemas fail closed and are left for the fulfillment app's manual queue. */
	schemaInvalid: boolean;
};

export type FulfillmentValues = Record<string, Record<string, string>>;

type MetadataMap = Readonly<Record<string, string>> | null | undefined;

export type FulfillmentLineInput = {
	lineId: string;
	variantId: string;
	productName: string;
	variantName: string;
	productMetadata?: MetadataMap;
	variantMetadata?: MetadataMap;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength = MAX_TEXT_LENGTH): value is string {
	return typeof value === "string" && value.length <= maxLength;
}

function parseOption(value: unknown): FulfillmentFieldOption | null {
	if (typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT_LENGTH) {
		return { value, label: value };
	}

	if (!isRecord(value) || !isBoundedString(value.value, MAX_TEXT_LENGTH) || value.value.length === 0) {
		return null;
	}

	const label = value.label === undefined ? value.value : value.label;
	if (!isBoundedString(label) || label.length === 0) return null;

	return { value: value.value, label };
}

function parseField(value: unknown): FulfillmentField | null {
	if (!isRecord(value)) return null;
	if (!isBoundedString(value.key, 64) || !FULFILLMENT_KEY_PATTERN.test(value.key)) return null;

	const type = value.type;
	if (type !== "text" && type !== "email" && type !== "select") return null;

	const required = value.required === undefined ? false : value.required;
	if (typeof required !== "boolean") return null;

	const label = value.label === undefined ? value.key : value.label;
	if (!isBoundedString(label) || label.length === 0) return null;

	const placeholder = value.placeholder;
	if (placeholder !== undefined && !isBoundedString(placeholder, 200)) return null;

	const maxLength = value.maxLength;
	if (
		maxLength !== undefined &&
		(typeof maxLength !== "number" ||
			!Number.isInteger(maxLength) ||
			maxLength < 1 ||
			maxLength > MAX_TEXT_LENGTH)
	) {
		return null;
	}

	if (type === "select") {
		if (!Array.isArray(value.options) || value.options.length === 0 || value.options.length > MAX_OPTIONS)
			return null;
		const options = value.options.map(parseOption);
		if (options.some((option) => option === null)) return null;
		const uniqueValues = new Set(options.map((option) => option?.value));
		if (uniqueValues.size !== options.length) return null;
		return {
			key: value.key,
			type,
			required,
			label,
			...(placeholder !== undefined ? { placeholder } : {}),
			...(maxLength !== undefined ? { maxLength } : {}),
			options: options as FulfillmentFieldOption[],
		};
	}

	return {
		key: value.key,
		type,
		required,
		label,
		...(placeholder !== undefined ? { placeholder } : {}),
		...(maxLength !== undefined ? { maxLength } : {}),
	};
}

/** Parse the documented `{ "fields": [...] }` metadata shape. Invalid input is rejected. */
export function parseFulfillmentSchema(value: string | null | undefined): FulfillmentSchema | null {
	if (!value || value.length > 32_000) return null;

	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed) || !Array.isArray(parsed.fields) || parsed.fields.length > MAX_SCHEMA_FIELDS)
			return null;

		const fields = parsed.fields.map(parseField);
		if (fields.some((field) => field === null)) return null;

		const keys = new Set(fields.map((field) => field?.key));
		if (keys.size !== fields.length) return null;

		return { fields: fields as FulfillmentField[] };
	} catch {
		return null;
	}
}

function mergedMetadata(productMetadata: MetadataMap, variantMetadata: MetadataMap): MetadataMap {
	if (!productMetadata && !variantMetadata) return undefined;
	return { ...(productMetadata ?? {}), ...(variantMetadata ?? {}) };
}

/** Resolve product defaults with variant metadata overriding matching keys. */
export function resolveFulfillmentLineDefinition(input: FulfillmentLineInput): FulfillmentLineDefinition {
	const metadata = mergedMetadata(input.productMetadata, input.variantMetadata);
	const schemaValue = metadata?.[FULFILLMENT_METADATA_KEYS.schema];
	const schema = parseFulfillmentSchema(schemaValue);

	return {
		lineId: input.lineId,
		variantId: input.variantId,
		productName: input.productName,
		variantName: input.variantName,
		...(metadata?.[FULFILLMENT_METADATA_KEYS.type]
			? { fulfillmentType: metadata[FULFILLMENT_METADATA_KEYS.type] }
			: {}),
		schema,
		schemaInvalid: schemaValue !== undefined && schema === null,
	};
}

export function getFulfillmentLineDefinitions(lines: FulfillmentLineInput[]): FulfillmentLineDefinition[] {
	return lines.map(resolveFulfillmentLineDefinition);
}

type StoredFulfillmentLine = {
	line_id: string;
	variant_id: string;
	params: Record<string, string>;
};

type StoredFulfillmentParams = {
	version: 1;
	lines: StoredFulfillmentLine[];
};

function parseStoredFulfillmentParams(value: string | null | undefined): StoredFulfillmentParams | null {
	if (!value || value.length > 256_000) return null;

	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.lines)) return null;

		const lines: StoredFulfillmentLine[] = [];
		for (const line of parsed.lines.slice(0, 100)) {
			if (!isRecord(line) || !isBoundedString(line.line_id, 200) || !isBoundedString(line.variant_id, 200))
				return null;
			if (!isRecord(line.params)) return null;

			const params: Record<string, string> = {};
			for (const [key, item] of Object.entries(line.params)) {
				if (!FULFILLMENT_KEY_PATTERN.test(key) || !isBoundedString(item)) return null;
				params[key] = item;
			}
			lines.push({ line_id: line.line_id, variant_id: line.variant_id, params });
		}

		return { version: 1, lines };
	} catch {
		return null;
	}
}

export function initializeFulfillmentValues(
	definitions: FulfillmentLineDefinition[],
	metadata: MetadataMap,
	defaultRecipientEmail?: string | null,
): FulfillmentValues {
	const stored = parseStoredFulfillmentParams(metadata?.[FULFILLMENT_METADATA_KEYS.params]);
	const storedByLineId = new Map(stored?.lines.map((line) => [line.line_id, line.params]) ?? []);

	return Object.fromEntries(
		definitions.map((line) => {
			const storedParams = storedByLineId.get(line.lineId) ?? {};
			const params = Object.fromEntries(
				(line.schema?.fields ?? []).map((field) => [
					field.key,
					storedParams[field.key] ?? (field.key === "recipient_email" ? (defaultRecipientEmail ?? "") : ""),
				]),
			);
			return [line.lineId, params];
		}),
	);
}

export type FulfillmentMetadataInput = { key: string; value: string };

/** Build the checkout metadata payload consumed by the fulfillment app. */
export function buildFulfillmentParamsMetadata(
	definitions: FulfillmentLineDefinition[],
	values: FulfillmentValues,
): FulfillmentMetadataInput[] {
	const lines = definitions
		.filter((line) => line.schema)
		.map((line) => ({
			line_id: line.lineId,
			variant_id: line.variantId,
			params: Object.fromEntries(
				(line.schema?.fields ?? []).map((field) => [
					field.key,
					values[line.lineId]?.[field.key]?.trim() ?? "",
				]),
			),
		}));

	return [
		{
			key: FULFILLMENT_METADATA_KEYS.params,
			value: JSON.stringify({ version: 1, lines }),
		},
	];
}
