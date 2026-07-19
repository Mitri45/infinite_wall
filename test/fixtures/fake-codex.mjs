import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import process from 'node:process';
import { setInterval } from 'node:timers';

const [scenario, ...args] = process.argv.slice(2);
const fakePngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x66, 0x61, 0x6b, 0x65,
]);

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
} else if (args[0] === 'exec' && args[1] === '--help') {
  const supportedOptions = [
    '--ephemeral',
    '--ignore-user-config',
    '--json',
    '--output-last-message',
    '--sandbox',
    '--skip-git-repo-check',
  ];
  if (scenario !== 'diagnostics-unsupported') {
    supportedOptions.push('--output-schema');
  }
  process.stdout.write(`${supportedOptions.join('\n')}\n`);
} else if (args[0] === 'exec') {
  await runGenerationScenario(scenario, args);
} else {
  process.stderr.write('Unexpected fake Codex invocation\n');
  process.exitCode = 2;
}

async function runGenerationScenario(activeScenario, invocationArgs) {
  let prompt = '';
  for await (const chunk of process.stdin) {
    prompt += chunk;
  }
  if (
    invocationArgs.at(-1) !== '-' ||
    prompt.length < 24 ||
    invocationArgs.some((argument) => argument.includes('Create exactly one original'))
  ) {
    process.stderr.write('Generation prompt must be provided only through stdin\n');
    process.exitCode = 2;
    return;
  }

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
    await writeFile(imagePath, fakePngBytes);
  } else if (activeScenario !== 'missing-image') {
    await writeFile(path.join(workingDirectory, imagePath), fakePngBytes);
  }

  if (activeScenario === 'two-images') {
    await writeFile(path.join(workingDirectory, 'second.png'), fakePngBytes);
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
    const events = [
      { type: 'thread.started', thread_id: 'fake-thread' },
      { type: 'turn.started' },
      {
        type: 'item.started',
        item: {
          id: 'fake-item',
          type: 'command_execution',
          command: 'sensitive fake command content',
        },
      },
      { type: 'item.completed', item: { id: 'fake-item', type: 'agent_message' } },
      { type: 'turn.completed' },
    ];
    for (const event of events) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  }
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1]) {
    throw new Error(`Missing ${flag}`);
  }
  return args[index + 1];
}
