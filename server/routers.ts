import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllSitesForMap,
  searchSites,
  getSiteById,
  getSiteIntroduction,
  saveSiteIntroduction,
  getFilterOptions,
} from "./db";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
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
        })
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

    // Get or generate LLM introduction for a site
    introduction: publicProcedure
      .input(z.object({ siteId: z.number() }))
      .query(async ({ input }) => {
        // Check cache first
        const cached = await getSiteIntroduction(input.siteId);
        if (cached) {
          return { content: cached.content, cached: true };
        }

        // Get site info for LLM prompt
        const site = await getSiteById(input.siteId);
        if (!site) {
          throw new Error("Site not found");
        }

        // Generate introduction via LLM
        const prompt = `请为以下全国重点文物保护单位撰写一段简洁、准确的介绍（200-400字），内容应包括该文物的历史背景、文化价值和主要特征。请确保信息准确，不要编造不确定的细节。

文物保护单位信息：
- 名称：${site.name}
- 时代：${site.era || '未知'}
- 地址：${site.address || '未知'}
- 文物类型：${site.type || '未知'}
- 批次：${site.batch || '未知'}

请直接输出介绍内容，不需要标题或前缀。`;

        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "你是一位中国文化遗产专家，擅长撰写准确、专业的文物保护单位介绍。请用中文回答，确保内容真实可靠，避免编造不确定的信息。",
              },
              { role: "user", content: prompt },
            ],
          });

          const content =
            typeof result.choices[0]?.message?.content === "string"
              ? result.choices[0].message.content
              : "";

          if (content) {
            await saveSiteIntroduction(input.siteId, content);
          }

          return { content, cached: false };
        } catch (error) {
          console.error("LLM generation failed:", error);
          return {
            content: `${site.name}是${site.batch}公布的全国重点文物保护单位，属于${site.type}类别，位于${site.address || '中国'}，始建于${site.era || '历史时期'}。`,
            cached: false,
          };
        }
      }),

    // Get filter options
    filters: publicProcedure.query(async () => {
      return await getFilterOptions();
    }),
  }),
});

export type AppRouter = typeof appRouter;
