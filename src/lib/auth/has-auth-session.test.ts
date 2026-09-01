import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { AIBIBU_ACCESS_COOKIE, AIBIBU_REFRESH_COOKIE } from "./aibibu-session";
import { getAuthTokenPresence, hasAuthSession } from "./has-auth-session";

function mockCookies(cookieList: Array<{ name: string; value: string }>) {
	vi.mocked(cookies).mockResolvedValue({
		get: (name: string) => cookieList.find((cookie) => cookie.name === name),
	} as Awaited<ReturnType<typeof cookies>>);
}

describe("hasAuthSession", () => {
	it("detects an Aibibu access token", async () => {
		mockCookies([{ name: AIBIBU_ACCESS_COOKIE, value: "access-token" }]);
		await expect(hasAuthSession()).resolves.toBe(true);
	});

	it("keeps a refresh-only session eligible for rotation", async () => {
		mockCookies([{ name: AIBIBU_REFRESH_COOKIE, value: "refresh-token" }]);
		await expect(getAuthTokenPresence()).resolves.toEqual({ hasAccess: false, hasRefresh: true });
	});

	it("ignores legacy Saleor and checkout cookies", async () => {
		mockCookies([
			{ name: "saleor_auth_access_token", value: "legacy" },
			{ name: "checkoutId-default-channel", value: "checkout" },
		]);
		await expect(hasAuthSession()).resolves.toBe(false);
	});
});
