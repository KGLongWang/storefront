import { NextRequest, NextResponse } from "next/server";
import { rejectIfRateLimited } from "@/lib/auth/auth-rate-limit";
import { getPreferredAuthMethod } from "@/lib/auth/bff-server";

export async function POST(request: NextRequest) {
	const rateLimited = rejectIfRateLimited(request, "login");
	if (rateLimited) return rateLimited;

	const body = (await request.json().catch(() => null)) as { email?: string } | null;
	if (!body?.email) {
		return NextResponse.json({ errors: [{ message: "Email is required", code: "REQUIRED" }] }, { status: 400 });
	}
	try {
		return NextResponse.json({ method: await getPreferredAuthMethod(body.email) });
	} catch {
		return NextResponse.json(
			{ errors: [{ message: "Authentication service is unavailable", code: "UNAVAILABLE" }] },
			{ status: 503 },
		);
	}
}
