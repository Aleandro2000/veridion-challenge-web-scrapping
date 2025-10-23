import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-inline-comments": "error",
      "@typescript-eslint/no-explicit-any": "error",
      quotes: ["error", "double"],
    },
  },
  tseslint.configs.recommended,
]);