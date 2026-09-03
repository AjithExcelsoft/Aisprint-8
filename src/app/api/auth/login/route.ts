import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { validateLoginBody } from "@/lib/validations/auth";
import { getUserByUsernameOrEmail } from "@/lib/services/user-service";

const INVALID_CREDENTIALS = {
	error: "Invalid username/email or password",
};

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

	const validation = validateLoginBody(body);
	if (!validation.success) {
		return NextResponse.json(
			{ error: "Validation failed", details: validation.details },
			{ status: 400 },
		);
	}

	const user = await getUserByUsernameOrEmail(validation.data.usernameOrEmail);
	const passwordMatches =
		user !== null &&
		(await verifyPassword(validation.data.password, user.passwordHash));

	if (!passwordMatches) {
		return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
	}

	return NextResponse.json({ success: true, redirect: "/mcq" }, { status: 200 });
}
