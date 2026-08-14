export function hasSameHostname(firstUrl: string, secondUrl: string) {
  try {
    return new URL(firstUrl).hostname.toLowerCase() === new URL(secondUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
}

export function getUrlPatternParts(url: string, comparisonUrls: string[]) {
  const urls = [...new Set(comparisonUrls)];
  if (urls.length < 2 || !urls.includes(url))
    return { fixedStart: url, changing: "", fixedEnd: "" };
  let prefix = urls[0]!;
  for (const value of urls.slice(1)) while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  const separator = Math.max(
    prefix.lastIndexOf("/"),
    prefix.lastIndexOf("?"),
    prefix.lastIndexOf("&"),
    prefix.lastIndexOf("="),
    prefix.lastIndexOf("#"),
  );
  const fixedStart = separator < 0 ? "" : prefix.slice(0, separator + 1);
  let suffix = urls[0]!.slice(fixedStart.length);
  for (const value of urls.slice(1)) while (!value.endsWith(suffix)) suffix = suffix.slice(1);
  return {
    fixedStart,
    changing: url.slice(fixedStart.length, suffix ? -suffix.length : undefined),
    fixedEnd: suffix,
  };
}
