export type UrlPatternParts = {
  fixedStart: string;
  changing: string;
  fixedEnd: string;
};

/**
 * Domains are compared by hostname rather than by URL origin so an in-site
 * http/https transition remains part of the same tracked activity.
 */
export function hasSameHostname(firstUrl: string, secondUrl: string): boolean {
  try {
    return (
      new URL(firstUrl).hostname.toLocaleLowerCase() ===
      new URL(secondUrl).hostname.toLocaleLowerCase()
    );
  } catch {
    return false;
  }
}

function longestSharedPrefix(values: string[]): string {
  const [first, ...rest] = values;
  if (!first || rest.length === 0) return first ?? "";

  let end = first.length;
  for (const value of rest) {
    let index = 0;
    while (index < end && index < value.length && first[index] === value[index]) index += 1;
    end = index;
    if (end === 0) return "";
  }
  return first.slice(0, end);
}

function longestSharedSuffix(values: string[], prefixLength: number): string {
  const [first, ...rest] = values;
  if (!first || rest.length === 0) return "";

  let length = Math.min(...values.map((value) => value.length - prefixLength));
  for (const value of rest) {
    let matched = 0;
    while (
      matched < length &&
      first[first.length - 1 - matched] === value[value.length - 1 - matched]
    ) {
      matched += 1;
    }
    length = matched;
    if (length === 0) return "";
  }
  return first.slice(first.length - length);
}

/**
 * Splits a URL into the part shared by every observed URL and the part that
 * changes. Prefixes stop at a URL separator so a changing chapter identifier
 * is highlighted as a whole instead of only its final digit.
 */
export function getUrlPatternParts(url: string, comparisonUrls: string[]): UrlPatternParts {
  const urls = [...new Set(comparisonUrls)];
  if (urls.length < 2 || !urls.includes(url)) {
    return { fixedStart: url, changing: "", fixedEnd: "" };
  }

  const sharedPrefix = longestSharedPrefix(urls);
  const separatorIndex = Math.max(
    sharedPrefix.lastIndexOf("/"),
    sharedPrefix.lastIndexOf("?"),
    sharedPrefix.lastIndexOf("&"),
    sharedPrefix.lastIndexOf("="),
    sharedPrefix.lastIndexOf("#"),
  );
  const fixedStart = separatorIndex >= 0 ? sharedPrefix.slice(0, separatorIndex + 1) : "";
  const fixedEnd = longestSharedSuffix(urls, fixedStart.length);
  const changingEnd = fixedEnd ? url.length - fixedEnd.length : url.length;

  return {
    fixedStart,
    changing: url.slice(fixedStart.length, changingEnd),
    fixedEnd,
  };
}
