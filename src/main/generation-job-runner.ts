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
  type GenerationProgress,
  type GenerationRequest,
  type GenerationResult,
  type PublicAppError,
  THEME_IDS,
} from '../shared/contracts';
import { resolveCodexCommand } from './codex-command';
import { runCapturedProcess } from './codex-process';
import { buildGenerationPrompt } from './generation-prompt';
import { verifiedImageMime } from './image-file';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);
const MAX_ASPECT_RATIO_DIFFERENCE = 0.05;

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
  readonly commandResolver?: () => Promise<string>;
  readonly model?: string;
  readonly timeoutMs?: number;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export type GenerationProgressReporter = (
  progress: GenerationProgress,
) => void;

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
  readonly #commandArgsPrefix: readonly string[];
  readonly #commandResolver: () => Promise<string>;
  readonly #model: string;
  readonly #timeoutMs: number;
  #jobRootPreparation: Promise<void> | null = null;

  constructor(options: GenerationJobRunnerOptions) {
    this.#jobRoot = path.resolve(options.jobRoot);
    this.#inspectImage = options.inspectImage;
    this.#commandArgsPrefix = options.commandArgsPrefix ?? [];
    this.#commandResolver =
      options.commandResolver ?? (() => resolveCodexCommand({ command: options.command }));
    this.#model = options.model ?? 'gpt-5.6';
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async run(
    request: GenerationRequest,
    signal?: AbortSignal,
    onProgress?: GenerationProgressReporter,
  ): Promise<GenerationResult> {
    throwIfAborted(signal);
    reportProgress(onProgress, {
      phase: 'preparing',
      message: 'Preparing a private generation workspace…',
      percent: 5,
    });
    await this.#prepareJobRoot();
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

      reportProgress(onProgress, {
        phase: 'starting',
        message: 'Starting Codex with the selected direction…',
        percent: 15,
      });

      throwIfAborted(signal);
      const command = await this.#commandResolver();
      throwIfAborted(signal);

      const processResult = await runCapturedProcess({
        command,
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
          '-',
        ],
        stdin: prompt,
        cwd: jobDirectory,
        timeoutMs: this.#timeoutMs,
        signal,
        onStdoutLine: (line) => {
          const progress = progressForCodexEvent(line);
          if (progress) {
            reportProgress(onProgress, progress);
          }
        },
      });

      assertProcessSucceeded(processResult);
      parseJsonLines(processResult.stdout);
      reportProgress(onProgress, {
        phase: 'validating',
        message: 'Checking the generated image and metadata…',
        percent: 82,
      });

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
      await validateDecodedImage(imagePath, request.display, this.#inspectImage);
      reportProgress(onProgress, {
        phase: 'validating',
        message: 'Wallpaper passed the safety and file checks.',
        percent: 90,
      });

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

  async removeCompletedJob(imagePath: string): Promise<void> {
    const resolvedRoot = await realpath(this.#jobRoot);
    const resolvedImage = await realpath(imagePath);
    const jobDirectory = path.dirname(resolvedImage);
    if (
      path.dirname(jobDirectory) !== resolvedRoot ||
      !path.basename(jobDirectory).startsWith('job-')
    ) {
      throw new GenerationJobError(
        'outside-job-directory',
        'Refusing to remove a path outside the generation job root.',
        false,
      );
    }
    await rm(jobDirectory, { recursive: true, force: true });
  }

  async #prepareJobRoot(): Promise<void> {
    this.#jobRootPreparation ??= this.#initializeJobRoot();
    await this.#jobRootPreparation;
  }

  async #initializeJobRoot(): Promise<void> {
    await mkdir(this.#jobRoot, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.#jobRoot, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('job-'))
        .map((entry) =>
          rm(path.join(this.#jobRoot, entry.name), { recursive: true, force: true }),
        ),
    );
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GenerationJobError(
      'cancelled',
      'Wallpaper generation was cancelled.',
      true,
    );
  }
}

function reportProgress(
  reporter: GenerationProgressReporter | undefined,
  progress: GenerationProgress,
): void {
  try {
    reporter?.(progress);
  } catch {
    // Presentation progress cannot affect generation correctness.
  }
}

function progressForCodexEvent(line: string): GenerationProgress | null {
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }
  if (!event || typeof event !== 'object' || !('type' in event)) {
    return null;
  }

  const type = (event as { type?: unknown }).type;
  if (type === 'thread.started') {
    return {
      phase: 'starting',
      message: 'Codex session started.',
      percent: 22,
    };
  }
  if (type === 'turn.started') {
    return {
      phase: 'generating',
      message: 'Composing a new wallpaper…',
      percent: 34,
    };
  }
  if (type === 'item.started') {
    return {
      phase: 'generating',
      message: 'Generating the image locally through Codex…',
      percent: 52,
    };
  }
  if (type === 'item.completed') {
    return {
      phase: 'generating',
      message: 'Finalizing the generated artwork…',
      percent: 72,
    };
  }
  if (type === 'turn.completed') {
    return {
      phase: 'validating',
      message: 'Codex finished. Validating the result…',
      percent: 78,
    };
  }
  if (type === 'turn.failed' || type === 'error') {
    return {
      phase: 'generating',
      message: 'Codex reported a generation problem…',
      percent: 70,
    };
  }
  return null;
}

async function validateDecodedImage(
  imagePath: string,
  requestedDimensions: GenerationRequest['display'],
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

  const requestedRatio = requestedDimensions.width / requestedDimensions.height;
  const actualRatio = dimensions.width / dimensions.height;
  const relativeDifference = Math.abs(actualRatio - requestedRatio) / requestedRatio;
  if (relativeDifference > MAX_ASPECT_RATIO_DIFFERENCE) {
    throw new GenerationJobError(
      'missing-image',
      'Codex returned an image with the wrong aspect ratio for this display.',
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

  if (
    !candidateStats?.isFile() ||
    candidateStats.size === 0 ||
    candidateStats.size > MAX_IMAGE_BYTES
  ) {
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

  if (!(await verifiedImageMime(resolvedImagePath))) {
    throw new GenerationJobError(
      'missing-image',
      'Codex returned an image whose contents do not match its file type.',
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
