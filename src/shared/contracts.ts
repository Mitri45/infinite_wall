import { z } from 'zod';

export const THEME_IDS = [
  'minimal',
  'nature',
  'architecture',
  'cozy',
  'cosmic',
  'sci-fi',
  'fantasy',
  'noir',
  'abstract',
  'surreal',
  'seasonal',
  'illustrated',
  'anime-waifu',
] as const;

export const themeIdSchema = z.enum(THEME_IDS);
export type ThemeId = z.infer<typeof themeIdSchema>;

export const identifierSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

export const sceneSeedSchema = z
  .object({
    id: identifierSchema,
    title: z.string().min(3).max(60),
    summary: z.string().min(12).max(180),
    prompt: z.string().min(24).max(600),
    weight: z.number().positive().max(10).default(1),
  })
  .strict();

export const themePackSchema = z
  .object({
    id: themeIdSchema,
    name: z.string().min(3).max(40),
    collection: z.string().min(3).max(40),
    description: z.string().min(20).max(180),
    palette: z.array(hexColorSchema).min(3).max(5),
    mood: z.array(z.string().min(2).max(30)).min(2).max(6),
    subjects: z.array(z.string().min(3).max(80)).min(3).max(10),
    composition: z.string().min(20).max(300),
    sceneSeeds: z.array(sceneSeedSchema).min(4).max(12),
  })
  .strict();

export type SceneSeed = z.infer<typeof sceneSeedSchema>;
export type ThemePack = z.infer<typeof themePackSchema>;

export const displayDimensionsSchema = z
  .object({
    width: z.number().int().min(640).max(16384),
    height: z.number().int().min(480).max(16384),
  })
  .strict();

export type DisplayDimensions = z.infer<typeof displayDimensionsSchema>;

const generationRequestBase = {
  themeId: themeIdSchema,
  display: displayDimensionsSchema,
  quality: z.enum(['standard', 'high']),
  recentConcepts: z.array(z.string().min(3).max(240)).max(20),
};

export const generationRequestSchema = z.discriminatedUnion('mode', [
  z
    .object({
      ...generationRequestBase,
      mode: z.literal('infinite'),
    })
    .strict(),
  z
    .object({
      ...generationRequestBase,
      mode: z.literal('curated'),
      sceneId: identifierSchema,
    })
    .strict(),
  z
    .object({
      ...generationRequestBase,
      mode: z.literal('custom'),
      customPrompt: z.string().trim().min(3).max(1_000),
    })
    .strict(),
]);

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const codexGenerationOutputSchema = z
  .object({
    imagePath: z.string().min(1),
    finalPrompt: z.string().min(24).max(4_000),
    title: z.string().min(3).max(100),
    themeId: themeIdSchema,
    sceneSummary: z.string().min(12).max(240),
  })
  .strict();

export type CodexGenerationOutput = z.infer<
  typeof codexGenerationOutputSchema
>;

export const generationResultSchema = z
  .object({
    imagePath: z.string().min(1),
    finalPrompt: z.string().min(24).max(4_000),
    title: z.string().min(3).max(100),
    themeId: themeIdSchema,
    sceneSummary: z.string().min(12).max(240),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export type GenerationResult = z.infer<typeof generationResultSchema>;

export const codexDiagnosticsSchema = z
  .object({
    installed: z.boolean(),
    authenticated: z.boolean(),
    version: z.string().nullable(),
    authMethod: z
      .enum(['chatgpt', 'api-key', 'access-token', 'unknown'])
      .nullable(),
    issue: z
      .enum([
        'not-installed',
        'not-authenticated',
        'unsupported-version',
        'check-failed',
      ])
      .nullable(),
    message: z.string().min(1).max(240),
  })
  .strict();

export type CodexDiagnostics = z.infer<typeof codexDiagnosticsSchema>;

export const GENERATION_PROGRESS_PHASES = [
  'preparing',
  'starting',
  'generating',
  'validating',
  'importing',
  'complete',
] as const;

export const generationProgressSchema = z
  .object({
    phase: z.enum(GENERATION_PROGRESS_PHASES),
    message: z.string().min(1).max(160),
    percent: z.number().int().min(0).max(100),
  })
  .strict();

export type GenerationProgress = z.infer<typeof generationProgressSchema>;

export const GENERATION_ERROR_CODES = [
  'busy',
  'cancelled',
  'invalid-request',
  'library-import',
  'library-operation',
  'malformed-output',
  'missing-image',
  'moderation',
  'network',
  'not-authenticated',
  'not-installed',
  'outside-job-directory',
  'process-failed',
  'settings-operation',
  'timeout',
  'wallpaper-apply',
] as const;

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number];

export interface PublicAppError {
  readonly code: GenerationErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PublicAppError };

export const wallpaperRecordSchema = z
  .object({
    id: identifierSchema,
    filename: z.string().min(1).max(255),
    prompt: z.string().min(1).max(4_000),
    title: z.string().min(3).max(100),
    themeId: themeIdSchema,
    sceneSummary: z.string().min(12).max(240),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
    applied: z.boolean(),
    favorite: z.boolean(),
  })
  .strict();

export type WallpaperRecord = z.infer<typeof wallpaperRecordSchema>;

export const wallpaperPreviewSchema = z
  .object({
    record: wallpaperRecordSchema,
    previewUrl: z
      .string()
      .regex(/^infinite-wall-media:\/\/wallpaper\/[a-z0-9-]+$/),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export type WallpaperPreview = z.infer<typeof wallpaperPreviewSchema>;

export const wallpaperLibraryItemSchema = z
  .object({
    record: wallpaperRecordSchema,
    previewUrl: z
      .string()
      .regex(/^infinite-wall-media:\/\/wallpaper\/[a-z0-9-]+$/),
  })
  .strict();

export type WallpaperLibraryItem = z.infer<typeof wallpaperLibraryItemSchema>;

export const appSettingsSchema = z
  .object({
    quality: z.enum(['standard', 'high']).default('standard'),
    scheduleHours: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24)]).nullable().default(null),
    schedulePaused: z.boolean().default(false),
    launchAtLogin: z.boolean().default(false),
    libraryLimit: z.number().int().min(20).max(500).default(100),
    applyToAllDisplays: z.literal(true).default(true),
  })
  .strict();

export type AppSettings = z.infer<typeof appSettingsSchema>;
export const appSettingsPatchSchema = z.object({
  quality: z.enum(['standard', 'high']).optional(),
  scheduleHours: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24)]).nullable().optional(),
  schedulePaused: z.boolean().optional(),
  launchAtLogin: z.boolean().optional(),
  libraryLimit: z.number().int().min(20).max(500).optional(),
  applyToAllDisplays: z.literal(true).optional(),
}).strict();
export type AppSettingsPatch = z.input<typeof appSettingsPatchSchema>;

export const appCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('generate') }).strict(),
  z.object({ type: z.literal('surprise'), themeId: themeIdSchema }).strict(),
]);
export type AppCommand = z.infer<typeof appCommandSchema>;
