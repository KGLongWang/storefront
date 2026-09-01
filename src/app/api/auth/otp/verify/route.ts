import { NextRequest, NextResponse } from "next/server";
import { httpStatusForAuthErrors } from "@/lib/auth/auth-api-utils";
import { rejectIfRateLimited } from "@/lib/auth/auth-rate-limit";
import { verifySignInOtp } from "@/lib/auth/bff-server";

export async function POST(request: NextRequest) {
	const rateLimited = rejectIfRateLimited(request, "login");
	if (rateLimited) return rateLimited;
	const body = (await request.json().catch(() => null)) as { email?: string; code?: string } | null;
	if (!body?.email || !/^\d{6}$/.test(body.code || "")) {
		return NextResponse.json(
			{ errors: [{ message: "Email and six-digit code are required", code: "REQUIRED" }] },
			{ status: 400 },
		);
	}
	const result = await verifySignInOtp(body.email, body.code!);
	if (!result.ok) {
		return NextResponse.json({ errors: result.errors }, { status: httpStatusForAuthErrors(result.errors) });
	}
	return NextResponse.json({ ok: true });
}
