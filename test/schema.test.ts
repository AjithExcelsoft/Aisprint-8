import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const REQUIRED_COLUMNS = [
	"id",
	"first_name",
	"last_name",
	"username",
	"email",
	"password_hash",
	"created_at",
] as const;

describe("users table schema", () => {
	it("exists after migrations are applied", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
		).all<{ name: string }>();

		expect(result.results).toEqual([{ name: "users" }]);
	});

	it("has all required columns", async () => {
		const result = await env.DB.prepare("PRAGMA table_info(users)").all<{
			name: string;
		}>();

		const columnNames = result.results.map((column) => column.name);
		for (const column of REQUIRED_COLUMNS) {
			expect(columnNames).toContain(column);
		}
	});

	it("enforces unique username", async () => {
		await env.DB.prepare(
			`INSERT INTO users (first_name, last_name, username, email, password_hash)
			 VALUES (?1, ?2, ?3, ?4, ?5)`,
		)
			.bind("Jane", "Smith", "jane", "jane@school.edu", "hash1")
			.run();

		await expect(
			env.DB.prepare(
				`INSERT INTO users (first_name, last_name, username, email, password_hash)
				 VALUES (?1, ?2, ?3, ?4, ?5)`,
			)
				.bind("John", "Doe", "jane", "john@school.edu", "hash2")
				.run(),
		).rejects.toThrow();
	});

	it("enforces unique email", async () => {
		await env.DB.prepare(
			`INSERT INTO users (first_name, last_name, username, email, password_hash)
			 VALUES (?1, ?2, ?3, ?4, ?5)`,
		)
			.bind("Jane", "Smith", "jane2", "shared@school.edu", "hash1")
			.run();

		await expect(
			env.DB.prepare(
				`INSERT INTO users (first_name, last_name, username, email, password_hash)
				 VALUES (?1, ?2, ?3, ?4, ?5)`,
			)
				.bind("John", "Doe", "john2", "shared@school.edu", "hash2")
				.run(),
		).rejects.toThrow();
	});

	it("auto-generates id on insert", async () => {
		const result = await env.DB.prepare(
			`INSERT INTO users (first_name, last_name, username, email, password_hash)
			 VALUES (?1, ?2, ?3, ?4, ?5)
			 RETURNING id`,
		)
			.bind("Auto", "User", "autouser", "auto@school.edu", "hash")
			.all<{ id: string }>();

		const id = result.results[0]?.id;
		expect(id).toBeTruthy();
		expect(typeof id).toBe("string");
		expect(id!.length).toBeGreaterThan(0);
	});
});
