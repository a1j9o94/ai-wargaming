"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { 
  loggerLink, 
  splitLink,
  unstable_httpBatchStreamLink, 
  unstable_httpSubscriptionLink 
} from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  return (clientQueryClientSingleton ??= createQueryClient());
};

export const api = createTRPCReact<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const baseUrl = getBaseUrl();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            op.direction === "down" && op.result instanceof Error,
        }),
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: unstable_httpSubscriptionLink({
            url: `${baseUrl}/api/trpc`,
            transformer: SuperJSON,
          }),
          false: unstable_httpBatchStreamLink({
            url: `${baseUrl}/api/trpc`,
            transformer: SuperJSON,
          }),
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
