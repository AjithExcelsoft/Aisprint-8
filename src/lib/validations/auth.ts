import type { CreateUserInput } from "@/lib/services/user-service";

type ValidationSuccess<T> = {
	success: true;
	data: T;
};

type ValidationFailure = {
	success: false;
	details: string[];
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._@-]{3,100}$/;

export type RegisterBody = CreateUserInput;

export type LoginBody = {
	usernameOrEmail: string;
	password: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
	value: unknown,
	fieldName: string,
	details: string[],
): string | null {
	if (typeof value !== "string") {
		details.push(`${fieldName} is required`);
		return null;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		details.push(`${fieldName} is required`);
		return null;
	}

	return trimmed;
}

export function validateRegisterBody(
	body: unknown,
): ValidationResult<RegisterBody> {
	const details: string[] = [];

	if (!isRecord(body)) {
		return { success: false, details: ["Request body must be a JSON object"] };
	}

	const firstName = readString(body.firstName, "firstName", details);
	const lastName = readString(body.lastName, "lastName", details);
	const username = readString(body.username, "username", details);
	const email = readString(body.email, "email", details);
	const password = readString(body.password, "password", details);

	if (firstName && (firstName.length < 1 || firstName.length > 100)) {
		details.push("firstName must be between 1 and 100 characters");
	}

	if (lastName && (lastName.length < 1 || lastName.length > 100)) {
		details.push("lastName must be between 1 and 100 characters");
	}

	if (username && !USERNAME_PATTERN.test(username)) {
		details.push(
			"username must be 3-100 characters and contain only letters, numbers, and . _ @ -",
		);
	}

	if (email && !EMAIL_PATTERN.test(email)) {
		details.push("email must be a valid email address");
	}

	if (password && password.length < 8) {
		details.push("password must be at least 8 characters");
	}

	if (details.length > 0) {
		return { success: false, details };
	}

	return {
		success: true,
		data: {
			firstName: firstName!,
			lastName: lastName!,
			username: username!,
			email: email!,
			password: password!,
		},
	};
}

export function validateLoginBody(body: unknown): ValidationResult<LoginBody> {
	const details: string[] = [];

	if (!isRecord(body)) {
		return { success: false, details: ["Request body must be a JSON object"] };
	}

	const usernameOrEmail = readString(
		body.usernameOrEmail,
		"usernameOrEmail",
		details,
	);
	const password = readString(body.password, "password", details);

	if (password && password.length < 8) {
		details.push("password must be at least 8 characters");
	}

	if (details.length > 0) {
		return { success: false, details };
	}

	return {
		success: true,
		data: {
			usernameOrEmail: usernameOrEmail!,
			password: password!,
		},
	};
}
