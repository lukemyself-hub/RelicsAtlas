import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

function createClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${window.location.origin}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
}

let trpcClient: ReturnType<typeof createClient> | null = null;

export function getTrpcClient() {
  if (!trpcClient) {
    trpcClient = createClient();
  }

  return trpcClient;
}
