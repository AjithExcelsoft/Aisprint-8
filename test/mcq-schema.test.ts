import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const MCQ_COLUMNS = [
	"id",
	"name",
	"description",
	"created_at",
	"updated_at",
] as const;

const CHOICE_COLUMNS = [
	"id",
	"mcq_id",
	"label",
	"is_correct",
	"position",
	"created_at",
] as const;

const ATTEMPT_COLUMNS = [
	"id",
	"mcq_id",
	"choice_id",
	"is_correct",
	"created_at",
] as const;

async function insertMcq(name = "Sample question", description = "What is 2+2?") {
	const result = await env.DB.prepare(
		`INSERT INTO mcqs (name, description)
		 VALUES (?1, ?2)
		 RETURNING id`,
	)
		.bind(name, description)
		.all<{ id: string }>();

	const id = result.results[0]?.id;
	expect(id).toBeTruthy();
	return id!;
}

async function insertChoice(
	mcqId: string,
	label: string,
	isCorrect: number,
	position: number,
) {
	const result = await env.DB.prepare(
		`INSERT INTO choices (mcq_id, label, is_correct, position)
		 VALUES (?1, ?2, ?3, ?4)
		 RETURNING id`,
	)
		.bind(mcqId, label, isCorrect, position)
		.all<{ id: string }>();

	const id = result.results[0]?.id;
	expect(id).toBeTruthy();
	return id!;
}

describe("mcqs table schema", () => {
	it("exists after migrations are applied", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcqs'",
		).all<{ name: string }>();

		expect(result.results).toEqual([{ name: "mcqs" }]);
	});

	it("has all required columns", async () => {
		const result = await env.DB.prepare("PRAGMA table_info(mcqs)").all<{
			name: string;
		}>();

		const columnNames = result.results.map((column) => column.name);
		for (const column of MCQ_COLUMNS) {
			expect(columnNames).toContain(column);
		}
	});

	it("auto-generates id on insert", async () => {
		const id = await insertMcq();
		expect(typeof id).toBe("string");
		expect(id.length).toBeGreaterThan(0);
	});

	it("sets created_at and updated_at on insert", async () => {
		const mcqId = await insertMcq();

		const result = await env.DB.prepare(
			"SELECT created_at, updated_at FROM mcqs WHERE id = ?1",
		)
			.bind(mcqId)
			.all<{ created_at: string; updated_at: string }>();

		const row = result.results[0];
		expect(row?.created_at).toBeTruthy();
		expect(row?.updated_at).toBeTruthy();
	});
});

describe("choices table schema", () => {
	it("exists after migrations are applied", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'choices'",
		).all<{ name: string }>();

		expect(result.results).toEqual([{ name: "choices" }]);
	});

	it("has all required columns", async () => {
		const result = await env.DB.prepare("PRAGMA table_info(choices)").all<{
			name: string;
		}>();

		const columnNames = result.results.map((column) => column.name);
		for (const column of CHOICE_COLUMNS) {
			expect(columnNames).toContain(column);
		}
	});

	it("links to mcqs via mcq_id foreign key", async () => {
		const mcqId = await insertMcq();
		const choiceId = await insertChoice(mcqId, "Four", 1, 1);

		const result = await env.DB.prepare(
			"SELECT mcq_id, label, is_correct, position FROM choices WHERE id = ?1",
		)
			.bind(choiceId)
			.all<{
				mcq_id: string;
				label: string;
				is_correct: number;
				position: number;
			}>();

		expect(result.results[0]).toEqual({
			mcq_id: mcqId,
			label: "Four",
			is_correct: 1,
			position: 1,
		});
	});

	it("rejects is_correct values outside 0 and 1", async () => {
		const mcqId = await insertMcq("Constraint check", "Pick one");

		await expect(
			env.DB.prepare(
				`INSERT INTO choices (mcq_id, label, is_correct, position)
				 VALUES (?1, ?2, ?3, ?4)`,
			)
				.bind(mcqId, "Invalid", 2, 1)
				.run(),
		).rejects.toThrow();
	});

	it("cascades delete when parent mcq is removed", async () => {
		const mcqId = await insertMcq("Cascade question", "Will be deleted");
		await insertChoice(mcqId, "Option A", 0, 1);
		await insertChoice(mcqId, "Option B", 1, 2);

		await env.DB.prepare("DELETE FROM mcqs WHERE id = ?1").bind(mcqId).run();

		const remaining = await env.DB.prepare(
			"SELECT id FROM choices WHERE mcq_id = ?1",
		)
			.bind(mcqId)
			.all();

		expect(remaining.results).toEqual([]);
	});
});

