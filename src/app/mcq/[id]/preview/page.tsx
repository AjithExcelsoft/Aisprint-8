import { McqPreview } from "@/components/mcq/mcq-preview";
import { getMcqById } from "@/lib/services/mcq-service";

export const dynamic = "force-dynamic";

type McqPreviewPageProps = {
	params: Promise<{ id: string }>;
};

export default async function McqPreviewPage({ params }: McqPreviewPageProps) {
	const { id } = await params;
	const mcq = await getMcqById(id);

	return (
		<div className="flex min-h-svh w-full items-start justify-center p-6 md:p-10">
			<div className="w-full max-w-2xl">
				{mcq ? (
					<McqPreview mcq={mcq} />
				) : (
					<p className="text-sm text-destructive">MCQ not found</p>
				)}
			</div>
		</div>
	);
}
