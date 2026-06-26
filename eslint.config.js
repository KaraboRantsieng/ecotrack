import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

export default [
  // Ignore generated / third-party files
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/components/ui/**",   // shadcn/ui — auto-generated, don't lint
      "server.js",
    ],
  },
  // JS / JSX files in the app
  {
    files: ["src/**/*.{js,mjs,jsx}", "src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    ...pluginJs.configs.recommended,
  },
  {
    files: ["src/**/*.{js,mjs,jsx}"],
    ...pluginReact.configs.flat.recommended,
    settings: { react: { version: "detect" } },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",              // globals handled above
      "react/prop-types": "off",      // we don't use prop-types
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
