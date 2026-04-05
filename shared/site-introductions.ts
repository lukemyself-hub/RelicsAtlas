type IntroSiteKeyInput = {
  id: number;
  name: string;
  batch: string | null;
};

export function buildSiteIntroductionKey(site: IntroSiteKeyInput) {
  return `${site.batch ?? ""}:${site.id}:${site.name}`;
}
