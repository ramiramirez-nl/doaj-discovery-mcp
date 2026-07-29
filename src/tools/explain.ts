const EXPLANATIONS: Record<string, string> = {
  apc: "APC means article processing charge: a publication fee charged to authors or funders. In DOAJ discovery metadata, APC/no-APC fields help users find no-fee or diamond open-access journals. This server uses APC metadata for discovery only, not editorial assessment.",
  "diamond oa":
    "Diamond OA usually means open-access publishing where readers pay no subscription and authors pay no APC. In DOAJ discovery, no-fee signals are ranked from APC metadata and related terms.",
  license:
    "DOAJ license metadata describes reuse permissions, such as CC BY. This server can rank or filter by license for discovery, but does not judge compliance.",
  language:
    "DOAJ language metadata lists publication languages for journals or articles. This server boosts requested languages before global results unless strict filtering is requested."
};

export const explainDoajMetadata = (term: string): string => {
  const key = term.trim().toLowerCase();
  return (
    EXPLANATIONS[key] ??
    "DOAJ metadata describes journals and articles for discovery, including title, ISSN, subjects, languages, country, licenses, APC status, authors, abstracts, and links. This server explains and ranks metadata for discovery only, not editorial review."
  );
};
