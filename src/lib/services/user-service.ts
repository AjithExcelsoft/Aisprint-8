import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hashPassword } from "@/lib/password";

export type UserRecord = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
	createdAt: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	password: string;
};

export class DuplicateUserError extends Error {
	constructor(message = "Username or email already in use") {
		super(message);
		this.name = "DuplicateUserError";
	}
}

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
};

async function getDb() {
	const { env } = await getCloudflareContext();
	return env.DB;
}

function mapUserRow(row: UserRow): UserRecord {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		passwordHash: row.password_hash,
		createdAt: row.created_at,
	};
}

function isUniqueConstraintError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return error.message.includes("UNIQUE constraint failed");
}

export async function createUser(
	input: CreateUserInput,
): Promise<Omit<UserRecord, "passwordHash">> {
	const db = await getDb();
	const passwordHash = await hashPassword(input.password);

	try {
		const result = await db
			.prepare(
				`INSERT INTO users (first_name, last_name, username, email, password_hash)
				 VALUES (?1, ?2, ?3, ?4, ?5)
				 RETURNING id, first_name, last_name, username, email, created_at`,
			)
			.bind(
				input.firstName,
				input.lastName,
				input.username,
				input.email,
				passwordHash,
			)
			.all<Omit<UserRow, "password_hash">>();

		const row = result.results[0];
		if (!row) {
			throw new Error("Failed to create user");
		}

		return {
			id: row.id,
			firstName: row.first_name,
			lastName: row.last_name,
			username: row.username,
			email: row.email,
			createdAt: row.created_at,
		};
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			throw new DuplicateUserError();
		}

		throw error;
	}
}

export async function getUserByUsernameOrEmail(
	identifier: string,
): Promise<UserRecord | null> {
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, first_name, last_name, username, email, password_hash, created_at
			 FROM users
			 WHERE username = ?1 OR email = ?1`,
		)
		.bind(identifier)
		.all<UserRow>();

	const row = result.results[0];
	return row ? mapUserRow(row) : null;
}
