import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	assertValidMcqInput,
	type ChoiceInput,
	type CreateMcqInput,
	type UpdateMcqInput,
} from "@/lib/validations/mcq";

export type { ChoiceInput, CreateMcqInput, UpdateMcqInput };

export type ChoiceRecord = {
	id: string;
	mcqId: string;
	label: string;
	isCorrect: boolean;
	position: number;
	createdAt: string;
};

export type McqRecord = {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	updatedAt: string;
};

export type McqWithChoices = McqRecord & {
	choices: ChoiceRecord[];
};

export type AttemptRecord = {
	id: string;
	mcqId: string;
	choiceId: string;
	isCorrect: boolean;
	createdAt: string;
};

export class InvalidMcqInputError extends Error {
	constructor(message = "Invalid MCQ input") {
		super(message);
		this.name = "InvalidMcqInputError";
	}
}

export class McqNotFoundError extends Error {
	constructor(message = "MCQ not found") {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export class InvalidChoiceError extends Error {
	constructor(message = "Choice does not belong to this MCQ") {
		super(message);
		this.name = "InvalidChoiceError";
	}
}

type McqRow = {
	id: string;
	name: string;
	description: string;
	created_at: string;
	updated_at: string;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	label: string;
	is_correct: number;
	position: number;
	created_at: string;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	choice_id: string;
	is_correct: number;
	created_at: string;
};

async function getDb() {
	const { env } = await getCloudflareContext();
	return env.DB;
}

function mapMcqRow(row: McqRow): McqRecord {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mapChoiceRow(row: ChoiceRow): ChoiceRecord {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		label: row.label,
		isCorrect: row.is_correct === 1,
		position: row.position,
		createdAt: row.created_at,
	};
}

function mapAttemptRow(row: AttemptRow): AttemptRecord {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		choiceId: row.choice_id,
		isCorrect: row.is_correct === 1,
		createdAt: row.created_at,
	};
}

function ensureValidInput(input: CreateMcqInput): void {
	try {
		assertValidMcqInput(input);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Invalid MCQ input";
		throw new InvalidMcqInputError(message);
	}
}

async function loadChoicesForMcq(
	db: D1Database,
	mcqId: string,
): Promise<ChoiceRecord[]> {
	const result = await db
		.prepare(
			`SELECT id, mcq_id, label, is_correct, position, created_at
			 FROM choices
			 WHERE mcq_id = ?1
			 ORDER BY position ASC`,
		)
		.bind(mcqId)
		.all<ChoiceRow>();

	return result.results.map(mapChoiceRow);
}

async function insertChoices(
	db: D1Database,
	mcqId: string,
	choices: ChoiceInput[],
): Promise<void> {
	for (let index = 0; index < choices.length; index += 1) {
		const choice = choices[index]!;
		await db
			.prepare(
				`INSERT INTO choices (mcq_id, label, is_correct, position)
				 VALUES (?1, ?2, ?3, ?4)`,
			)
			.bind(mcqId, choice.label, choice.isCorrect ? 1 : 0, index + 1)
			.run();
	}
}

export async function createMcq(
	input: CreateMcqInput,
): Promise<McqWithChoices> {
	ensureValidInput(input);

	const db = await getDb();
	const result = await db
		.prepare(
			`INSERT INTO mcqs (name, description)
			 VALUES (?1, ?2)
			 RETURNING id, name, description, created_at, updated_at`,
		)
		.bind(input.name, input.description)
		.all<McqRow>();

	const row = result.results[0];
	if (!row) {
		throw new Error("Failed to create MCQ");
	}

	await insertChoices(db, row.id, input.choices);
	const choices = await loadChoicesForMcq(db, row.id);

	return {
		...mapMcqRow(row),
		choices,
	};
}

export async function listMcqs(): Promise<McqRecord[]> {
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, name, description, created_at, updated_at
			 FROM mcqs
			 ORDER BY updated_at DESC`,
		)
		.all<McqRow>();

	return result.results.map(mapMcqRow);
}

export async function getMcqById(
	id: string,
): Promise<McqWithChoices | null> {
	const db = await getDb();
	const result = await db
		.prepare(
			`SELECT id, name, description, created_at, updated_at
			 FROM mcqs
			 WHERE id = ?1`,
		)
		.bind(id)
		.all<McqRow>();

	const row = result.results[0];
	if (!row) {
		return null;
	}

	const choices = await loadChoicesForMcq(db, row.id);
	return {
		...mapMcqRow(row),
		choices,
	};
}

export async function updateMcq(
	id: string,
	input: UpdateMcqInput,
): Promise<McqWithChoices> {
	ensureValidInput(input);

	const db = await getDb();
	const existing = await getMcqById(id);
	if (!existing) {
		throw new McqNotFoundError();
	}

	await db
		.prepare(
			`UPDATE mcqs
			 SET name = ?1,
			     description = ?2,
			     updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?3`,
		)
		.bind(input.name, input.description, id)
		.run();

	await db.prepare("DELETE FROM choices WHERE mcq_id = ?1").bind(id).run();
	await insertChoices(db, id, input.choices);

	const updated = await getMcqById(id);
	if (!updated) {
		throw new McqNotFoundError();
	}

	return updated;
}

export async function deleteMcq(id: string): Promise<boolean> {
	const db = await getDb();
	const existing = await getMcqById(id);
	if (!existing) {
		return false;
	}

	await db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id).run();
	return true;
}

export async function recordAttempt(
	mcqId: string,
	choiceId: string,
): Promise<AttemptRecord> {
	const db = await getDb();

	const mcq = await getMcqById(mcqId);
	if (!mcq) {
		throw new McqNotFoundError();
	}

	const choiceResult = await db
		.prepare(
			`SELECT id, mcq_id, label, is_correct, position, created_at
			 FROM choices
			 WHERE id = ?1`,
		)
		.bind(choiceId)
		.all<ChoiceRow>();

	const choiceRow = choiceResult.results[0];
	if (!choiceRow || choiceRow.mcq_id !== mcqId) {
		throw new InvalidChoiceError();
	}

	const insertResult = await db
		.prepare(
			`INSERT INTO attempts (mcq_id, choice_id, is_correct)
			 VALUES (?1, ?2, ?3)
			 RETURNING id, mcq_id, choice_id, is_correct, created_at`,
		)
		.bind(mcqId, choiceId, choiceRow.is_correct)
		.all<AttemptRow>();

	const attemptRow = insertResult.results[0];
	if (!attemptRow) {
		throw new Error("Failed to record attempt");
	}

	return mapAttemptRow(attemptRow);
}
