import { hasSameHostname } from "./url-pattern";

export type TetherMode = "loose" | "series";

/** Page snapshot collected while learning a series pattern. */
export type PageObservation = {
  url: string;
  title: string | null;
  pathname: string;
  hostname: string;
};

export type SeriesTetherPattern = {
  status: "learning" | "ready";
  /** Hostname where the series tether started. */
  anchorHostname: string;
  observations: PageObservation[];
  /** Distinct URL changes after the initial tether page. */
  navigationCount: number;
  /** Regex tested against URL pathname. */
  urlPattern?: string;
  /** Regex tested against page title. */
  titlePattern?: string;
  /** Stable substrings discovered across observations. */
  stableTokens: string[];
  /** Values that changed between observations (for UI hints). */
  changingHints: string[];
};

export const SERIES_LEARNING_NAVIGATIONS = 3;

export function defaultTetherMode(): TetherMode {
  return "loose";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function longestCommonPrefix(values: string[]) {
  if (values.length === 0) return "";
  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix;
}

function longestCommonSuffix(values: string[]) {
  if (values.length === 0) return "";
  const reversed = values.map((value) => [...value].reverse().join(""));
  const suffix = longestCommonPrefix(reversed);
  return [...suffix].reverse().join("");
}

function splitAffix(value: string, prefix: string, suffix: string) {
  const end = suffix ? value.length - suffix.length : value.length;
  return value.slice(prefix.length, end);
}

function buildChangingRegex(changingParts: string[]) {
  if (changingParts.length === 0) return "";
  if (changingParts.every((part) => /^\d+$/.test(part))) return "\\d+";
  if (changingParts.every((part) => part === changingParts[0])) {
    return escapeRegex(changingParts[0]!);
  }
  if (changingParts.every((part) => /^[a-z0-9_-]+$/i.test(part))) return "[a-z0-9_-]+";
  return ".+?";
}

function buildAffixRegex(prefix: string, suffix: string, changingParts: string[]) {
  const middle = buildChangingRegex(changingParts);
  if (!prefix && !middle && !suffix) return "";
  return `^${escapeRegex(prefix)}${middle}${escapeRegex(suffix)}$`;
}

export function observationFromPage(url: string, title: string | null): PageObservation {
  const parsed = new URL(url);
  return {
    url,
    title,
    pathname: parsed.pathname,
    hostname: parsed.hostname.toLowerCase(),
  };
}

export function createInitialSeriesPattern(url: string, title: string | null): SeriesTetherPattern {
  const observation = observationFromPage(url, title);
  return {
    status: "learning",
    anchorHostname: observation.hostname,
    observations: [observation],
    navigationCount: 0,
    stableTokens: [],
    changingHints: [],
  };
}

export function learnSeriesPattern(observations: PageObservation[]): Pick<
  SeriesTetherPattern,
  "urlPattern" | "titlePattern" | "stableTokens" | "changingHints"
> {
  const pathnames = observations.map((entry) => entry.pathname);
  const prefix = longestCommonPrefix(pathnames);
  const suffix = longestCommonSuffix(pathnames);
  const safeSuffix =
    suffix && prefix.length + suffix.length <= (pathnames[0]?.length ?? 0) ? suffix : "";
  const changingPathParts = pathnames.map((pathname) =>
    splitAffix(pathname, prefix, safeSuffix),
  );
  const urlPattern = buildAffixRegex(prefix, safeSuffix, changingPathParts);

  const titles = observations.map((entry) => entry.title?.trim() ?? "").filter(Boolean);
  let titlePattern: string | undefined;
  let titlePrefix = "";
  let titleSuffix = "";
  let changingTitleParts: string[] = [];
  if (titles.length >= 2) {
    titlePrefix = longestCommonPrefix(titles);
    titleSuffix = longestCommonSuffix(titles);
    const safeTitleSuffix =
      titleSuffix && titlePrefix.length + titleSuffix.length <= (titles[0]?.length ?? 0)
        ? titleSuffix
        : "";
    changingTitleParts = titles.map((title) => splitAffix(title, titlePrefix, safeTitleSuffix));
    const built = buildAffixRegex(titlePrefix, safeTitleSuffix, changingTitleParts);
    titlePattern = built || undefined;
  }

  const stableTokens = [prefix, titlePrefix]
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  const changingHints = [...new Set([...changingPathParts, ...changingTitleParts].filter(Boolean))];

  return {
    urlPattern: urlPattern || undefined,
    titlePattern,
    stableTokens,
    changingHints,
  };
}

export function recordSeriesNavigation(
  pattern: SeriesTetherPattern,
  url: string,
  title: string | null,
): SeriesTetherPattern {
  const observation = observationFromPage(url, title);
  const last = pattern.observations.at(-1);
  const urlChanged = !last || last.url !== observation.url;

  let next: SeriesTetherPattern = {
    ...pattern,
    observations: urlChanged
      ? [...pattern.observations, observation].slice(-12)
      : pattern.observations,
    navigationCount: urlChanged ? pattern.navigationCount + 1 : pattern.navigationCount,
  };

  if (next.status === "learning" && next.navigationCount >= SERIES_LEARNING_NAVIGATIONS) {
    const learned = learnSeriesPattern(next.observations);
    next = {
      ...next,
      status: "ready",
      ...learned,
    };
  }

  return next;
}

export function matchesSeriesPattern(
  pattern: SeriesTetherPattern,
  url: string,
  title: string | null,
): boolean {
  if (pattern.status === "learning") return true;

  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }

  const urlMatch = pattern.urlPattern
    ? new RegExp(pattern.urlPattern, "i").test(pathname)
    : null;
  const titleMatch =
    pattern.titlePattern && title
      ? new RegExp(pattern.titlePattern, "i").test(title)
      : null;

  if (urlMatch === null && titleMatch === null) return true;
  if (urlMatch !== null && titleMatch !== null) return urlMatch || titleMatch;
  if (urlMatch !== null) return urlMatch;
  return titleMatch ?? false;
}

