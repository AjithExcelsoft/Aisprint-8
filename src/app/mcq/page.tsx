import { McqList } from "@/components/mcq/mcq-list";
import { listMcqs } from "@/lib/services/mcq-service";

export const dynamic = "force-dynamic";

export default async function McqPage() {
	const items = await listMcqs();

	return (
		<div className="flex min-h-svh w-full items-start justify-center p-6 md:p-10">
			<div className="w-full max-w-5xl">
				<McqList items={items} />
			</div>
		</div>
	);
}
