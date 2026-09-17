import { NextResponse } from "next/server";
import {
	deleteMcq,
	getMcqById,
	McqNotFoundError,
	updateMcq,
} from "@/lib/services/mcq-service";
import { validateMcqInput } from "@/lib/validations/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const mcq = await getMcqById(id);

		if (!mcq) {
			return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true, data: mcq }, { status: 200 });
	} catch {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request, context: RouteContext) {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Validation failed", details: ["Invalid JSON body"] },
			{ status: 400 },
		);
	}

	const validation = validateMcqInput(body);
	if (!validation.success) {
		return NextResponse.json(
			{ error: "Validation failed", details: validation.details },
			{ status: 400 },
		);
	}

	try {
		const { id } = await context.params;
		const mcq = await updateMcq(id, validation.data);

		return NextResponse.json(
			{
				success: true,
				data: {
					id: mcq.id,
					redirect: "/mcq",
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const deleted = await deleteMcq(id);

		if (!deleted) {
			return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
