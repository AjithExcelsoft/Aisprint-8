import { NextResponse } from "next/server";
import {
	createMcq,
	listMcqs,
} from "@/lib/services/mcq-service";
import { validateMcqInput } from "@/lib/validations/mcq";

export async function GET() {
	try {
		const data = await listMcqs();
		return NextResponse.json({ success: true, data }, { status: 200 });
	} catch {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
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
		const mcq = await createMcq(validation.data);
		return NextResponse.json(
			{
				success: true,
				data: {
					id: mcq.id,
					redirect: "/mcq",
				},
			},
			{ status: 201 },
		);
	} catch {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
