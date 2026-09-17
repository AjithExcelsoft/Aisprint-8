import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

beforeAll(async () => {
	if (env.TEST_MIGRATIONS.length > 0) {
		await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	}
});

beforeEach(async () => {
	try {
		await env.DB.prepare("DELETE FROM users").run();
	} catch {
		// Table may not exist before Phase 1 migration is added
	}
});
