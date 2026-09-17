import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({ env })),
}));

import { createMcq } from "@/lib/services/mcq-service";
import { DELETE, GET, PUT } from "./route";

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

function putRequest(id: string, body: unknown) {
	return PUT(
		new Request(`http://localhost/api/mcq/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		params(id),
	);
}

describe("GET /api/mcq/[id]", () => {
	it("returns the MCQ with choices", async () => {
		const created = await createMcq(validBody);

		const response = await GET(
			new Request(`http://localhost/api/mcq/${created.id}`),
			params(created.id),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.data).toMatchObject({
			id: created.id,
			name: validBody.name,
			description: validBody.description,
		});
		expect(body.data.choices).toHaveLength(2);
		expect(body.data.choices[1]).toMatchObject({
			label: "Chloroplast",
			isCorrect: true,
			position: 2,
		});
	});

	it("returns 404 when MCQ does not exist", async () => {
		const response = await GET(
			new Request("http://localhost/api/mcq/missing"),
			params("missing"),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "MCQ not found" });
	});
});

describe("PUT /api/mcq/[id]", () => {
	it("returns 200 with id and redirect on success", async () => {
		const created = await createMcq(validBody);

		const response = await putRequest(created.id, {
			name: "Updated name",
			description: "Updated description",
			choices: [
				{ label: "A", isCorrect: false },
				{ label: "B", isCorrect: true },
				{ label: "C", isCorrect: false },
			],
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			success: true,
			data: {
				id: created.id,
				redirect: "/mcq",
			},
		});

		const row = await env.DB.prepare(
			"SELECT name, description FROM mcqs WHERE id = ?1",
		)
			.bind(created.id)
			.all<{ name: string; description: string }>();
		expect(row.results[0]).toEqual({
			name: "Updated name",
			description: "Updated description",
		});
	});

	it("returns 400 for invalid body", async () => {
		const created = await createMcq(validBody);

		const response = await putRequest(created.id, {
			name: "Bad",
			description: "No correct choice",
			choices: [
				{ label: "A", isCorrect: false },
				{ label: "B", isCorrect: false },
			],
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Validation failed");
	});

	it("returns 404 when MCQ does not exist", async () => {
		const response = await putRequest("missing", validBody);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "MCQ not found" });
	});
});

describe("DELETE /api/mcq/[id]", () => {
	it("returns 200 and removes the MCQ", async () => {
		const created = await createMcq(validBody);

		const response = await DELETE(
			new Request(`http://localhost/api/mcq/${created.id}`, {
				method: "DELETE",
			}),
			params(created.id),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });

		const row = await env.DB.prepare("SELECT id FROM mcqs WHERE id = ?1")
			.bind(created.id)
			.all();
		expect(row.results).toEqual([]);
	});

	it("returns 404 when MCQ does not exist", async () => {
		const response = await DELETE(
			new Request("http://localhost/api/mcq/missing", { method: "DELETE" }),
			params("missing"),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "MCQ not found" });
	});
});
