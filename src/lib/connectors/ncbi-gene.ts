import { DataSource } from "@prisma/client";
import { cachedSearch } from "@/lib/cache";
import { asRecord, eutilsJson, stringValue } from "@/lib/connectors/eutils";
import {
  boundedLimit,
  normalizeSearchQuery,
  type BioDataConnector,
  type GeneRecord,
  type SearchResult,
} from "@/lib/connectors/types";

interface SearchPayload {
  esearchresult?: { count?: string; idlist?: string[] };
}

interface SummaryPayload {
  result?: Record<string, unknown> & { uids?: string[] };
}

function geneRelevance(value: unknown, query: string): number {
  const item = asRecord(value);
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const normalizedQuery = normalize(query);
  const symbol = normalize(stringValue(item.name) ?? "");
  if (symbol === normalizedQuery) return 0;

  const names = [
    ...String(item.otheraliases ?? "").split(/[|,;]/),
    ...String(item.otherdesignations ?? "").split("|"),
    stringValue(item.description) ?? "",
  ].map(normalize);
  if (names.includes(normalizedQuery)) return 1;
  if (names.some((name) => name.includes(normalizedQuery))) return 2;
  return 3;
}

async function loadGeneSearch(
  query: string,
  limit: number,
): Promise<SearchResult<GeneRecord>> {
  const fetchedAt = new Date().toISOString();
  let ids: string[];
  let total: number;

  if (/^\d+$/.test(query)) {
    ids = [query];
    total = 1;
  } else {
    let search = await eutilsJson<SearchPayload>("esearch.fcgi", {
      db: "gene",
      term: `"${query}"[Gene Name] AND 9606[Taxonomy ID]`,
      retmode: "json",
      retmax: String(limit),
    });
    ids = search.esearchresult?.idlist ?? [];
    total = Number(search.esearchresult?.count ?? ids.length);

    if (ids.length === 0) {
      search = await eutilsJson<SearchPayload>("esearch.fcgi", {
        db: "gene",
        term: `"${query}"[All Fields] AND 9606[Taxonomy ID]`,
        retmode: "json",
        retmax: String(Math.min(limit * 10, 100)),
      });
      ids = search.esearchresult?.idlist ?? [];
      total = Number(search.esearchresult?.count ?? ids.length);
    }
  }

  if (ids.length === 0) {
    return { source: DataSource.NCBI_GENE, query, fetchedAt, total, records: [] };
  }

  const summary = await eutilsJson<SummaryPayload>("esummary.fcgi", {
    db: "gene",
    id: ids.join(","),
    retmode: "json",
  });
  const result = asRecord(summary.result);
  const records = ids.flatMap((id): GeneRecord[] => {
    const raw = result[id];
    if (!raw) return [];
    const item = asRecord(raw);
    const taxId = Number(item.taxid ?? 9606);
    return [
      {
        source: "NCBI_GENE",
        sourceRecordId: id,
        ncbiGeneId: id,
        symbol: stringValue(item.name),
        name: stringValue(item.description),
        description: stringValue(item.otherdesignations),
        chromosome: stringValue(item.chromosome),
        taxonomyId: Number.isInteger(taxId) ? taxId : 9606,
        sourceUrl: `https://www.ncbi.nlm.nih.gov/gene/${id}`,
        queriedAt: fetchedAt,
        rawRecord: item,
      },
    ];
  }).sort((left, right) => geneRelevance(left.rawRecord, query) - geneRelevance(right.rawRecord, query)).slice(0, limit);

  return { source: DataSource.NCBI_GENE, query, fetchedAt, total, records };
}

export const ncbiGeneConnector: BioDataConnector<GeneRecord> = {
  source: DataSource.NCBI_GENE,
  async search(input, requestedLimit) {
    const query = normalizeSearchQuery(input);
    const limit = boundedLimit(requestedLimit);
    return (
      await cachedSearch(DataSource.NCBI_GENE, query, limit, () =>
        loadGeneSearch(query, limit),
      )
    ).result;
  },
};

export async function searchNcbiGenes(
  query: string,
  limit: number,
  forceRefresh = false,
) {
  const normalized = normalizeSearchQuery(query);
  const bounded = boundedLimit(limit);
  return cachedSearch(DataSource.NCBI_GENE, normalized, bounded, () =>
    loadGeneSearch(normalized, bounded),
    forceRefresh,
  );
}