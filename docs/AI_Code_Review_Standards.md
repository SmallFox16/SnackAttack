# AI-Assisted Code Review Standards

## 1. Purpose

SnackAttack uses an AI code-review agent to provide an additional
quality check on pull requests. The agent is triggered automatically by
a GitHub Actions workflow and uses Claude Code to review the repository
and compare the proposed changes against the project's documented
Definition of Done.

The agent reports potential bugs through inline pull-request comments
and provides an overall bug summary.

AI review is part of the project's quality-assurance process. It does
**not** replace developer testing, linting, static analysis, or human
pull-request review. Developers remain responsible for the code they
submit and merge.

## 2. When the AI Reviewer Runs

-   The AI review is triggered by the GitHub Actions workflow when a
    pull request is opened or updated, according to the workflow's
    configured events.
-   The AI review runs alongside the project's linter and
    static-analysis checks.
-   The agent reviews the repository and uses the project's Definition
    of Done Markdown file as a reference when evaluating the changes.

Developers should check the pull-request results after the workflow
completes. If the workflow fails to run or produces no review, do not
assume the code passed AI review.

## 3. What the AI Reviewer Should Check

The AI reviewer should focus on potential bugs and whether the proposed
changes satisfy the relevant Definition of Done requirements.

Areas to consider include:

### Correctness and functionality

-   Logic errors, incorrect conditions, and likely runtime errors.
-   Broken or incomplete user interactions.
-   Incorrect handling of missing, empty, or unexpected data.
-   Problems with asynchronous requests or API responses.
-   Regressions to existing features such as machine search, filters,
    and map markers.

### Data handling and API use

-   Inconsistent machine or product data fields.
-   Unsafe assumptions about the structure or availability of returned
    data.
-   Missing validation of data received from an API or other external
    source.
-   Exposing credentials, tokens, or other sensitive information.

### Accessibility

-   Missing or unsuitable alternative text for meaningful images.
-   Controls that lack accessible names or labels.
-   Interactive elements that cannot be used with a keyboard.
-   Missing status announcements when dynamic content changes, where
    appropriate.
-   Changes that make information available visually but not to
    assistive technology.

### Security and reliability

-   Unsafe use of user-controlled or externally supplied data.
-   Potential injection or cross-site scripting issues.
-   Inadequate error handling for failed requests.
-   Changes that could expose private information or allow unintended
    modification of data.

### Project requirements and maintainability

-   Whether the change meets the relevant Definition of Done criteria.
-   Whether the implementation conflicts with existing project behavior
    or conventions.
-   Unnecessary complexity or duplicated logic when it creates a
    meaningful maintenance problem.

The agent should not invent requirements or recommend large refactors
unrelated to the pull request.

## 4. Standards for AI Review Comments

The agent's inline comments should identify specific potential bugs in
the relevant code. The overall summary should give developers a concise
view of the issues found across the pull request.

A useful finding should:

1.  Identify the relevant file and code section.
2.  Explain what may be wrong.
3.  Describe the likely consequence or user impact.
4.  Suggest a practical correction when possible.
5.  Indicate uncertainty when the issue cannot be confirmed from the
    available code.

The reviewer should distinguish between confirmed defects and possible
problems. It should not present speculative concerns as established bugs
or report stylistic preferences as functional defects.

## 5. How Developers Should Handle AI Findings

Developers must examine AI review comments before acting on them.

For each finding:

1.  **Verify it.** Inspect the relevant code and determine whether the
    issue is real.
2.  **Consider the impact.** Decide whether it affects functionality,
    security, accessibility, reliability, or a Definition of Done
    requirement.
3.  **Resolve or explain it.** Fix valid issues, or explain why a
    finding does not apply when appropriate.
4.  **Retest.** Run relevant tests and checks after making changes.

Do not automatically accept AI-generated suggestions or make changes
solely because the agent requested them. AI-generated fixes can
introduce new bugs, remove intended behavior, or conflict with project
requirements.

If a finding is incorrect, developers may dismiss it. A brief
explanation is useful when the finding is significant or another
reviewer may encounter it.

## 6. Relationship to Other Quality Checks

AI review is one part of the project's quality process:

-   **AI code review:** Looks for potential bugs and compares changes
    against the Definition of Done. Reports findings in the pull
    request.
-   **Linter:** Checks code against configured style and formatting
    rules.
-   **Static analysis:** Checks code for patterns or issues identified
    by the configured analysis tools.
-   **Human review:** Provides developer judgment, verifies
    requirements, and decides whether the change is ready to merge.
-   **Testing:** Confirms that the application and affected features
    behave as expected.

Passing one check does not guarantee that the code will pass the others.
For example, code can pass linting and static analysis while still
containing a functional bug.

## 7. Rules for the AI Agent

The AI reviewer should follow these standards:

-   Use the project's Definition of Done Markdown file as the reference
    for completion criteria.
-   Review proposed changes in the context of the existing repository.
-   Prioritize correctness, security, accessibility, and user impact
    over stylistic preferences.
-   Keep findings relevant to the pull request.
-   Avoid repeating the same finding in multiple comments.
-   Avoid flagging unchanged code unless it directly causes or
    materially contributes to a problem introduced by the change.
-   Do not invent project requirements, APIs, file contents, or test
    results.
-   Do not claim that tests or checks passed unless their results are
    available.
-   Do not approve or merge a pull request on behalf of the team.
-   Do not rewrite files or push changes unless the team has explicitly
    configured and authorized that behavior.
-   Keep comments concise and understandable to the development team.

## 8. Privacy and Safe Use

-   Never commit passwords, API keys, access tokens, or other secrets to
    the repository.
-   Do not intentionally include confidential or sensitive information
    in code or pull-request content submitted for AI review.
-   Use the project's configured Claude Code account and GitHub Actions
    integration; do not connect an unapproved personal account or
    alternate review service to the workflow.
-   Follow repository access permissions and the team's policies for use
    of AI services.
-   Treat AI output as untrusted until a developer has verified it.

## 9. Pull-Request Workflow

1.  Developer completes a change and performs relevant local checks.
2.  Developer opens or updates a pull request.
3.  GitHub Actions triggers the AI review, linter, and static-analysis
    checks.
4.  The AI agent reviews the repository and compares the changes with
    the Definition of Done.
5.  The agent posts inline comments for potential bugs and an overall
    bug summary.
6.  Developer reviews the comments, fixes valid issues, and explains or
    dismisses incorrect findings as appropriate.
7.  Developer reruns relevant checks after making changes.
8.  A teammate performs the normal human review.
9.  The team follows its usual pull-request approval and merge process.

## 10. Definition of Done for AI-Assisted Review

The AI-assisted review is complete when:

-   The GitHub Actions review workflow has run for the pull request.
-   The agent has produced its inline findings and overall summary, if
    any issues were identified.
-   A developer has reviewed the findings.
-   Valid issues have been fixed or explicitly accounted for.
-   Relevant tests and quality checks have been rerun after changes.
-   Normal teammate review and project merge requirements have been
    satisfied.

An empty AI review or a lack of inline comments should not be treated as
proof that the code is bug-free.

## 11. Core Principle

**The AI agent advises; the development team decides.** The agent helps
identify potential problems, but the team remains responsible for the
correctness, security, accessibility, and quality of all code merged
into SnackAttack.
