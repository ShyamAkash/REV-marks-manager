import { neon } from "@neondatabase/serverless";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string as an environment variable."
    );
  }
  return url;
}

// Lazily create the sql tag so build-time (no env var) doesn't crash.
let _sql: ReturnType<typeof neon> | null = null;

type QueryFn = (text: string, params?: any[]) => Promise<any[]>;

export function sql(): QueryFn {
  if (!_sql) {
    _sql = neon(getConnectionString());
  }
  return _sql as unknown as QueryFn;
}

export { TOWNS } from "./towns";
export type { Town } from "./towns";
