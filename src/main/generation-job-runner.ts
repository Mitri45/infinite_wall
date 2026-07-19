import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  codexGenerationOutputSchema,
  type GenerationErrorCode,
  type GenerationRequest,
  type GenerationResult,
  type PublicAppError,
  THEME_IDS,
} from '../shared/contracts';
import { runCapturedProcess } from './codex-process';
import { buildGenerationPrompt } from './generation-prompt';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);

const GENERATION_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    imagePath: { type: 'string', minLength: 1 },
    finalPrompt: { type: 'string', minLength: 24, maxLength: 4_000 },
    title: { type: 'string', minLength: 3, maxLength: 100 },
    themeId: { type: 'string', enum: THEME_IDS },
    sceneSummary: { type: 'string', minLength: 12, maxLength: 240 },
  },
  required: ['imagePath', 'finalPrompt', 'title', 'themeId', 'sceneSummary'],
  additionalProperties: false,
} as const;

export interface GenerationJobRunnerOptions {
  readonly jobRoot: string;
  readonly inspectImage: (imagePath: string) => Promise<ImageDimensions>;
  readonly command?: string;
  readonly commandArgsPrefix?: readonly string[];
  readonly model?: string;
  readonly timeoutMs?: number;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export class GenerationJobError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'GenerationJobError';
  }

  toPublicError(): PublicAppError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export class GenerationJobRunner {
  readonly #jobRoot: string;
  readonly #inspectImage: GenerationJobRunnerOptions['inspectImage'];
  readonly #command: string;
  readonly #commandArgsPrefix: readonly string[];
  readonly #model: string;
  readonly #timeoutMs: number;

  constructor(options: GenerationJobRunnerOptions) {
    this.#jobRoot = path.resolve(options.jobRoot);
    this.#inspectImage = options.inspectImage;
    this.#command = options.command ?? 'codex';
    this.#commandArgsPrefix = options.commandArgsPrefix ?? [];
    this.#model = options.model ?? 'gpt-5.6';
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async run(
    request: GenerationRequest,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    await mkdir(this.#jobRoot, { recursive: true, mode: 0o700 });
    const jobDirectory = await mkdtemp(path.join(this.#jobRoot, 'job-'));
    await chmod(jobDirectory, 0o700);
    const schemaPath = path.join(jobDirectory, 'output-schema.json');
    const resultPath = path.join(jobDirectory, 'result.json');
    const promptPath = path.join(jobDirectory, 'prompt.txt');
    const prompt = buildGenerationPrompt(request);
    const startedAt = Date.now();

    try {
      await Promise.all([
        writeFile(schemaPath, JSON.stringify(GENERATION_OUTPUT_JSON_SCHEMA, null, 2), {
          encoding: 'utf8',
          mode: 0o600,
        }),
        writeFile(promptPath, prompt, { encoding: 'utf8', mode: 0o600 }),
      ]);

      const processResult = await runCapturedProcess({
        command: this.#command,
        args: [
          ...this.#commandArgsPrefix,
          'exec',
          '--ephemeral',
          '--ignore-user-config',
          '--model',
          this.#model,
          '--sandbox',
          'workspace-write',
          '--skip-git-repo-check',
          '--json',
          '--color',
          'never',
          '--output-schema',
          schemaPath,
          '--output-last-message',
          resultPath,
          prompt,
        ],
        cwd: jobDirectory,
        timeoutMs: this.#timeoutMs,
        signal,
      });

      assertProcessSucceeded(processResult);
      parseJsonLines(processResult.stdout);

      const resultText = await readFile(resultPath, 'utf8').catch(() => {
        throw new GenerationJobError(
          'malformed-output',
          'Codex did not return structured wallpaper metadata.',
          false,
        );
      });
      const parsedResult = parseStructuredResult(resultText);

      if (parsedResult.themeId !== request.themeId) {
        throw new GenerationJobError(
          'malformed-output',
          'Codex returned metadata for a different theme.',
          false,
        );
      }

      const imagePath = await validateGeneratedImage(
        jobDirectory,
        parsedResult.imagePath,
      );
      await validateDecodedImage(imagePath, this.#inspectImage);

      return {
        ...parsedResult,
        imagePath,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      await rm(jobDirectory, { recursive: true, force: true });
      if (error instanceof GenerationJobError) {
        throw error;
      }
      throw new GenerationJobError(
        'process-failed',
        'Wallpaper generation failed unexpectedly.',
        true,
      );
    }
  }
}

async function validateDecodedImage(
  imagePath: string,
  inspectImage: GenerationJobRunnerOptions['inspectImage'],
): Promise<void> {
  const dimensions = await inspectImage(imagePath).catch(() => null);
  if (
    !dimensions ||
    !Number.isInteger(dimensions.width) ||
    !Number.isInteger(dimensions.height) ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > 16_384 ||
    dimensions.height > 16_384
  ) {
    throw new GenerationJobError(
      'missing-image',
      'Codex returned an image that Infinite Wall could not decode safely.',
      false,
    );
  }
}

function assertProcessSucceeded(
  result: Awaited<ReturnType<typeof runCapturedProcess>>,
): void {
  if (result.aborted) {
    throw new GenerationJobError(
      'cancelled',
      'Wallpaper generation was cancelled.',
      true,
    );
  }
  if (result.timedOut) {
    throw new GenerationJobError(
      'timeout',
      'Codex took too long to generate the wallpaper.',
      true,
    );
  }
  if (result.overflowed) {
    throw new GenerationJobError(
      'malformed-output',
      'Codex produced more diagnostic output than Infinite Wall can safely process.',
      false,
    );
  }
  if (result.spawnError?.code === 'ENOENT') {
    throw new GenerationJobError(
      'not-installed',
      'Install the Codex CLI before generating a wallpaper.',
      false,
    );
  }
  if (result.spawnError) {
    throw new GenerationJobError(
      'process-failed',
      'Infinite Wall could not start the Codex CLI.',
      true,
    );
  }
  if (result.exitCode !== 0) {
    throw classifyProcessFailure(`${result.stderr}\n${result.stdout}`);
  }
}

function classifyProcessFailure(output: string): GenerationJobError {
  const normalized = output.toLocaleLowerCase();
  if (/not logged in|unauthenticated|authentication required/.test(normalized)) {
    return new GenerationJobError(
      'not-authenticated',
      'Sign in with Codex before generating a wallpaper.',
      false,
    );
  }
  if (/moderation|content policy|safety policy/.test(normalized)) {
    return new GenerationJobError(
      'moderation',
      'This request could not be generated safely. Try a different direction.',
      false,
    );
  }
  if (/network|connection|dns|http connect|socket/.test(normalized)) {
    return new GenerationJobError(
      'network',
      'Codex could not reach the generation service. Check your connection.',
      true,
    );
  }
  return new GenerationJobError(
    'process-failed',
    'Codex could not complete the wallpaper generation.',
    true,
  );
}

function parseJsonLines(stdout: string): void {
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }

    try {
      JSON.parse(line);
    } catch {
      throw new GenerationJobError(
        'malformed-output',
        'Codex returned malformed progress data.',
        false,
      );
    }
  }
}

function parseStructuredResult(resultText: string) {
  try {
    return codexGenerationOutputSchema.parse(JSON.parse(resultText));
  } catch {
    throw new GenerationJobError(
      'malformed-output',
      'Codex returned malformed wallpaper metadata.',
      false,
    );
  }
}

async function validateGeneratedImage(
  jobDirectory: string,
  reportedImagePath: string,
): Promise<string> {
  const resolvedJobDirectory = await realpath(jobDirectory);
  const candidatePath = path.isAbsolute(reportedImagePath)
    ? path.resolve(reportedImagePath)
    : path.resolve(jobDirectory, reportedImagePath);
  const candidateStats = await stat(candidatePath).catch(() => null);

  if (!candidateStats?.isFile() || candidateStats.size === 0) {
    throw new GenerationJobError(
      'missing-image',
      'Codex finished without producing a usable image.',
      false,
    );
  }

  const resolvedImagePath = await realpath(candidatePath);
  if (path.dirname(resolvedImagePath) !== resolvedJobDirectory) {
    throw new GenerationJobError(
      'outside-job-directory',
      'Codex returned an image outside its isolated job directory.',
      false,
    );
  }

  if (!SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(resolvedImagePath).toLowerCase())) {
    throw new GenerationJobError(
      'missing-image',
      'Codex returned an unsupported image file type.',
      false,
    );
  }

  const imageFiles = (await readdir(resolvedJobDirectory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => path.join(resolvedJobDirectory, entry.name));

  if (imageFiles.length !== 1 || imageFiles[0] !== resolvedImagePath) {
    throw new GenerationJobError(
      'malformed-output',
      'Codex must produce exactly one wallpaper image per job.',
      false,
    );
  }

  return resolvedImagePath;
}
