export type PrivacyRules = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
};

export function sanitizeUrl(value: string, rules: PrivacyRules) {
  const url = new URL(value);
  if (rules.stripQueryParams) url.search = "";
  if (rules.stripFragments) url.hash = "";
  return url.toString();
}

export function isExcludedUrl(value: string, excludedHosts: string[]) {
  const host = new URL(value).hostname.toLocaleLowerCase();
  return excludedHosts.some((entry) => {
    const excluded = entry.trim().toLocaleLowerCase();
    return excluded !== "" && (host === excluded || host.endsWith(`.${excluded}`));
  });
}

export function shouldRecordHistory(
  rules: Pick<PrivacyRules, "recordHistory">,
  isPrivate: boolean,
) {
  return rules.recordHistory && !isPrivate;
}
