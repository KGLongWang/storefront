import { describe, expect, it } from "vitest";
import {
	buildFulfillmentParamsMetadata,
	getFulfillmentLineDefinitions,
	initializeFulfillmentValues,
	parseFulfillmentSchema,
} from "./fulfillment-params";

describe("parseFulfillmentSchema", () => {
	it("parses text, email, and select fields", () => {
		expect(
			parseFulfillmentSchema(
				JSON.stringify({
					fields: [
						{ key: "recipient_email", type: "email", required: false },
						{
							key: "server",
							type: "select",
							required: true,
							options: ["Asia", { value: "EU", label: "Europe" }],
						},
					],
				}),
			),
		).toEqual({
			fields: [
				{ key: "recipient_email", type: "email", required: false, label: "recipient_email" },
				{
					key: "server",
					type: "select",
					required: true,
					label: "server",
					options: [
						{ value: "Asia", label: "Asia" },
						{ value: "EU", label: "Europe" },
					],
				},
			],
		});
	});

	it("rejects invalid schemas and duplicate keys", () => {
		expect(parseFulfillmentSchema("not-json")).toBeNull();
		expect(
			parseFulfillmentSchema(JSON.stringify({ fields: [{ key: "server", type: "unknown" }] })),
		).toBeNull();
		expect(
			parseFulfillmentSchema(
				JSON.stringify({
					fields: [
						{ key: "server", type: "text" },
						{ key: "server", type: "text" },
					],
				}),
			),
		).toBeNull();
	});
});

describe("fulfillment metadata resolution", () => {
	const productMetadata = {
		fulfillment_type: "topup",
		fulfillment_params_schema: JSON.stringify({
			fields: [{ key: "recipient_email", type: "email", required: false }],
		}),
	};

	it("lets variant metadata override product defaults", () => {
		const [line] = getFulfillmentLineDefinitions([
			{
				lineId: "line-1",
				variantId: "variant-1",
				productName: "Subscription",
				variantName: "Monthly",
				productMetadata,
				variantMetadata: {
					fulfillment_params_schema: JSON.stringify({
						fields: [{ key: "game_uid", type: "text", required: true }],
					}),
				},
			},
		]);

		expect(line.fulfillmentType).toBe("topup");
		expect(line.schema?.fields[0]?.key).toBe("game_uid");
	});

	it("prefills a logged-in user's email and serializes values", () => {
		const [line] = getFulfillmentLineDefinitions([
			{
				lineId: "line-1",
				variantId: "variant-1",
				productName: "Subscription",
				variantName: "Monthly",
				productMetadata,
			},
		]);
		const values = initializeFulfillmentValues([line], undefined, "user@example.com");
		expect(values["line-1"]?.recipient_email).toBe("user@example.com");

		const [metadata] = buildFulfillmentParamsMetadata([line], values);
		expect(metadata.key).toBe("fulfillment_params");
		expect(JSON.parse(metadata.value)).toEqual({
			version: 1,
			lines: [
				{ line_id: "line-1", variant_id: "variant-1", params: { recipient_email: "user@example.com" } },
			],
		});
	});
});
