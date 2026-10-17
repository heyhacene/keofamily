export interface LatestApkRelease {
  version: string;
  buildNumber: number | null;
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
}

export const DEFAULT_DAR_BUILD = process.env.NEXT_PUBLIC_BUILD_NUMBER || '1';

export function getDirectDarApkUrl(buildNumber: string = DEFAULT_DAR_BUILD): string {
  return `https://github.com/heyhacene/keofamily/releases/download/v1.0.0-build.${buildNumber}/KeoFamily-Build-${buildNumber}.apk`;
}

export function getDirectDarApkFilename(buildNumber: string = DEFAULT_DAR_BUILD): string {
  return `KeoFamily-Build-${buildNumber}.apk`;
}

export async function fetchLatestDarApk(): Promise<LatestApkRelease> {
  const fallbackRelease: LatestApkRelease = {
    version: `v1.0.0-build.${DEFAULT_DAR_BUILD}`,
    buildNumber: parseInt(DEFAULT_DAR_BUILD, 10),
    filename: getDirectDarApkFilename(),
    downloadUrl: getDirectDarApkUrl(),
    sizeBytes: 0,
  };

  try {
    const res = await fetch('https://api.github.com/repos/heyhacene/keofamily/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return fallbackRelease;
    const data = await res.json();
    if (!data || !Array.isArray(data.assets)) return fallbackRelease;

    const buildAsset = data.assets.find(
      (a: any) => typeof a.name === 'string' && a.name.startsWith('KeoFamily-Build-') && a.name.endsWith('.apk')
    );

    const asset = buildAsset || data.assets.find(
      (a: any) => typeof a.name === 'string' && a.name.endsWith('.apk')
    );

    if (!asset) return fallbackRelease;

    const buildMatch = asset.name.match(/Build-(\d+)/i) || data.tag_name?.match(/build\.(\d+)/i);
    const buildNum = buildMatch ? parseInt(buildMatch[1], 10) : parseInt(DEFAULT_DAR_BUILD, 10);

    return {
      version: data.tag_name || `v1.0.0-build.${buildNum}`,
      buildNumber: buildNum,
      filename: asset.name,
      downloadUrl: asset.browser_download_url,
      sizeBytes: asset.size || 0,
    };
  } catch (err) {
    return fallbackRelease;
  }
}
