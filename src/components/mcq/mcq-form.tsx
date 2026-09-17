"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	createEmptyChoices,
	type ChoiceDraft,
	type McqDetail,
} from "@/components/mcq/types";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_CHOICES, MIN_CHOICES } from "@/lib/validations/mcq";

type McqFormProps = {
	mode: "create" | "edit";
	mcqId?: string;
	initial?: McqDetail;
};

function toDrafts(initial?: McqDetail): ChoiceDraft[] {
	if (!initial?.choices.length) {
		return createEmptyChoices(MIN_CHOICES);
	}

	return initial.choices.map((choice) => ({
		key: choice.id,
		label: choice.label,
		isCorrect: choice.isCorrect,
	}));
}

export function McqForm({ mode, mcqId, initial }: McqFormProps) {
	const router = useRouter();
	const [name, setName] = useState(initial?.name ?? "");
	const [description, setDescription] = useState(initial?.description ?? "");
	const [choices, setChoices] = useState<ChoiceDraft[]>(() =>
		toDrafts(initial),
	);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	function updateChoice(key: string, patch: Partial<ChoiceDraft>) {
		setChoices((current) =>
			current.map((choice) =>
				choice.key === key ? { ...choice, ...patch } : choice,
			),
		);
	}

	function markCorrect(key: string) {
		setChoices((current) =>
			current.map((choice) => ({
				...choice,
				isCorrect: choice.key === key,
			})),
		);
	}

	function addChoice() {
		if (choices.length >= MAX_CHOICES) {
			return;
		}

		setChoices((current) => [
			...current,
			{
				key: `choice-${current.length + 1}-${crypto.randomUUID()}`,
				label: "",
				isCorrect: false,
			},
		]);
	}

	function removeChoice(key: string) {
		if (choices.length <= MIN_CHOICES) {
			return;
		}

		setChoices((current) => {
			const next = current.filter((choice) => choice.key !== key);
			if (!next.some((choice) => choice.isCorrect) && next[0]) {
				next[0] = { ...next[0], isCorrect: true };
			}
			return next;
		});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const payload = {
			name: name.trim(),
			description: description.trim(),
			choices: choices.map((choice) => ({
				label: choice.label.trim(),
				isCorrect: choice.isCorrect,
			})),
		};

		if (!payload.name || !payload.description) {
			setError("Name and description are required.");
			return;
		}

		if (
			payload.choices.length < MIN_CHOICES ||
			payload.choices.length > MAX_CHOICES
		) {
			setError(`Provide between ${MIN_CHOICES} and ${MAX_CHOICES} choices.`);
			return;
		}

		if (payload.choices.some((choice) => !choice.label)) {
			setError("Each choice needs a label.");
			return;
		}

		if (payload.choices.filter((choice) => choice.isCorrect).length !== 1) {
			setError("Mark exactly one choice as correct.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(
				mode === "create" ? "/api/mcq" : `/api/mcq/${mcqId}`,
				{
					method: mode === "create" ? "POST" : "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				},
			);

			const data = (await response.json()) as {
				error?: string;
				details?: string[];
				data?: { redirect?: string };
			};

			if (!response.ok) {
				if (response.status === 400 && data.details?.length) {
					setError(data.details.join(" "));
					return;
				}

				setError(data.error ?? "Failed to save question.");
				return;
			}

			router.push(data.data?.redirect ?? "/mcq");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>
					{mode === "create" ? "Create question" : "Edit question"}
				</CardTitle>
				<CardDescription>
					Provide a name, description, and {MIN_CHOICES}–{MAX_CHOICES} choices
					with exactly one correct answer.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-6">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="name">Name</FieldLabel>
							<Input
								id="name"
								name="name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
								maxLength={200}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="description">Description</FieldLabel>
							<Textarea
								id="description"
								name="description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								required
								maxLength={2000}
							/>
						</Field>

						<div className="space-y-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-medium">Choices</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={addChoice}
									disabled={choices.length >= MAX_CHOICES}
								>
									Add choice
								</Button>
							</div>

							{choices.map((choice, index) => (
								<div
									key={choice.key}
									className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
								>
									<label className="flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="correctChoice"
											checked={choice.isCorrect}
											onChange={() => markCorrect(choice.key)}
											className="size-4"
										/>
										<span className="whitespace-nowrap">Correct</span>
									</label>
									<Input
										aria-label={`Choice ${index + 1}`}
										value={choice.label}
										onChange={(event) =>
											updateChoice(choice.key, {
												label: event.target.value,
											})
										}
										placeholder={`Choice ${index + 1}`}
										required
										maxLength={500}
										className="flex-1"
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => removeChoice(choice.key)}
										disabled={choices.length <= MIN_CHOICES}
									>
										Remove
									</Button>
								</div>
							))}
						</div>

						{error ? <FieldError>{error}</FieldError> : null}

						<div className="flex flex-wrap gap-2">
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Saving..." : "Save"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => router.push("/mcq")}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
