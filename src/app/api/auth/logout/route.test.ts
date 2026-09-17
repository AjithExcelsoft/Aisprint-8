import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
	it("returns 200 and redirect to login", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			redirect: "/login",
		});
	});
});
