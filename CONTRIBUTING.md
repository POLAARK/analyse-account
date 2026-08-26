# Contributing

## Standard

Every change must be understandable from the diff, justified by evidence, and safe to revert.
Small does not mean incomplete; clever does not mean maintainable.

1. Open a focused issue or describe the observable problem and acceptance criteria.
2. Keep one concern per pull request. Explain risks, alternatives, and migration impact.
3. Add a regression test for behavior changes. Keep default tests deterministic and offline.
4. Run `npm run check` and `npm run check:generated`.
5. Review the lockfile, generated files, error paths, precision, and secret exposure.
6. Require human review and passing required checks before merge. Do not force-push reviewed work.

Use Conventional Commit subjects where practical (`fix:`, `feat:`, `refactor:`, `docs:`, `chore:`).
Commits should build independently and explain why, not narrate editing steps.

## Guardrail design

`AGENTS.md` is the single canonical AI instruction file; mechanically enforceable rules belong in
Biome, TypeScript, tests, and CI rather than repeated prose. Local hooks are intentionally omitted:
CI is the merge boundary and cannot be bypassed accidentally.

The policy follows primary guidance from:

- [AGENTS.md specification](https://agents.md/)
- [OpenAI Codex repository instructions](https://developers.openai.com/codex/agent-configuration/agents-md)
- [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
- [Anthropic Claude Code memory](https://docs.anthropic.com/en/docs/claude-code/memory)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Biome](https://biomejs.dev/guides/getting-started/)

Repository administrators should protect `main`: require pull requests, this repository's CI check,
one approving review, conversation resolution, linear history, and blocked force pushes/deletions.
Enable GitHub secret scanning with push protection and CodeQL default setup where available.
