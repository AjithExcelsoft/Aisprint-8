"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function McqPlaceholder() {
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
		<Card>
			<CardHeader>
				<CardTitle>MCQ Test Bank</CardTitle>
				<CardDescription>
					Multiple-choice question features coming soon.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					type="button"
					variant="outline"
					onClick={handleLogout}
					disabled={isLoggingOut}
				>
					{isLoggingOut ? "Logging out..." : "Logout"}
				</Button>
			</CardContent>
		</Card>
	);
}
