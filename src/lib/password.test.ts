import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

const PLAIN_PASSWORD = "SecurePass123";

describe("hashPassword", () => {
	it("returns a string in {salt}:{iterations}:{hash} format", async () => {
		const stored = await hashPassword(PLAIN_PASSWORD);
		const parts = stored.split(":");

		expect(parts).toHaveLength(3);
		expect(parts[1]).toBe("100000");
		expect(parts[0]?.length).toBeGreaterThan(0);
		expect(parts[2]?.length).toBeGreaterThan(0);
	});

	it("produces different output for the same input", async () => {
		const first = await hashPassword(PLAIN_PASSWORD);
		const second = await hashPassword(PLAIN_PASSWORD);

		expect(first).not.toBe(second);
	});

	it("does not return the plaintext password", async () => {
		const stored = await hashPassword(PLAIN_PASSWORD);

		expect(stored).not.toBe(PLAIN_PASSWORD);
		expect(stored).not.toContain(PLAIN_PASSWORD);
	});
});

describe("verifyPassword", () => {
	it("returns true for the correct password", async () => {
		const stored = await hashPassword(PLAIN_PASSWORD);

		expect(await verifyPassword(PLAIN_PASSWORD, stored)).toBe(true);
	});

	it("returns false for an incorrect password", async () => {
		const stored = await hashPassword(PLAIN_PASSWORD);

		expect(await verifyPassword("WrongPassword123", stored)).toBe(false);
	});
});
