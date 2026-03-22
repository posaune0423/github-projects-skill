import { createGitHubProjectsSkill } from "./src/skills/github-projects-ops/index.ts";
import { readClassifier, readSkillOptions } from "./src/utils/config.ts";

type ParsedArgs = {
  command?: string;
  flags: Record<string, string | boolean | undefined>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean | undefined> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return {
    command,
    flags,
  };
}

async function readInputText(flags: Record<string, string | boolean | undefined>, key = "input"): Promise<string> {
  const fromFlag = flags[key];
  if (typeof fromFlag === "string") {
    return fromFlag;
  }

  const stdin = await Bun.stdin.text();
  const trimmed = stdin.trim();
  if (trimmed) {
    return trimmed;
  }

  throw new Error(`No ${key} text provided. Pass --${key} or pipe stdin.`);
}

function printUsage(): void {
  console.log(`Usage:
  bun run index.ts setup-project --owner ORG --repo REPO --project-number 1
  bun run index.ts capture --provider heuristic --input "text"
  bun run index.ts sync-issue --provider heuristic --issue 123
  bun run index.ts weekly-report [--notify-slack]
  bun run index.ts hygiene-report [--notify-slack]
  bun run index.ts notify-slack --message "hello"`);
}

async function main(): Promise<void> {
  const parsed = parseArgs(Bun.argv.slice(2));
  if (!parsed.command || parsed.flags.help) {
    printUsage();
    return;
  }

  if (parsed.command === "notify-slack") {
    const options = readSkillOptions(parsed.flags);
    const skill = createGitHubProjectsSkill(options);
    const message = await readInputText(parsed.flags, "message");
    await skill.notifySlack(message);
    return;
  }

  const options = readSkillOptions(parsed.flags);
  const classifier = readClassifier(parsed.flags);
  const skill = createGitHubProjectsSkill(options, {
    classifier,
  });

  switch (parsed.command) {
    case "setup-project": {
      await skill.setupProject();
      console.log("Project fields ensured.");
      return;
    }
    case "capture": {
      const text = await readInputText(parsed.flags);
      const result = await skill.captureIssueFromText(text);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "sync-issue": {
      const rawIssue = parsed.flags.issue;
      if (typeof rawIssue !== "string") {
        throw new Error("--issue is required.");
      }
      const result = await skill.syncIssueMetadata(Number(rawIssue));
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "weekly-report": {
      const report = await skill.generateWeeklyReport({
        notifySlack: parsed.flags["notify-slack"] === true,
      });
      console.log(report.markdown);
      return;
    }
    case "hygiene-report": {
      const report = await skill.generateHygieneReport({
        notifySlack: parsed.flags["notify-slack"] === true,
      });
      console.log(report.markdown);
      return;
    }
    default:
      throw new Error(`Unknown command: ${parsed.command}`);
  }
}

await main();
