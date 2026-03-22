import type { CommandResult, GhCommandRunner } from "./types.ts";

export function createGhCommandRunner(): GhCommandRunner {
  return async (args, options) => {
    const child = Bun.spawn({
      cmd: ["gh", ...args],
      stdin: options?.stdin ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });

    if (options?.stdin) {
      await child.stdin?.write(options.stdin);
      await child.stdin?.end();
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    return {
      stdout,
      stderr,
      exitCode,
    } satisfies CommandResult;
  };
}
