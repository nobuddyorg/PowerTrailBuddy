# Contributing to PowerTrailBuddy

## No outside contributions

PowerTrailBuddy is a personal hobby project. I don't accept pull requests,
issues or feature requests from outside the project; they are closed without
review.

Want to change something? **Fork it.** There is no support for forks; the
[developer guide](docs/how-to/developer-guide.md) covers setting one up with
its own Pages site.

The rest of this guide is how the project itself is worked on; it applies
equally to a fork.

## Prerequisites

- **Node.js 22** — CI pins 22.x.
- Nothing else. There is no backend, no database and no credential to set up.

## Run it locally

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

To try it, choose **Try with sample data** (invented caches, served from
`web/public/sample/`), or import a Pocket Query `.zip` or `.gpx` of your own.
Never commit a real Pocket Query.

## Commit hooks

[prek](https://github.com/j178/prek) runs [`.pre-commit-config.yaml`](.pre-commit-config.yaml)
on every commit; `pre-commit` reads the same file:

- file hygiene, `typos`, `markdownlint`;
- gitleaks over the staged changes;
- `zizmor` and `actionlint` over `.github/`;
- lockfile-lint on `web/package-lock.json`: every package from
  `registry.npmjs.org`, over HTTPS, with an integrity hash;
- the same format/lint/type/architecture/dead-code checks CI runs in `web/`.

```bash
prek install           # once
prek run --all-files   # everything, without committing
```

## Before opening a pull request

From `web/`, in this order — `build` generates `next-env.d.ts`, which `tsc`
and ESLint need:

```bash
npm run build
npx tsc --noEmit
npx prettier --check .
npm run lint
npm run depcruise
npm run knip
npm test -- --coverage
npm run e2e
```

These are CI's `build_and_test` and `e2e` jobs. `npm run test:mutation` (CI's
`mutation_test`) is required when you changed code in a file listed in
`web/mutation-targets.mjs`; comments produce no new mutants.

The [developer guide](docs/how-to/developer-guide.md) has what each one reads
and how to interpret a failure. On a PR, CI skips jobs whose paths did not
change; the local list above is not conditional.

## What a pull request says

- **A UI change** ships an end-to-end case for its journey; **a functional
  change** ships a unit test; a parser or geometry change a property test
  where one is easy to state. Which layer proves what:
  [TEST_STRATEGY.md](TEST_STRATEGY.md).
- **Anything that changes what the app stores or contacts** says so, and
  updates [architecture.md](docs/reference/architecture.md#storage) and the
  [user guide](docs/how-to/user-guide.md). Sending user data anywhere is ruled
  out ([CLAUDE.md](CLAUDE.md)).
- **A deliberate trade-off** — the obvious version over an abstraction, a
  suppression with its reason — is named, not left for review to find.

Never lower a coverage or mutation threshold to get to green, and never
commit to `main` — the hook blocks it, and `--no-verify` is not the answer.
