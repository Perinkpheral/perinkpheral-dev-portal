# Test plan for an unattended agent: perinkpheral-dev-portal

This plan is for a coding agent that works alone for one or two days. Each task is small
and stands alone. Do the tasks in order. Finish one task, write its report, then start the
next.

## Rules

- Do not change `src/`, `scripts/` or `assets/`. You may add tests under
  `tests/agent/` only.
- Do not commit, push, tag or open pull requests.
- Never connect to a real board. The flasher tests use the fakes in `tests/helpers/`.
- Do not fix a bug you find. Report it.
- After each task, append its report to `REPORT.md` in the report folder you were given.
  If no folder was given, use `tests/agent/REPORT.md`.

## Report format, for every finding

```
### <task number>.<finding number> <one-line title>
File: <path>:<line>
Input: <the smallest input>
What happens: <wrong result / exception / bytes written that should not be>
Expected: <what the code or README.md promises>
How to reproduce: <one command>
```

## Install the toolchain first

There is no device. Everything runs on this computer, in the simulator. Install these
before any task, and check each with the command after it:

- Git: `git --version`.
- Java 21 or later (Temurin is fine): `java -version`.
- A C compiler. Fuzzing additionally requires Clang with libFuzzer.
  Check: `<compiler> --version`.
- wasi-sdk 34 from https://github.com/WebAssembly/wasi-sdk/releases (the archive for this
  computer's system and processor). Unpack it and `export WASI_SDK_PATH=<its folder>`.
  Check: `$WASI_SDK_PATH/bin/clang --version`.
- Python 3.12 or later: `python3 --version`.
- Node.js 22 and npm: `node --version`.
- ffmpeg: `ffmpeg -version`.
- Optional, for checks that match the Linux CI: Docker with the `gcc:14` image.

ESP-IDF is not needed: nothing here builds or flashes device firmware.

Get the repositories side by side in one folder, from https://github.com/Perinkpheral:
`perinkpheral-os`, `perinkpheral-apps`, `perinkpheral-hacs`, `perinkpheral-dev-portal`,
`perinkpheral-clion-plugin`. The tools find each other as siblings.

Then build the tools and the simulator once and run an application in it:

```sh
cd perinkpheral-os
tools/perinkpheral                        # builds the Kotlin tools on first use, prints the commands
make -C firmware/test/host test           # host tests; needs WASI_SDK_PATH
tools/perinkpheral sim-test firmware/test/sim
tools/perinkpheral sim sdk/apps/hello     # the simulator with one application; stop it with Ctrl-C
```

All four must work before Task 1. If one fails, write the exact error into the report and
stop: do not change the repository to make it pass.

## Setup

```sh
npm ci
npm test
npm run test:browser
```

Both must pass before you start. Read `src/content/flashPlan.ts`, `flashSession.ts`,
`flashRead.ts`, the page `src/pages/Flash.tsx` and their tests in `tests/`.

## Task 1. The flasher refuses every wrong file set before writing

The flasher must refuse, before it erases or writes anything, any file set that is not
exactly a supported layout. Write property tests in `tests/agent/flashPlan.prop.test.mjs`
(plain `node:test`, random inputs from a seeded generator, at least 100 000 cases):

1. Start from the valid fixtures (fresh install new and old, Keep data, debug). Change one
   thing at random: a path, an offset, a size, one byte of the OTA journal, one byte of
   the partition table, a missing part, an extra part, a duplicate part.
2. Expected: every changed set is refused, and the unchanged ones are accepted.
3. Report any changed set that is accepted, with the change.

## Task 2. Write order and interruption

Using the fakes of the serial port:

1. Interrupt the session at every step (connect, read, erase, each write, reset). The
   page must show an error and must never claim success.
2. Check that validation always happens before the first erase or write.

## Task 3. Pages in both languages

With Playwright (`tests/browser`):

1. Open every page in English and Russian at widths 360, 768 and 1440. Report text that
   overflows its box, overlaps other text, or is untranslated (English words on a
   Russian page other than names).
2. Follow every internal link; report 404s.

## When all tasks are done

Write a short summary at the top of `REPORT.md`. Then stop.
