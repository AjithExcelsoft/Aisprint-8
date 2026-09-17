import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import { createMcq } from "@/lib/services/mcq-service";
import { POST } from "./route";

const validBody = {
	name: "Photosynthesis basics",
	description: "Which organelle performs photosynthesis?",
	choices: [
		{ label: "Mitochondria", isCorrect: false },
		{ label: "Chloroplast", isCorrect: true },
	],
};

function params(id: string) {
	return { params: Promise.resolve({ id }) };
}

function attemptRequest(mcqId: string, body: unknown) {
	return POST(
		new Request(`http://localhost/api/mcq/${mcqId}/attempts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		params(mcqId),
	);
}

describe("POST /api/mcq/[id]/attempts", () => {
	it("returns 201 with attempt result for a correct choice", async () => {
		const created = await createMcq(validBody);
		const correctChoice = created.choices.find((choice) => choice.isCorrect)!;

		const response = await attemptRequest(created.id, {
			choiceId: correctChoice.id,
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({
			success: true,
			data: {
				id: expect.any(String),
				mcqId: created.id,
				choiceId: correctChoice.id,
				isCorrect: true,
			},
		});

		const row = await env.DB.prepare(
			"SELECT is_correct FROM attempts WHERE id = ?1",
		)
			.bind(body.data.id)
			.all<{ is_correct: number }>();
		expect(row.results[0]?.is_correct).toBe(1);
	});

	it("returns 201 with isCorrect false for an incorrect choice", async () => {
		const created = await createMcq(validBody);
		const incorrectChoice = created.choices.find((choice) => !choice.isCorrect)!;

		const response = await attemptRequest(created.id, {
			choiceId: incorrectChoice.id,
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.data.isCorrect).toBe(false);
	});

	it("returns 400 when choiceId is missing", async () => {
		const created = await createMcq(validBody);

		const response = await attemptRequest(created.id, {});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Validation failed");
	});

	it("returns 400 when choice does not belong to the MCQ", async () => {
		const created = await createMcq(validBody);
		const other = await createMcq({
			name: "Other",
			description: "Other question",
			choices: [
				{ label: "A", isCorrect: true },
				{ label: "B", isCorrect: false },
			],
		});

		const response = await attemptRequest(created.id, {
			choiceId: other.choices[0]!.id,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Choice does not belong to this MCQ",
		});
	});

	it("returns 404 when MCQ does not exist", async () => {
		const response = await attemptRequest("missing", {
			choiceId: "any-choice",
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "MCQ not found" });
	});
});
