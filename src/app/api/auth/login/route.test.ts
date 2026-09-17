import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import { createUser } from "@/lib/services/user-service";
import { POST } from "./route";

const validInput = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jane",
	email: "jane@school.edu",
	password: "SecurePass123",
};

function loginRequest(body: unknown) {
	return POST(
		new Request("http://localhost/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

describe("POST /api/auth/login", () => {
	beforeEach(async () => {
		await createUser(validInput);
	});

	it("returns 200 and redirect when logging in with username", async () => {
		const response = await loginRequest({
			usernameOrEmail: "jane",
			password: "SecurePass123",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			redirect: "/mcq",
		});
	});

	it("returns 200 and redirect when logging in with email", async () => {
		const response = await loginRequest({
			usernameOrEmail: "jane@school.edu",
			password: "SecurePass123",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			redirect: "/mcq",
		});
	});

	it("returns 401 for wrong password", async () => {
		const response = await loginRequest({
			usernameOrEmail: "jane",
			password: "WrongPassword123",
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Invalid username/email or password",
		});
	});

	it("returns 401 for unknown user", async () => {
		const response = await loginRequest({
			usernameOrEmail: "nobody@school.edu",
			password: "SecurePass123",
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Invalid username/email or password",
		});
	});

	it("returns 400 for invalid body", async () => {
		const response = await loginRequest({
			usernameOrEmail: "",
			password: "",
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Validation failed");
		expect(body.details).toEqual(expect.any(Array));
	});
});
