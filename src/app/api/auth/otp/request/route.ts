import { NextRequest, NextResponse } from "next/server";
import { httpStatusForAuthErrors } from "@/lib/auth/auth-api-utils";
import { rejectIfRateLimited } from "@/lib/auth/auth-rate-limit";
import { requestSignInOtp } from "@/lib/auth/bff-server";

export async function POST(request: NextRequest) {
	const rateLimited = rejectIfRateLimited(request, "login");
	if (rateLimited) return rateLimited;
	const body = (await request.json().catch(() => null)) as { email?: string } | null;
	if (!body?.email) {
		return NextResponse.json({ errors: [{ message: "Email is required", code: "REQUIRED" }] }, { status: 400 });
	}
	const result = await requestSignInOtp(body.email);
	if (!result.ok) {
		return NextResponse.json({ errors: result.errors }, { status: httpStatusForAuthErrors(result.errors) });
	}
	return NextResponse.json({ ok: true });
}
