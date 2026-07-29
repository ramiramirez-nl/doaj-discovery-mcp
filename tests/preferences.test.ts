import { describe, expect, test } from "vitest";

import { analyzeQueryPreferences } from "../src/query/preferences.js";

describe("query preferences", () => {
  test("detects explicit country and language preferences", () => {
    const preferences = analyzeQueryPreferences(
      "Find social science journals in the Netherlands that publish in English"
    );

    expect(preferences.preferredCountries).toContain("Netherlands");
    expect(preferences.preferredLanguages).toContain("English");
  });

  test("detects Turkish query language locally", () => {
    const preferences = analyzeQueryPreferences("Türkiye'de Türkçe dergi ara");

    expect(preferences.detectedLanguage).toBe("Turkish");
    expect(preferences.preferredLanguages).toContain("Turkish");
    expect(preferences.preferredCountries).toContain("Turkey");
  });
});
