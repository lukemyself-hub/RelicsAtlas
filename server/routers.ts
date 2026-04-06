import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { getWeChatShareConfig } from "./_core/wechat-share";
import {
  getAllSitesForMap,
  searchSites,
  getSiteById,
  getFilterOptions,
} from "./db";

export const appRouter = router({
  auth: router({
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });

      return { success: true };
    }),
  }),
  heritage: router({
    // Get all sites for map display (lightweight: id, name, lat, lng, type, batch, era)
    mapData: publicProcedure.query(async () => {
      return await getAllSitesForMap();
    }),

    // Search and list sites with filters, pagination, and optional distance sorting
    search: publicProcedure
      .input(
        z.object({
          keyword: z.string().optional(),
          batch: z.string().optional(),
          types: z.array(z.string()).optional(),
          era: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
          userLat: z.number().optional(),
          userLng: z.number().optional(),
        }),
      )
      .query(async ({ input }) => {
        return await searchSites(input);
      }),

    // Get single site detail
    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const site = await getSiteById(input.id);
        if (!site) {
          throw new Error("Site not found");
        }
        return site;
      }),
    // Get filter options
    filters: publicProcedure.query(async () => {
      return await getFilterOptions();
    }),
  }),
  wechat: router({
    shareConfig: publicProcedure
      .input(
        z.object({
          url: z.string().url(),
        }),
      )
      .query(async ({ input }) => {
        return await getWeChatShareConfig(input.url);
      }),
  }),
});

export type AppRouter = typeof appRouter;
