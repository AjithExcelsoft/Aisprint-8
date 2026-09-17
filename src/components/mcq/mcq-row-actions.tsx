"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type McqRowActionsProps = {
	mcqId: string;
	mcqName: string;
	onDeleted: () => void;
};

export function McqRowActions({
	mcqId,
	mcqName,
	onDeleted,
}: McqRowActionsProps) {
	const router = useRouter();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleDelete() {
		setIsDeleting(true);
		setError(null);

		try {
			const response = await fetch(`/api/mcq/${mcqId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				setError(data.error ?? "Failed to delete question.");
				return;
			}

			setDeleteOpen(false);
			onDeleted();
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={`Actions for ${mcqName}`}
						/>
					}
				>
					<MoreHorizontalIcon />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-36">
					<DropdownMenuItem
						onClick={() => router.push(`/mcq/${mcqId}/edit`)}
					>
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => router.push(`/mcq/${mcqId}/preview`)}
					>
						Preview
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setDeleteOpen(true)}
					>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className="sm:max-w-md" showCloseButton={!isDeleting}>
					<DialogHeader>
						<DialogTitle>Delete question?</DialogTitle>
						<DialogDescription>
							This permanently deletes &quot;{mcqName}&quot; and its choices
							and attempts.
						</DialogDescription>
					</DialogHeader>
					{error ? (
						<p className="text-sm text-destructive">{error}</p>
					) : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDeleteOpen(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
