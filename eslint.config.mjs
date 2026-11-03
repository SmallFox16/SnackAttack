export default [
  {
    files: ["**/*.js", "**/*.mjs"],
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
        navigator: "readonly",
        URL: "readonly"
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
    // forum.js builds form submissions and reads ?machine= from the page URL
    files: ["forum.js"],
    languageOptions: {
      globals: {
        FormData: "readonly",
        URLSearchParams: "readonly",
        window: "readonly"
      }
    }
  },
  {
    // Server code (Vercel Function) and its unit tests run in Node with web-standard Request/Response
    files: ["api/**/*.mjs", "reports-api.mjs", "tests/**/*.test.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        File: "readonly",
        FormData: "readonly",
        Request: "readonly",
        Response: "readonly",
        crypto: "readonly",
        process: "readonly"
      }
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
    // distance.js and the Node unit tests (*.test.js) are CommonJS;
    // other files in tests/ (e.g. Playwright *.spec.js) stay ES modules
    files: ["distance.js", "tests/**/*.test.js"],
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
