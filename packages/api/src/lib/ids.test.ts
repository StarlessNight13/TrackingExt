import { describe, expect, it } from "vitest";

import { createId } from "./ids";

describe("createId", () => {
  it("returns a UUID by default", () => {
    const id = createId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("prefixes IDs when requested", () => {
    expect(createId("tab")).toMatch(/^tab_[0-9a-f-]{36}$/i);
    expect(createId("dev")).toMatch(/^dev_[0-9a-f-]{36}$/i);
  });

  it("creates unique values", () => {
    expect(createId("tab")).not.toBe(createId("tab"));
  });
});
