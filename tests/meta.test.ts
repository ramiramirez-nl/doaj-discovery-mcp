import packageMetadata from "../package.json" with { type: "json" };
import { describe, expect, test } from "vitest";

import { PUBLIC_BASE_URL, SERVICE_VERSION } from "../src/meta.js";

describe("service metadata", () => {
  test("keeps package and public service metadata aligned", () => {
    expect(packageMetadata.version).toBe("0.2.0-beta.1");
    expect(SERVICE_VERSION).toBe(packageMetadata.version);
    expect(PUBLIC_BASE_URL).toBe("https://doaj-discovery-mcp-hbyczavkfq-ew.a.run.app");
  });
});
