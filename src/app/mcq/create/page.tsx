import { McqForm } from "@/components/mcq/mcq-form";

export default function McqCreatePage() {
	return (
		<div className="flex min-h-svh w-full items-start justify-center p-6 md:p-10">
			<div className="w-full max-w-2xl">
				<McqForm mode="create" />
			</div>
		</div>
	);
}
