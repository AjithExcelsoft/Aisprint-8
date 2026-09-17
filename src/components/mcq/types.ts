export type McqListItem = {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	updatedAt: string;
};

export type McqChoice = {
	id: string;
	mcqId: string;
	label: string;
	isCorrect: boolean;
	position: number;
	createdAt: string;
};

export type McqDetail = McqListItem & {
	choices: McqChoice[];
};

export type ChoiceDraft = {
	key: string;
	label: string;
	isCorrect: boolean;
};

export function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
}

export function createEmptyChoices(count = 2): ChoiceDraft[] {
	return Array.from({ length: count }, (_, index) => ({
		key: `choice-${index + 1}-${crypto.randomUUID()}`,
		label: "",
		isCorrect: index === 0,
	}));
}
