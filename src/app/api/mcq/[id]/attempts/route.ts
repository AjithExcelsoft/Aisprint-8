import { NextResponse } from "next/server";
import {
	InvalidChoiceError,
	McqNotFoundError,
	recordAttempt,
} from "@/lib/services/mcq-service";
import { validateAttemptBody } from "@/lib/validations/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Validation failed", details: ["Invalid JSON body"] },
			{ status: 400 },
		);
	}

	const validation = validateAttemptBody(body);
	if (!validation.success) {
		return NextResponse.json(
			{ error: "Validation failed", details: validation.details },
			{ status: 400 },
		);
	}

	try {
		const { id } = await context.params;
		const attempt = await recordAttempt(id, validation.data.choiceId);

		return NextResponse.json(
			{
				success: true,
				data: {
					id: attempt.id,
					mcqId: attempt.mcqId,
					choiceId: attempt.choiceId,
					isCorrect: attempt.isCorrect,
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ error: "MCQ not found" }, { status: 404 });
		}

		if (error instanceof InvalidChoiceError) {
			return NextResponse.json(
				{ error: "Choice does not belong to this MCQ" },
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
