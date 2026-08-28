# Contributing

Thanks for contributing to `@nubisco/cms-core`, the framework-agnostic core of the Nubisco CMS client.

## Local Setup

```bash
git clone https://github.com/nubisco/cms-core.git
cd cms-core
pnpm install
```

## Development Commands

```bash
pnpm run types:check
pnpm run check:core
pnpm run check:esm
pnpm run build
```

## Before Opening a Pull Request

- `master` is protected: work on a branch and open a PR.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org). The
  release is cut automatically from them, so the prefix decides the version:
  `fix:` is a patch, `feat:` is a minor, and a `!` or a `BREAKING CHANGE:` footer
  is a major. Do not mark something breaking unless a consumer has to change code.
- The build must pass. It runs the guards as well as the compiler.

## Guards, and why they exist

Both are wired into `build`, so neither can be skipped:

- **`check-no-framework` / `check-core-boundary`** keeps the core free of any UI
  framework. That separation is what makes a future `@nubisco/cms-react`
  possible without forking the link, image and richtext models.
- **`check-esm`** loads the built output the way a consumer will. Version 0.1.0
  of `@nubisco/cms-core` built clean, typechecked clean, and still crashed on
  import with `ERR_UNSUPPORTED_DIR_IMPORT`, because a bundler resolves an
  extensionless relative import and Node does not. A library that compiles is
  not necessarily a library that loads.

## Reporting Security Issues

See [SECURITY.md](./SECURITY.md). Please do not open a public issue first.
