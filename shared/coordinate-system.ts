const EARTH_RADIUS = 6378245.0;
const ECCENTRICITY_SQUARED = 0.00669342162296594323;
const PI = Math.PI;

export interface Coordinate {
  lng: number;
  lat: number;
}

export function isInMainlandChina(lng: number, lat: number) {
  return lng >= 73.66 && lng <= 135.05 && lat >= 3.86 && lat <= 53.55;
}

export function wgs84ToGcj02(lng: number, lat: number): Coordinate {
  if (!isInMainlandChina(lng, lat)) {
    return { lng, lat };
  }

  const deltaLat = transformLat(lng - 105.0, lat - 35.0);
  const deltaLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  const magic = Math.sin(radLat);
  const adjustedMagic = 1 - ECCENTRICITY_SQUARED * magic * magic;
  const sqrtMagic = Math.sqrt(adjustedMagic);

  const dLat =
    (deltaLat * 180.0) /
    (((EARTH_RADIUS * (1 - ECCENTRICITY_SQUARED)) / (adjustedMagic * sqrtMagic)) * PI);
  const dLng =
    (deltaLng * 180.0) / ((EARTH_RADIUS / sqrtMagic) * Math.cos(radLat) * PI);

  return {
    lng: lng + dLng,
    lat: lat + dLat,
  };
}

export function gcj02ToWgs84(lng: number, lat: number): Coordinate {
  if (!isInMainlandChina(lng, lat)) {
    return { lng, lat };
  }

  let guessLng = lng;
  let guessLat = lat;

  for (let index = 0; index < 5; index += 1) {
    const converted = wgs84ToGcj02(guessLng, guessLat);
    const deltaLng = converted.lng - lng;
    const deltaLat = converted.lat - lat;

    guessLng -= deltaLng;
    guessLat -= deltaLat;

    if (Math.max(Math.abs(deltaLng), Math.abs(deltaLat)) < 1e-7) {
      break;
    }
  }

  return {
    lng: guessLng,
    lat: guessLat,
  };
}

function transformLat(lng: number, lat: number) {
  let result =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));

  result +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) /
    3.0;
  result +=
    ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) /
    3.0;
  result +=
    ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) /
    3.0;

  return result;
}

function transformLng(lng: number, lat: number) {
  let result =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng));

  result +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) /
    3.0;
  result +=
    ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) /
    3.0;
  result +=
    ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) /
    3.0;

  return result;
}
