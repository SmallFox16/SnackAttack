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
        L: "readonly",
        navigator: "readonly"
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
  },
  {
    // app.js uses the helpers that distance.js defines as browser globals
    files: ["app.js"],
    languageOptions: {
      globals: {
        parseGPS: "readonly",
        calculateDistances: "readonly",
        formatDistance: "readonly"
      }
    }
  },
  {
    // distance.js and the tests are also loaded by Node as CommonJS
    files: ["distance.js", "tests/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "readonly",
        require: "readonly",
        Math: "readonly"
      }
    }
  }
];
