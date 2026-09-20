import { NextResponse } from "next/server";

export function nativeCustomerAuthDisabledResponse() {
	return NextResponse.json(
		{
			errors: [
				{
					message: "Use the Aibibu identity flow",
					code: "AIBIBU_AUTH_REQUIRED",
				},
			],
		},
		{ status: 410 },
	);
}
