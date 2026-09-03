import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		cloudflareTest(async () => {
			const migrationsPath = path.join(rootDir, "migrations");
			const migrations = await readD1Migrations(migrationsPath).catch(
				() => [],
			);

			return {
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					d1Databases: ["DB"],
					bindings: { TEST_MIGRATIONS: migrations },
				},
			};
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(rootDir, "src"),
		},
	},
	test: {
		include: ["src/**/*.test.ts", "test/**/*.test.ts"],
		setupFiles: ["./test/apply-migrations.ts"],
		passWithNoTests: true,
	},
});
