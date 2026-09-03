import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import { createUser } from "@/lib/services/user-service";
import { POST } from "./route";

const validBody = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jane",
	email: "jane@school.edu",
	password: "SecurePass123",
};

function registerRequest(body: unknown) {
	return POST(
		new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

describe("POST /api/auth/register", () => {
	it("returns 201 and redirect on success", async () => {
		const response = await registerRequest(validBody);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			success: true,
			redirect: "/mcq",
		});

		const row = await env.DB.prepare(
			"SELECT username FROM users WHERE username = ?1",
		)
			.bind(validBody.username)
			.all<{ username: string }>();
		expect(row.results[0]?.username).toBe("jane");
	});

	it("returns 409 for duplicate username", async () => {
		await createUser(validBody);

		const response = await registerRequest({
			...validBody,
			email: "other@school.edu",
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "Username or email already in use",
		});
	});

	it("returns 409 for duplicate email", async () => {
		await createUser(validBody);

		const response = await registerRequest({
			...validBody,
			username: "otheruser",
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "Username or email already in use",
		});
	});

	it("returns 400 for invalid body", async () => {
		const response = await registerRequest({
			firstName: "Jane",
			lastName: "Smith",
			username: "ab",
			email: "not-an-email",
			password: "short",
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Validation failed");
		expect(body.details).toEqual(expect.any(Array));
	});

	it("never returns password or password_hash in the response", async () => {
		const response = await registerRequest(validBody);
		const body = await response.json();

		expect(body).not.toHaveProperty("password");
		expect(body).not.toHaveProperty("passwordHash");
		expect(body).not.toHaveProperty("password_hash");
		expect(JSON.stringify(body)).not.toContain("SecurePass123");
	});
});