export function evaluateSeriesTether(input: {
  pattern: SeriesTetherPattern;
  url: string;
  title: string | null;
  previousUrl: string;
}): { shouldSync: boolean; pattern: SeriesTetherPattern } {
  const { pattern, url, title, previousUrl } = input;

  if (!hasSameHostname(`https://${pattern.anchorHostname}/`, url)) {
    return { shouldSync: false, pattern };
  }

  let nextPattern = pattern;
  if (url !== previousUrl) {
    nextPattern = recordSeriesNavigation(pattern, url, title);
  }

  if (nextPattern.status === "learning") {
    return { shouldSync: true, pattern: nextPattern };
  }

  return {
    shouldSync: matchesSeriesPattern(nextPattern, url, title),
    pattern: nextPattern,
  };
}

export function seriesLearningProgress(pattern: SeriesTetherPattern | undefined) {
  if (!pattern || pattern.status !== "learning") return null;
  return {
    current: pattern.navigationCount,
    required: SERIES_LEARNING_NAVIGATIONS,
  };
}

export function validateSeriesRegex(pattern: string) {
  try {
    RegExp(pattern, "i");
    return true;
  } catch {
    return false;
  }
}

export function applyManualSeriesPatterns(input: {
  pattern: SeriesTetherPattern;
  urlPattern?: string;
  titlePattern?: string;
}): SeriesTetherPattern {
  const urlPattern = input.urlPattern?.trim();
  const titlePattern = input.titlePattern?.trim();
  if (urlPattern && !validateSeriesRegex(urlPattern)) {
    throw new Error("URL pattern is not a valid regular expression");
  }
  if (titlePattern && !validateSeriesRegex(titlePattern)) {
    throw new Error("Title pattern is not a valid regular expression");
  }
  if (!urlPattern && !titlePattern) {
    throw new Error("Provide at least one URL or title pattern");
  }

  return {
    ...input.pattern,
    status: "ready",
    urlPattern: urlPattern || undefined,
    titlePattern: titlePattern || undefined,
  };
}

export function describeSeriesPattern(pattern: SeriesTetherPattern | undefined) {
  if (!pattern) return "No series pattern";
  if (pattern.status === "learning") {
    const progress = seriesLearningProgress(pattern);
    return progress
      ? `Learning (${progress.current}/${progress.required} page changes)`
      : "Learning series pattern";
  }
  const parts = [
    pattern.urlPattern ? `URL: /${pattern.urlPattern}/` : null,
    pattern.titlePattern ? `Title: /${pattern.titlePattern}/` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Series pattern ready";
}
