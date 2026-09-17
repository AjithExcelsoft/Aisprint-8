"use client";

import Link from "next/link";
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
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LoginFormProps = React.ComponentProps<"div">;

export function LoginForm({ className, ...props }: LoginFormProps) {
	const router = useRouter();
	const [usernameOrEmail, setUsernameOrEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ usernameOrEmail, password }),
			});

			const data = (await response.json()) as {
				error?: string;
				details?: string[];
				redirect?: string;
			};

			if (!response.ok) {
				if (response.status === 400 && data.details?.length) {
					setError(data.details.join(" "));
					return;
				}

				setError(data.error ?? "Invalid username/email or password");
				return;
			}

			router.push(data.redirect ?? "/mcq");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your username or email and password to continue
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="usernameOrEmail">
									Username or Email
								</FieldLabel>
								<Input
									id="usernameOrEmail"
									name="usernameOrEmail"
									type="text"
									autoComplete="username"
									placeholder="jane or jane@school.edu"
									value={usernameOrEmail}
									onChange={(event) =>
										setUsernameOrEmail(event.target.value)
									}
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input
									id="password"
									name="password"
									type="password"
									autoComplete="current-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
								/>
							</Field>
							{error ? (
								<FieldError>{error}</FieldError>
							) : null}
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Logging in..." : "Login"}
								</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account?{" "}
									<Link href="/register">Register</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
