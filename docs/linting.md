# SnackAttack Linting Standard

## Selected linter

SnackAttack uses **ESLint 9** for JavaScript source-code quality checks. ESLint was selected because the application is browser-based JavaScript, ESLint is widely used in JavaScript projects, and it integrates directly with local development and GitHub Actions.

## Standards enforced

The repository treats the following as lint failures:

- undefined variables (`no-undef`)
- unused variables (`no-unused-vars`)
- unreachable code (`no-unreachable`)
- constant loop/condition mistakes (`no-constant-condition`)
- non-strict equality instead of `===` / `!==` (`eqeqeq`)
- mutable declarations that can be `const` (`prefer-const`)
- missing braces around multiline control flow (`curly`)

Configuration is stored in `eslint.config.mjs`.

## Local usage

Install the pinned development dependencies once:

```bash
npm install
```

Run the quality check:

```bash
npm run quality
```

Run ESLint directly:

```bash
npm run lint
```

Allow ESLint to fix safe automatic issues:

```bash
npm run lint:fix
```

A clean run exits with status code `0`. A lint error exits non-zero and prints the filename, line, column, rule, and error message. This makes failures visible both locally and in CI.

## Pull-request workflow

`.github/workflows/quality.yml` runs `npm install` followed by `npm run quality` for pull requests targeting `main` or `dev`. The GitHub Actions job is named **ESLint**.

To make linting mandatory before merge, configure the GitHub branch-protection rule for `main` and require the **ESLint** status check. The workflow is already in the repository; branch protection is a repository setting and cannot be encoded into the source tree itself.