describe("attempts table schema", () => {
	it("exists after migrations are applied", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'attempts'",
		).all<{ name: string }>();

		expect(result.results).toEqual([{ name: "attempts" }]);
	});

	it("has all required columns", async () => {
		const result = await env.DB.prepare("PRAGMA table_info(attempts)").all<{
			name: string;
		}>();

		const columnNames = result.results.map((column) => column.name);
		for (const column of ATTEMPT_COLUMNS) {
			expect(columnNames).toContain(column);
		}
	});

	it("stores attempt result linked to mcq and choice", async () => {
		const mcqId = await insertMcq("Attempt question", "Select the answer");
		const choiceId = await insertChoice(mcqId, "Correct", 1, 1);

		const insertResult = await env.DB.prepare(
			`INSERT INTO attempts (mcq_id, choice_id, is_correct)
			 VALUES (?1, ?2, ?3)
			 RETURNING id, mcq_id, choice_id, is_correct`,
		)
			.bind(mcqId, choiceId, 1)
			.all<{
				id: string;
				mcq_id: string;
				choice_id: string;
				is_correct: number;
			}>();

		const attempt = insertResult.results[0];
		expect(attempt?.id).toBeTruthy();
		expect(attempt).toMatchObject({
			mcq_id: mcqId,
			choice_id: choiceId,
			is_correct: 1,
		});
	});

	it("rejects is_correct values outside 0 and 1", async () => {
		const mcqId = await insertMcq("Attempt constraint", "Select one");
		const choiceId = await insertChoice(mcqId, "A", 0, 1);

		await expect(
			env.DB.prepare(
				`INSERT INTO attempts (mcq_id, choice_id, is_correct)
				 VALUES (?1, ?2, ?3)`,
			)
				.bind(mcqId, choiceId, 5)
				.run(),
		).rejects.toThrow();
	});

	it("cascades delete when parent mcq is removed", async () => {
		const mcqId = await insertMcq("Attempt cascade", "Will be deleted");
		const choiceId = await insertChoice(mcqId, "A", 1, 1);

		await env.DB.prepare(
			`INSERT INTO attempts (mcq_id, choice_id, is_correct)
			 VALUES (?1, ?2, ?3)`,
		)
			.bind(mcqId, choiceId, 1)
			.run();

		await env.DB.prepare("DELETE FROM mcqs WHERE id = ?1").bind(mcqId).run();

		const remaining = await env.DB.prepare(
			"SELECT id FROM attempts WHERE mcq_id = ?1",
		)
			.bind(mcqId)
			.all();

		expect(remaining.results).toEqual([]);
	});
});

describe("mcq schema indexes", () => {
	it("defines expected indexes", async () => {
		const result = await env.DB.prepare(
			`SELECT name FROM sqlite_master
			 WHERE type = 'index'
			   AND name IN (
			     'idx_choices_mcq_id',
			     'idx_attempts_mcq_id',
			     'idx_attempts_choice_id',
			     'idx_mcqs_updated_at'
			   )
			 ORDER BY name`,
		).all<{ name: string }>();

		expect(result.results.map((row) => row.name)).toEqual([
			"idx_attempts_choice_id",
			"idx_attempts_mcq_id",
			"idx_choices_mcq_id",
			"idx_mcqs_updated_at",
		]);
	});
});
