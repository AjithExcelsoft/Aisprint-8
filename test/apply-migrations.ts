import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

beforeAll(async () => {
	if (env.TEST_MIGRATIONS.length > 0) {
		await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	}
});

beforeEach(async () => {
	// Delete in FK-safe order: attempts → choices → mcqs, then users
	for (const table of ["attempts", "choices", "mcqs", "users"] as const) {
		try {
			await env.DB.prepare(`DELETE FROM ${table}`).run();
		} catch {
			// Table may not exist before its migration is added
		}
	}
});
