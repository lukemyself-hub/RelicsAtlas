export type WeChatSharePayload = {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
};

function readMetaContent(selector: string) {
  return (
    document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? ""
  );
}

export function getCanonicalShareLink() {
  const canonicalHref =
    document
      .querySelector<HTMLLinkElement>("link[rel='canonical']")
      ?.href?.trim() ?? "";
  return canonicalHref || window.location.href.split("#")[0];
}

export function getWeChatSharePayload(): WeChatSharePayload {
  return {
    title: document.title,
    desc: readMetaContent('meta[name="description"]'),
    link: getCanonicalShareLink(),
    imgUrl: readMetaContent('meta[property="og:image"]'),
  };
}
