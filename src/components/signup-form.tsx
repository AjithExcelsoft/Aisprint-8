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

const USERNAME_PATTERN = /^[a-zA-Z0-9._@-]{3,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const router = useRouter();
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	function validateClient(): string | null {
		if (!firstName.trim() || !lastName.trim()) {
			return "First name and last name are required.";
		}

		if (!USERNAME_PATTERN.test(username.trim())) {
			return "Username must be 3-100 characters and contain only letters, numbers, and . _ @ -";
		}

		if (!EMAIL_PATTERN.test(email.trim())) {
			return "Please enter a valid email address.";
		}

		if (password.length < 8) {
			return "Password must be at least 8 characters.";
		}

		if (password !== confirmPassword) {
			return "Passwords do not match.";
		}

		return null;
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const clientError = validateClient();
		if (clientError) {
			setError(clientError);
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					username: username.trim(),
					email: email.trim(),
					password,
				}),
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

				setError(data.error ?? "Registration failed. Please try again.");
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
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>
					Enter your information below to create your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="firstName">First Name</FieldLabel>
							<Input
								id="firstName"
								name="firstName"
								type="text"
								autoComplete="given-name"
								placeholder="Jane"
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="lastName">Last Name</FieldLabel>
							<Input
								id="lastName"
								name="lastName"
								type="text"
								autoComplete="family-name"
								placeholder="Smith"
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="username">Username</FieldLabel>
							<Input
								id="username"
								name="username"
								type="text"
								autoComplete="username"
								placeholder="jane.smith"
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								required
							/>
							<FieldDescription>
								Your username may be an email address.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								placeholder="m@example.com"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
							/>
							<FieldDescription>
								Must be at least 8 characters long.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm-password">
								Confirm Password
							</FieldLabel>
							<Input
								id="confirm-password"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								required
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
						</Field>
						{error ? <FieldError>{error}</FieldError> : null}
						<Field>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Creating account..." : "Create Account"}
							</Button>
							<FieldDescription className="px-6 text-center">
								Already have an account? <Link href="/login">Log in</Link>
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
