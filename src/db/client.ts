import "server-only";

import { MongoClient, type Db } from "mongodb";

import { env } from "@/lib/env";

// One client per serverless instance, reused across requests and hot reloads.
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> };

function connect(): Promise<MongoClient> {
  const promise = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 5,
    appName: "kb-assistant",
  }).connect();
  // Do not cache a failed connection: the next call retries instead of
  // rethrowing the same error for the lifetime of the instance.
  promise.catch(() => {
    if (g._mongo === promise) g._mongo = undefined;
  });
  return promise;
}

export function getClient(): Promise<MongoClient> {
  return (g._mongo ??= connect());
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(env.MONGODB_DB);
}
