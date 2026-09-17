"use client";

import Link from "next/link";
import { useState } from "react";
import type { McqDetail } from "@/components/mcq/types";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";

type McqPreviewProps = {
	mcq: McqDetail;
};

export function McqPreview({ mcq }: McqPreviewProps) {
	const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
	const [result, setResult] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setResult(null);

		if (!selectedChoiceId) {
			setError("Select a choice before submitting.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/mcq/${mcq.id}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId: selectedChoiceId }),
			});

			const data = (await response.json()) as {
				error?: string;
				details?: string[];
				data?: { isCorrect?: boolean };
			};

			if (!response.ok) {
				if (response.status === 400 && data.details?.length) {
					setError(data.details.join(" "));
					return;
				}

				setError(data.error ?? "Failed to record attempt.");
				return;
			}

			setResult(Boolean(data.data?.isCorrect));
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>{mcq.name}</CardTitle>
				<CardDescription>{mcq.description}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						{mcq.choices.map((choice) => (
							<label
								key={choice.id}
								className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
							>
								<input
									type="radio"
									name="previewChoice"
									value={choice.id}
									checked={selectedChoiceId === choice.id}
									onChange={() => {
										setSelectedChoiceId(choice.id);
										setResult(null);
									}}
									className="size-4"
								/>
								<span>{choice.label}</span>
							</label>
						))}
					</div>

					{error ? <FieldError>{error}</FieldError> : null}

					{result !== null ? (
						<p
							className={
								result
									? "text-sm font-medium text-green-700 dark:text-green-400"
									: "text-sm font-medium text-destructive"
							}
						>
							{result ? "Correct" : "Incorrect"}
						</p>
					) : null}

					<div className="flex flex-wrap gap-2">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Checking..." : "Submit answer"}
						</Button>
						<Button type="button" variant="outline" render={<Link href="/mcq" />}>
							Back
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
