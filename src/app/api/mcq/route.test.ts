import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import { createMcq } from "@/lib/services/mcq-service";
import { GET, POST } from "./route";

const validBody = {
	name: "Photosynthesis basics",
	description: "Which organelle performs photosynthesis?",
	choices: [
		{ label: "Mitochondria", isCorrect: false },
		{ label: "Chloroplast", isCorrect: true },
	],
};

function postRequest(body: unknown) {
	return POST(
		new Request("http://localhost/api/mcq", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

describe("GET /api/mcq", () => {
	it("returns an empty list when no MCQs exist", async () => {
		const response = await GET();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			data: [],
		});
	});

	it("returns listed MCQs without choices", async () => {
		const created = await createMcq(validBody);

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.data).toEqual([
			expect.objectContaining({
				id: created.id,
				name: validBody.name,
				description: validBody.description,
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			}),
		]);
		expect(body.data[0]).not.toHaveProperty("choices");
	});
});

describe("POST /api/mcq", () => {
	it("returns 201 with id and redirect on success", async () => {
		const response = await postRequest(validBody);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({
			success: true,
			data: {
				id: expect.any(String),
				redirect: "/mcq",
			},
		});

		const row = await env.DB.prepare("SELECT name FROM mcqs WHERE id = ?1")
			.bind(body.data.id)
			.all<{ name: string }>();
		expect(row.results[0]?.name).toBe(validBody.name);
	});

	it("returns 400 for invalid body", async () => {
		const response = await postRequest({
			name: "",
			description: "Missing choices",
			choices: [{ label: "Only one", isCorrect: true }],
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Validation failed");
		expect(body.details).toEqual(expect.any(Array));
		expect(body.details.length).toBeGreaterThan(0);
	});

	it("returns 400 for invalid JSON", async () => {
		const response = await POST(
			new Request("http://localhost/api/mcq", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{not-json",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Validation failed",
			details: ["Invalid JSON body"],
		});
	});
});
