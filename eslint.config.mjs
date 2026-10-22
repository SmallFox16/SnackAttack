export default [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        Map: "readonly",
        Number: "readonly",
        String: "readonly",
        L: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "multi-line"],
      "prefer-const": "error"
    }
  }
];
