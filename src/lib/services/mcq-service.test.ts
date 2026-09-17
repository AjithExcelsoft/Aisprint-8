import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import {
	createMcq,
	deleteMcq,
	getMcqById,
	InvalidChoiceError,
	InvalidMcqInputError,
	listMcqs,
	McqNotFoundError,
	recordAttempt,
	updateMcq,
	type CreateMcqInput,
} from "./mcq-service";

const twoChoices: CreateMcqInput = {
	name: "Photosynthesis basics",
	description: "Which organelle performs photosynthesis?",
	choices: [
		{ label: "Mitochondria", isCorrect: false },
		{ label: "Chloroplast", isCorrect: true },
	],
};

function buildChoices(
	count: number,
	correctIndex = 0,
): CreateMcqInput["choices"] {
	return Array.from({ length: count }, (_, index) => ({
		label: `Choice ${index + 1}`,
		isCorrect: index === correctIndex,
	}));
}

describe("createMcq", () => {
	it("inserts an MCQ with 2 choices and returns ids", async () => {
		const mcq = await createMcq(twoChoices);

		expect(mcq).toMatchObject({
			id: expect.any(String),
			name: twoChoices.name,
			description: twoChoices.description,
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
		});
		expect(mcq.choices).toHaveLength(2);
		expect(mcq.choices[0]).toMatchObject({
			id: expect.any(String),
			mcqId: mcq.id,
			label: "Mitochondria",
			isCorrect: false,
			position: 1,
		});
		expect(mcq.choices[1]).toMatchObject({
			id: expect.any(String),
			mcqId: mcq.id,
			label: "Chloroplast",
			isCorrect: true,
			position: 2,
		});
	});

	it("allows up to 6 choices", async () => {
		const mcq = await createMcq({
			name: "Six options",
			description: "Pick one of six",
			choices: buildChoices(6, 2),
		});

		expect(mcq.choices).toHaveLength(6);
		expect(mcq.choices.map((choice) => choice.position)).toEqual([
			1, 2, 3, 4, 5, 6,
		]);
		expect(mcq.choices[2]?.isCorrect).toBe(true);
	});

	it("rejects fewer than 2 choices", async () => {
		await expect(
			createMcq({
				name: "Too few",
				description: "Only one choice",
				choices: [{ label: "Only", isCorrect: true }],
			}),
		).rejects.toBeInstanceOf(InvalidMcqInputError);
	});

	it("rejects more than 6 choices", async () => {
		await expect(
			createMcq({
				name: "Too many",
				description: "Seven choices",
				choices: buildChoices(7),
			}),
		).rejects.toBeInstanceOf(InvalidMcqInputError);
	});

	it("rejects zero correct choices", async () => {
		await expect(
			createMcq({
				name: "No correct",
				description: "Missing answer",
				choices: [
					{ label: "A", isCorrect: false },
					{ label: "B", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(InvalidMcqInputError);
	});

	it("rejects multiple correct choices", async () => {
		await expect(
			createMcq({
				name: "Two correct",
				description: "Ambiguous",
				choices: [
					{ label: "A", isCorrect: true },
					{ label: "B", isCorrect: true },
				],
			}),
		).rejects.toBeInstanceOf(InvalidMcqInputError);
	});
});

describe("listMcqs", () => {
	it("returns created rows ordered by updated_at descending", async () => {
		const first = await createMcq({
			...twoChoices,
			name: "Older question",
		});
		const second = await createMcq({
			name: "Newer question",
			description: "Second question",
			choices: buildChoices(2),
		});

		// Bump updated_at on the older row so ordering is deterministic
		await env.DB.prepare(
			`UPDATE mcqs
			 SET updated_at = datetime('now', '+1 second')
			 WHERE id = ?1`,
		)
			.bind(first.id)
			.run();

		const listed = await listMcqs();

		expect(listed.map((row) => row.id)).toEqual([first.id, second.id]);
		expect(listed[0]).toMatchObject({
			id: first.id,
			name: "Older question",
			description: twoChoices.description,
		});
		expect(listed[0]).not.toHaveProperty("choices");
	});
});

describe("getMcqById", () => {
	it("returns MCQ with choices ordered by position", async () => {
		const created = await createMcq({
			name: "Ordered choices",
			description: "Check position order",
			choices: [
				{ label: "First", isCorrect: false },
				{ label: "Second", isCorrect: true },
				{ label: "Third", isCorrect: false },
			],
		});

		const found = await getMcqById(created.id);

		expect(found).not.toBeNull();
		expect(found?.choices.map((choice) => choice.label)).toEqual([
			"First",
			"Second",
			"Third",
		]);
		expect(found?.choices.map((choice) => choice.position)).toEqual([1, 2, 3]);
	});

	it("returns null for unknown id", async () => {
		const found = await getMcqById("does-not-exist");

		expect(found).toBeNull();
	});
});

describe("updateMcq", () => {
	it("updates name, description, choices and refreshes updated_at", async () => {
		const created = await createMcq(twoChoices);

		await env.DB.prepare(
			`UPDATE mcqs
			 SET updated_at = datetime('now', '-1 day')
			 WHERE id = ?1`,
		)
			.bind(created.id)
			.run();

		const before = await env.DB.prepare(
			"SELECT updated_at FROM mcqs WHERE id = ?1",
		)
			.bind(created.id)
			.all<{ updated_at: string }>();

		const updated = await updateMcq(created.id, {
			name: "Updated name",
			description: "Updated description",
			choices: [
				{ label: "New A", isCorrect: false },
				{ label: "New B", isCorrect: false },
				{ label: "New C", isCorrect: true },
			],
		});

		expect(updated).toMatchObject({
			id: created.id,
			name: "Updated name",
			description: "Updated description",
		});
		expect(updated.choices).toHaveLength(3);
		expect(updated.choices.map((choice) => choice.label)).toEqual([
			"New A",
			"New B",
			"New C",
		]);
		expect(updated.updatedAt).not.toBe(before.results[0]?.updated_at);

		const remainingOldChoices = await env.DB.prepare(
			"SELECT id FROM choices WHERE mcq_id = ?1 AND label IN (?2, ?3)",
		)
			.bind(created.id, "Mitochondria", "Chloroplast")
			.all();

		expect(remainingOldChoices.results).toEqual([]);
	});

	it("throws McqNotFoundError for unknown id", async () => {
		await expect(updateMcq("missing", twoChoices)).rejects.toBeInstanceOf(
			McqNotFoundError,
		);
	});
});

describe("deleteMcq", () => {
	it("removes MCQ and cascaded choices and attempts", async () => {
		const created = await createMcq(twoChoices);
		const correctChoice = created.choices.find((choice) => choice.isCorrect);
		expect(correctChoice).toBeTruthy();

		await recordAttempt(created.id, correctChoice!.id);

		const deleted = await deleteMcq(created.id);
		expect(deleted).toBe(true);

		expect(await getMcqById(created.id)).toBeNull();

		const choices = await env.DB.prepare(
			"SELECT id FROM choices WHERE mcq_id = ?1",
		)
			.bind(created.id)
			.all();
		const attempts = await env.DB.prepare(
			"SELECT id FROM attempts WHERE mcq_id = ?1",
		)
			.bind(created.id)
			.all();

		expect(choices.results).toEqual([]);
		expect(attempts.results).toEqual([]);
	});

	it("returns false when MCQ does not exist", async () => {
		const deleted = await deleteMcq("missing-id");

		expect(deleted).toBe(false);
	});
});

describe("recordAttempt", () => {
	let mcqId: string;
	let correctChoiceId: string;
	let incorrectChoiceId: string;

	beforeEach(async () => {
		const created = await createMcq(twoChoices);
		mcqId = created.id;
		correctChoiceId = created.choices.find((choice) => choice.isCorrect)!.id;
		incorrectChoiceId = created.choices.find((choice) => !choice.isCorrect)!.id;
	});

	it("stores an attempt with isCorrect true for the correct choice", async () => {
		const attempt = await recordAttempt(mcqId, correctChoiceId);

		expect(attempt).toMatchObject({
			id: expect.any(String),
			mcqId,
			choiceId: correctChoiceId,
			isCorrect: true,
			createdAt: expect.any(String),
		});
	});

	it("stores an attempt with isCorrect false for an incorrect choice", async () => {
		const attempt = await recordAttempt(mcqId, incorrectChoiceId);

		expect(attempt).toMatchObject({
			mcqId,
			choiceId: incorrectChoiceId,
			isCorrect: false,
		});
	});

	it("rejects a choice that does not belong to the MCQ", async () => {
		const other = await createMcq({
			name: "Other",
			description: "Other question",
			choices: buildChoices(2),
		});

		await expect(
			recordAttempt(mcqId, other.choices[0]!.id),
		).rejects.toBeInstanceOf(InvalidChoiceError);
	});

	it("throws McqNotFoundError for unknown mcq id", async () => {
		await expect(
			recordAttempt("missing-mcq", correctChoiceId),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});
});
