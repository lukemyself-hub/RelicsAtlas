export default async function handler(_req: unknown, res: any) {
  try {
    const dbModule = await import("./_lib/db.ts");
    const { getAllSitesForMap, getFilterOptions } = dbModule;
    const [sites, filters] = await Promise.all([getAllSitesForMap(), getFilterOptions()]);
    res.status(200).json({
      ok: true,
      siteCount: sites.length,
      firstSite: sites[0]?.name ?? null,
      batches: filters.batches.length,
      types: filters.types.length,
      eras: filters.eras.length,
      cwd: process.cwd(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      cwd: process.cwd(),
    });
  }
}
