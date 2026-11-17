# Code Review Checklist

This is the team's Definition of Done as a review checklist. Human reviewers use it, and the
automated Claude review (`.github/workflows/claude-review.yml`) reads it on every PR.

Items marked **(human)** can't be checked from the diff, so the author or a reviewer has to confirm them.

## Code

- [ ] Meets the task's acceptance criteria
- [ ] **(human)** Verified by someone other than the author
- [ ] Passes ESLint/Prettier (`npm run lint`) with no new warnings
- [ ] No debug code (`console.log`, `debugger`, temporary alerts)
- [ ] No commented-out blocks of code
- [ ] No hardcoded test values (fake IDs, sample coordinates, test URLs left in app code)
- [ ] No secrets in code (API keys, tokens, passwords, connection strings), including `.env` files

## Testing

- [ ] New logic has unit tests in `tests/`
- [ ] Tests include at least one edge case or failure case, not just the happy path
- [ ] **(human)** All tests pass locally (`npm test`)
- [ ] **(human)** Checked on mobile

## Review & Integration

- [ ] **(human)** Approved by at least one teammate

## Documentation

- [ ] **(human)** Time spent on the task is recorded
- [ ] README updated for new setup steps, dependencies, or env vars
- [ ] Non-obvious code has a short comment explaining why
- [ ] Visual changes have a screenshot attached in the PR description
