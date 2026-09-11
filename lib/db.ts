import { neon } from "@neondatabase/serverless";

/**
 * Thrown when there is no usable database connection.
 *
 * There is deliberately no in-memory fallback any more. An earlier version of
 * this file answered every query from a mock store when `DATABASE_URL` was
 * unset, so the app looked like it worked with nothing behind it — marks
 * appeared to save and vanished on restart. Routes now surface the failure and
 * the screen says the database is offline.
 */
export class DatabaseOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseOfflineError";
  }
}

/** 503 for "the database is not there", 500 for anything else a route threw. */
export function errorStatus(err: unknown): number {
  return err instanceof DatabaseOfflineError ? 503 : 500;
}

let _sql: ReturnType<typeof neon> | null = null;
let _sqlUrl: string | null = null;

type QueryFn = (text: string, params?: any[]) => Promise<any[]>;

/**
 * The Neon query function. Throws `DatabaseOfflineError` when `DATABASE_URL`
 * is missing or the client cannot be built — every API route already wraps its
 * body in try/catch and returns `{ error }`, so the caller sees the reason.
 *
 * A query that throws once connected propagates untouched: a failing database
 * must never be papered over with data that is not really stored.
 */
export function sql(): QueryFn {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new DatabaseOfflineError(
      "Database offline — DATABASE_URL is not configured on this deployment."
    );
  }

  // Rebuild if the URL changed under us (a dev server picking up a new .env).
  if (!_sql || _sqlUrl !== url) {
    try {
      _sql = neon(url);
      _sqlUrl = url;
    } catch (err: any) {
      _sql = null;
      _sqlUrl = null;
      throw new DatabaseOfflineError(
        `Database offline — could not connect to Neon: ${err?.message ?? err}`
      );
    }
  }

  const client = _sql;
  return async (queryText: string, params?: any[]) =>
    (await client(queryText, params)) as any[];
}

export { TOWNS } from "./towns";
export type { Town } from "./towns";
