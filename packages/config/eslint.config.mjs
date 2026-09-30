import eslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

/**
 * M1 bans raw values in component code. The Color Theme layer
 * (src/themes.ts) is the one place color values live (configuration.md §2),
 * and tests may construct fixtures for the law gates.
 */
const noRawColors = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "Literal[value=/#[0-9a-fA-F]{6}\\b/]",
      message: "No raw colors outside the Color Theme layer (M1).",
    },
  ],
};

export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["src/themes.ts", "src/**/*.test.ts"],
    languageOptions: { parser, parserOptions: { sourceType: "module" } },
    plugins: { "@typescript-eslint": eslint },
    rules: {
      ...eslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      ...noRawColors,
    },
  },
  {
    files: ["src/themes.ts", "src/**/*.test.ts"],
    languageOptions: { parser, parserOptions: { sourceType: "module" } },
    plugins: { "@typescript-eslint": eslint },
    rules: {
      ...eslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
