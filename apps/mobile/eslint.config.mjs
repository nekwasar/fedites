import eslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser, parserOptions: { sourceType: "module", ecmaFeatures: { jsx: true } } },
    plugins: { "@typescript-eslint": eslint },
    rules: {
      ...eslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{6}\\b/]",
          message: "No raw colors — read theme slots from session config (M1).",
        },
      ],
    },
  },
];
