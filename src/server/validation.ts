import { z } from 'zod';

const MAX_STRING_LEN = 100;
const boundedString = z.string().trim().min(1).max(MAX_STRING_LEN);

const searchFiltersSchema = z.looseObject({
  locationQuery: boundedString.optional(),
  zipCode: boundedString.optional(),
  city: boundedString.optional(),
  state: boundedString.optional(),
});

/**
 * Validates the shape of a `POST /api/zillow/mcp` body before it reaches
 * executeRentCastTool. Values that end up in RentCast query params are
 * length-capped here as defense-in-depth against parameter/log injection.
 */
export const zillowMcpRequestSchema = z.object({
  toolName: z.enum([
    'zillow_search',
    'zillow_property_details',
    'zillow_comparables',
    'zillow_market_trends',
    'zillow_zestimate',
  ]),
  params: z.looseObject({
    location: boundedString.optional(),
    city: boundedString.optional(),
    state: boundedString.optional(),
    zipCode: boundedString.optional(),
    propertyId: boundedString.optional(),
    zpid: boundedString.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).max(10_000).optional(),
    filters: searchFiltersSchema.optional(),
  }).optional().default({}),
});

export type ZillowMcpRequestBody = z.infer<typeof zillowMcpRequestSchema>;
