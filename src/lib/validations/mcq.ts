export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;

export type ChoiceInput = {
	label: string;
	isCorrect: boolean;
};

export type CreateMcqInput = {
	name: string;
	description: string;
	choices: ChoiceInput[];
};

export type UpdateMcqInput = CreateMcqInput;

type ValidationSuccess<T> = {
	success: true;
	data: T;
};

type ValidationFailure = {
	success: false;
	details: string[];
};

export type McqValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

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

function validateChoices(
	choicesValue: unknown,
	details: string[],
): ChoiceInput[] | null {
	if (!Array.isArray(choicesValue)) {
		details.push("choices must be an array");
		return null;
	}

	if (
		choicesValue.length < MIN_CHOICES ||
		choicesValue.length > MAX_CHOICES
	) {
		details.push(
			`choices must contain between ${MIN_CHOICES} and ${MAX_CHOICES} items`,
		);
	}

	const choices: ChoiceInput[] = [];

	for (let index = 0; index < choicesValue.length; index += 1) {
		const item = choicesValue[index];
		if (!isRecord(item)) {
			details.push(`choices[${index}] must be an object`);
			continue;
		}

		const label = readString(item.label, `choices[${index}].label`, details);
		if (typeof item.isCorrect !== "boolean") {
			details.push(`choices[${index}].isCorrect must be a boolean`);
			continue;
		}

		if (label) {
			if (label.length > 500) {
				details.push(`choices[${index}].label must be at most 500 characters`);
			}

			choices.push({
				label,
				isCorrect: item.isCorrect,
			});
		}
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (choices.length >= MIN_CHOICES && correctCount !== 1) {
		details.push("exactly one choice must be marked correct");
	}

	if (details.length > 0) {
		return null;
	}

	return choices;
}

/**
 * Validates create/update MCQ payloads for the service and API layers.
 */
export function validateMcqInput(body: unknown): McqValidationResult<CreateMcqInput> {
	const details: string[] = [];

	if (!isRecord(body)) {
		return { success: false, details: ["Request body must be a JSON object"] };
	}

	const name = readString(body.name, "name", details);
	const description = readString(body.description, "description", details);

	if (name && name.length > 200) {
		details.push("name must be at most 200 characters");
	}

	if (description && description.length > 2000) {
		details.push("description must be at most 2000 characters");
	}

	const choices = validateChoices(body.choices, details);

	if (details.length > 0 || !name || !description || !choices) {
		return { success: false, details };
	}

	return {
		success: true,
		data: {
			name,
			description,
			choices,
		},
	};
}

export type AttemptBody = {
	choiceId: string;
};

/**
 * Validates POST /api/mcq/[id]/attempts request bodies.
 */
export function validateAttemptBody(
	body: unknown,
): McqValidationResult<AttemptBody> {
	const details: string[] = [];

	if (!isRecord(body)) {
		return { success: false, details: ["Request body must be a JSON object"] };
	}

	const choiceId = readString(body.choiceId, "choiceId", details);

	if (details.length > 0 || !choiceId) {
		return { success: false, details };
	}

	return {
		success: true,
		data: { choiceId },
	};
}

/**
 * Asserts an already-typed CreateMcqInput meets business rules.
 * Used by McqService when callers pass typed objects (e.g. tests).
 */
export function assertValidMcqInput(input: CreateMcqInput): void {
	const result = validateMcqInput(input);
	if (!result.success) {
		throw new Error(result.details.join("; "));
	}
}
