import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: null;
};

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<TrpcContext> {
  return { req, res, user: null };
}
