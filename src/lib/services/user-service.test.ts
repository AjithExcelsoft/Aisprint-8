import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import {
	createUser,
	DuplicateUserError,
	getUserByUsernameOrEmail,
} from "./user-service";

const validInput = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jane",
	email: "jane@school.edu",
	password: "SecurePass123",
};

describe("createUser", () => {
	it("inserts a row and returns user without passwordHash", async () => {
		const user = await createUser(validInput);

		expect(user).toEqual({
			id: expect.any(String),
			firstName: "Jane",
			lastName: "Smith",
			username: "jane",
			email: "jane@school.edu",
			createdAt: expect.any(String),
		});
		expect(user).not.toHaveProperty("passwordHash");
	});

	it("stores a hashed password in D1, not plaintext", async () => {
		await createUser(validInput);

		const result = await env.DB.prepare(
			"SELECT password_hash FROM users WHERE username = ?1",
		)
			.bind(validInput.username)
			.all<{ password_hash: string }>();

		const storedHash = result.results[0]?.password_hash;
		expect(storedHash).toBeTruthy();
		expect(storedHash).not.toBe(validInput.password);
		expect(storedHash).toMatch(/^[^:]+:100000:[^:]+$/);
	});

	it("rejects duplicate username", async () => {
		await createUser(validInput);

		await expect(
			createUser({
				...validInput,
				email: "other@school.edu",
			}),
		).rejects.toBeInstanceOf(DuplicateUserError);
	});

	it("rejects duplicate email", async () => {
		await createUser(validInput);

		await expect(
			createUser({
				...validInput,
				username: "otheruser",
			}),
		).rejects.toBeInstanceOf(DuplicateUserError);
	});
});

describe("getUserByUsernameOrEmail", () => {
	beforeEach(async () => {
		await createUser(validInput);
	});

	it("finds user by username", async () => {
		const user = await getUserByUsernameOrEmail("jane");

		expect(user).toMatchObject({
			firstName: "Jane",
			lastName: "Smith",
			username: "jane",
			email: "jane@school.edu",
		});
		expect(user?.passwordHash).toMatch(/^[^:]+:100000:[^:]+$/);
	});

	it("finds user by email", async () => {
		const user = await getUserByUsernameOrEmail("jane@school.edu");

		expect(user).toMatchObject({
			firstName: "Jane",
			lastName: "Smith",
			username: "jane",
			email: "jane@school.edu",
		});
	});

	it("returns null for unknown identifier", async () => {
		const user = await getUserByUsernameOrEmail("nobody@school.edu");

		expect(user).toBeNull();
	});
});
