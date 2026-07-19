import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setInterval } from 'node:timers';

const [scenario, ...args] = process.argv.slice(2);

if (args[0] === '--version') {
  if (scenario === 'diagnostics-failure') {
    process.exitCode = 1;
  } else {
    process.stdout.write('codex-cli 9.8.7\n');
  }
} else if (args[0] === 'login' && args[1] === 'status') {
  if (scenario === 'diagnostics-logged-out') {
    process.stderr.write('Not logged in\n');
    process.exitCode = 1;
  } else {
    process.stdout.write('Logged in using ChatGPT\n');
  }
} else if (args[0] === 'exec') {
  await runGenerationScenario(scenario, args);
} else {
  process.stderr.write('Unexpected fake Codex invocation\n');
  process.exitCode = 2;
}

async function runGenerationScenario(activeScenario, invocationArgs) {
  if (activeScenario === 'timeout') {
    setInterval(() => undefined, 1_000);
    return;
  }

  if (activeScenario === 'moderation') {
    process.stderr.write('Request blocked by content policy moderation\n');
    process.exitCode = 1;
    return;
  }

  if (activeScenario === 'network') {
    process.stderr.write('Network connection failed\n');
    process.exitCode = 1;
    return;
  }

  if (activeScenario === 'not-authenticated') {
    process.stderr.write('Authentication required: not logged in\n');
    process.exitCode = 1;
    return;
  }

  const resultPath = flagValue(invocationArgs, '--output-last-message');
  const workingDirectory = process.cwd();
  let imagePath = 'wallpaper.png';

  if (activeScenario === 'outside') {
    imagePath = path.join(
      path.dirname(workingDirectory),
      `outside-${path.basename(workingDirectory)}.png`,
    );
    await writeFile(imagePath, 'fake image bytes');
  } else if (activeScenario !== 'missing-image') {
    await writeFile(path.join(workingDirectory, imagePath), 'fake image bytes');
  }

  if (activeScenario === 'two-images') {
    await writeFile(path.join(workingDirectory, 'second.png'), 'fake image bytes');
  }

  const result = {
    imagePath,
    finalPrompt: 'A quiet geometric landscape composed for a wide desktop wallpaper.',
    title: 'Quiet Geometry',
    themeId: 'minimal',
    sceneSummary: 'A restrained geometric landscape with ample negative space.',
  };

  await writeFile(
    resultPath,
    activeScenario === 'malformed-output' ? '{"unexpected":true}' : JSON.stringify(result),
  );

  if (activeScenario === 'malformed-jsonl') {
    process.stdout.write('this is not JSONL\n');
  } else {
    process.stdout.write(`${JSON.stringify({ type: 'turn.completed' })}\n`);
  }
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1]) {
    throw new Error(`Missing ${flag}`);
  }
  return args[index + 1];
}
