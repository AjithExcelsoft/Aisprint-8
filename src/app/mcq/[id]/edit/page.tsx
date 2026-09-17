import { McqForm } from "@/components/mcq/mcq-form";
import { getMcqById } from "@/lib/services/mcq-service";

export const dynamic = "force-dynamic";

type McqEditPageProps = {
	params: Promise<{ id: string }>;
};

export default async function McqEditPage({ params }: McqEditPageProps) {
	const { id } = await params;
	const mcq = await getMcqById(id);

	return (
		<div className="flex min-h-svh w-full items-start justify-center p-6 md:p-10">
			<div className="w-full max-w-2xl">
				{mcq ? (
					<McqForm mode="edit" mcqId={id} initial={mcq} />
				) : (
					<p className="text-sm text-destructive">MCQ not found</p>
				)}
			</div>
		</div>
	);
}
