import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  ROOM_TTL_SECONDS: z.coerce.number().int().positive().default(21_600),
  EMPTY_ROOM_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  COMMAND_DELAY_MS: z.coerce.number().int().positive().default(1500),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

export function readEnv(source = process.env): Env {
  return EnvSchema.parse(source);
}
