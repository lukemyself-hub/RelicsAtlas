import { isInMainlandChina, wgs84ToGcj02 } from "@shared/coordinate-system";

type NavigationUrlInput = {
  name: string;
  latitude: number;
  longitude: number;
  userAgent?: string;
};

function getUserAgent(explicitUserAgent?: string) {
  if (explicitUserAgent !== undefined) {
    return explicitUserAgent;
  }

  if (typeof navigator !== "undefined") {
    return navigator.userAgent;
  }

  return "";
}

function buildAppleMapsUrl({ latitude, longitude }: NavigationUrlInput) {
  const coordinate = isInMainlandChina(longitude, latitude)
    ? wgs84ToGcj02(longitude, latitude)
    : { lng: longitude, lat: latitude };

  return `https://maps.apple.com/?daddr=${encodeURIComponent(
    `${coordinate.lat},${coordinate.lng}`,
  )}&dirflg=d`;
}

function buildAmapNavigationUrl({
  name,
  latitude,
  longitude,
  callNative,
}: NavigationUrlInput & { callNative: boolean }) {
  const to = encodeURIComponent(`${longitude},${latitude},${name}`);
  const nativeFlag = callNative ? "&callnative=1" : "";
  return `https://uri.amap.com/navigation?to=${to}&mode=car&coordinate=wgs84${nativeFlag}`;
}

export function buildNavigationUrl(input: NavigationUrlInput) {
  const userAgent = getUserAgent(input.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);

  if (isIOS) {
    return buildAppleMapsUrl(input);
  }

  return buildAmapNavigationUrl({
    ...input,
    callNative: isAndroid,
  });
}
