import { NextResponse } from "next/server";
import { validateRegisterBody } from "@/lib/validations/auth";
import { createUser, DuplicateUserError } from "@/lib/services/user-service";

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

	const validation = validateRegisterBody(body);
	if (!validation.success) {
		return NextResponse.json(
			{ error: "Validation failed", details: validation.details },
			{ status: 400 },
		);
	}

	try {
		await createUser(validation.data);
		return NextResponse.json(
			{ success: true, redirect: "/mcq" },
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof DuplicateUserError) {
			return NextResponse.json(
				{ error: "Username or email already in use" },
				{ status: 409 },
			);
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
