import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
	...nextCoreWebVitals,
	...nextTypescript,
	{
		ignores: [
			"node_modules/**",
			".next/**",
			".open-next/**",
			"out/**",
			"build/**",
			"next-env.d.ts",
			"cloudflare-env.d.ts",
		],
	},
	{
		files: ["**/*.test.ts"],
		languageOptions: {
			globals: {
				describe: "readonly",
				it: "readonly",
				expect: "readonly",
				vi: "readonly",
				beforeAll: "readonly",
				beforeEach: "readonly",
				afterAll: "readonly",
				afterEach: "readonly",
			},
		},
	},
];

export default eslintConfig;
