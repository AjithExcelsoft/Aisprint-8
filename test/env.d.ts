/// <reference types="@cloudflare/vitest-plugin/types" />

declare module "cloudflare:test" {
	interface ProvidedEnv {
		DB: D1Database;
		TEST_MIGRATIONS: import("@cloudflare/vitest-plugin").D1Migration[];
	}
}
