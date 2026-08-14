import { getLocalState } from "./storage";

export function normalizeServerUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Enter the API endpoint");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The API endpoint must use http or https");
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function getServerUrl() {
  const state = await getLocalState();
  return state.serverUrl;
}

export async function requireServerUrl() {
  const serverUrl = await getServerUrl();
  if (!serverUrl) {
    throw new Error("Set the API endpoint first");
  }
  return serverUrl;
}
