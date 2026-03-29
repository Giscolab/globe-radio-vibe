import { z } from 'zod';
import { StationSchema, type Station } from '@/engine/types/radio';

const DATASET_LEGACY_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const DATASET_OPTIONAL_STRING_KEYS = [
  'urlResolved',
  'homepage',
  'favicon',
  'countryCode',
  'state',
  'language',
  'genre',
  'codec',
  'lastCheckTime',
] as const;

type DatasetOptionalStringKey = (typeof DATASET_OPTIONAL_STRING_KEYS)[number];

function sanitizeOptionalStringRecord(
  input: Record<string, unknown>,
  key: DatasetOptionalStringKey
): void {
  const value = input[key];
  if (typeof value !== 'string') {
    return;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    delete input[key];
    return;
  }

  input[key] = key === 'countryCode' ? trimmedValue.toUpperCase() : trimmedValue;
}

function sanitizeStationDatasetInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const record = { ...(input as Record<string, unknown>) };

  for (const key of DATASET_OPTIONAL_STRING_KEYS) {
    sanitizeOptionalStringRecord(record, key);
  }

  if (Array.isArray(record.tags)) {
    record.tags = record.tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  return record;
}

export const WorldStationDatasetStationSchema = z.preprocess(
  sanitizeStationDatasetInput,
  StationSchema
);

export const WorldStationDatasetPayloadSchema = z
  .object({
    version: z.string().min(1),
    generatedAt: z.string().datetime(),
    source: z.string().min(1),
    total: z.number().int().nonnegative(),
    stations: z.array(WorldStationDatasetStationSchema),
  })
  .superRefine((payload, ctx) => {
    if (payload.total !== payload.stations.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Dataset total (${payload.total}) does not match stations length (${payload.stations.length})`,
        path: ['total'],
      });
    }
  });

export type WorldStationDatasetPayload = z.infer<typeof WorldStationDatasetPayloadSchema>;

export interface NormalizeWorldStationDatasetOptions {
  acceptLegacyArray?: boolean;
  legacyVersion?: string;
  legacyGeneratedAt?: string;
  legacySource?: string;
}

function buildLegacyDatasetPayload(
  stations: unknown[],
  options?: NormalizeWorldStationDatasetOptions
): WorldStationDatasetPayload {
  return WorldStationDatasetPayloadSchema.parse({
    version: options?.legacyVersion ?? 'legacy',
    generatedAt: options?.legacyGeneratedAt ?? DATASET_LEGACY_GENERATED_AT,
    source: options?.legacySource ?? 'legacy',
    total: stations.length,
    stations,
  });
}

export function normalizeWorldStationDatasetPayload(
  input: unknown,
  options?: NormalizeWorldStationDatasetOptions
): WorldStationDatasetPayload {
  if (Array.isArray(input)) {
    if (options?.acceptLegacyArray === false) {
      throw new Error('Legacy station array datasets are not accepted by this parser.');
    }

    return buildLegacyDatasetPayload(input, options);
  }

  return WorldStationDatasetPayloadSchema.parse(input);
}

export function safeNormalizeWorldStationDatasetPayload(
  input: unknown,
  options?: NormalizeWorldStationDatasetOptions
) {
  try {
    return {
      success: true as const,
      data: normalizeWorldStationDatasetPayload(input, options),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error,
      };
    }

    throw error;
  }
}

export function createWorldStationDatasetPayload(
  stations: Station[],
  metadata: {
    version: string;
    generatedAt: string;
    source: string;
  }
): WorldStationDatasetPayload {
  return WorldStationDatasetPayloadSchema.parse({
    ...metadata,
    total: stations.length,
    stations,
  });
}
