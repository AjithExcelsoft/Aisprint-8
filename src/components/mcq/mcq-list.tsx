"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { McqRowActions } from "@/components/mcq/mcq-row-actions";
import { formatDateTime, type McqListItem } from "@/components/mcq/types";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type McqListProps = {
	items: McqListItem[];
};

export function McqList({ items }: McqListProps) {
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	async function handleLogout() {
		setIsLoggingOut(true);

		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			const data = (await response.json()) as { redirect?: string };

			if (response.ok) {
				router.push(data.redirect ?? "/login");
			}
		} finally {
			setIsLoggingOut(false);
		}
	}

	return (
		<Card className="w-full">
			<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1.5">
					<CardTitle>MCQ Test Bank</CardTitle>
					<CardDescription>
						Create, edit, preview, and delete multiple-choice questions.
					</CardDescription>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button type="button" render={<Link href="/mcq/create" />}>
						Create
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleLogout}
						disabled={isLoggingOut}
					>
						{isLoggingOut ? "Logging out..." : "Logout"}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{items.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No questions yet. Click Create to add your first MCQ.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Created</TableHead>
								<TableHead>Updated</TableHead>
								<TableHead className="w-12 text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<TableRow key={item.id}>
									<TableCell className="max-w-48 truncate font-medium whitespace-normal">
										{item.name}
									</TableCell>
									<TableCell className="max-w-md truncate whitespace-normal">
										{item.description}
									</TableCell>
									<TableCell>{formatDateTime(item.createdAt)}</TableCell>
									<TableCell>{formatDateTime(item.updatedAt)}</TableCell>
									<TableCell className="text-right">
										<McqRowActions
											mcqId={item.id}
											mcqName={item.name}
											onDeleted={() => router.refresh()}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
