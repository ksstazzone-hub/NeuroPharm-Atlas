import { DataSource } from "@prisma/client";
import { cachedSearch } from "@/lib/cache";
import {
  arrayValue,
  asRecord,
  eutilsJson,
  stringValue,
} from "@/lib/connectors/eutils";
import {
  boundedLimit,
  normalizeSearchQuery,
  type BioDataConnector,
  type ClinVarGeneReference,
  type ClinVarVariantRecord,
  type SearchResult,
} from "@/lib/connectors/types";

interface SearchPayload {
  esearchresult?: { count?: string; idlist?: string[] };
}

interface SummaryPayload {
  result?: Record<string, unknown> & { uids?: string[] };
}

function getGenes(value: unknown): ClinVarGeneReference[] {
  return arrayValue(value).map((entry) => {
    const gene = asRecord(entry);
    return {
      ncbiGeneId: stringValue(gene.geneid ?? gene.GeneID),
      symbol: stringValue(gene.symbol ?? gene.Symbol),
    };
  });
}

function getVariantXrefs(variationSet: unknown[]): string[] {
  const rsIds = new Set<string>();
  for (const variation of variationSet) {
    const xrefs = arrayValue(asRecord(variation).variation_xrefs);
    for (const entry of xrefs) {
      const xref = asRecord(entry);
      if (stringValue(xref.db_source)?.toLowerCase() !== "dbsnp") continue;
      const dbId = stringValue(xref.db_id);
      if (!dbId) continue;
      rsIds.add(dbId.startsWith("rs") ? dbId : `rs${dbId}`);
    }
  }
  return [...rsIds];
}

function getCurrentLocation(variationSet: unknown[]): Record<string, unknown> {
  const locations = variationSet.flatMap((variation) =>
    arrayValue(asRecord(variation).variation_loc),
  );
  return (
    locations.map(asRecord).find((location) => location.status === "current") ??
    locations.map(asRecord)[0] ??
    {}
  );
}

async function loadClinVarSearch(
  query: string,
  limit: number,
): Promise<SearchResult<ClinVarVariantRecord>> {
  const fetchedAt = new Date().toISOString();
  const search = await eutilsJson<SearchPayload>("esearch.fcgi", {
    db: "clinvar",
    term: `"${query}"[All Fields]`,
    retmode: "json",
    retmax: String(limit),
  });
  const ids = search.esearchresult?.idlist ?? [];
  const total = Number(search.esearchresult?.count ?? ids.length);
  if (ids.length === 0) {
    return { source: DataSource.CLINVAR, query, fetchedAt, total, records: [] };
  }

  const summary = await eutilsJson<SummaryPayload>("esummary.fcgi", {
    db: "clinvar",
    id: ids.join(","),
    retmode: "json",
  });
  const result = asRecord(summary.result);
  const records = ids.flatMap((id): ClinVarVariantRecord[] => {
    const raw = result[id];
    if (!raw) return [];
    const item = asRecord(raw);
    const variationSet = arrayValue(item.variation_set);
    const genes = getGenes(item.genes);
    const classification = asRecord(item.germline_classification);
    const location = getCurrentLocation(variationSet);
    const accession = stringValue(item.accession);
    const geneIds = [...new Set(genes.flatMap((gene) => gene.ncbiGeneId ?? []))];
    const geneSymbols = [...new Set(genes.flatMap((gene) => gene.symbol ?? []))];

    return [
      {
        source: "CLINVAR",
        sourceRecordId: accession ?? id,
        clinVarAccession: accession,
        dbSnpRsIds: getVariantXrefs(variationSet),
        ncbiGeneIds: geneIds,
        geneSymbols,
        genes,
        title: stringValue(item.title),
        variantType:
          stringValue(item.obj_type) ??
          stringValue(asRecord(variationSet[0]).variant_type),
        assembly: stringValue(location.assembly_name),
        chromosome: stringValue(location.chr),
        position: stringValue(location.display_start ?? location.start),
        referenceAllele: stringValue(location.ref),
        alternateAllele: stringValue(location.alt),
        clinicalSignificance: stringValue(classification.description),
        reviewStatus: stringValue(classification.review_status),
        sourceUrl: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`,
        queriedAt: fetchedAt,
        rawRecord: item,
      },
    ];
  });

  return { source: DataSource.CLINVAR, query, fetchedAt, total, records };
}

export const clinVarConnector: BioDataConnector<ClinVarVariantRecord> = {
  source: DataSource.CLINVAR,
  async search(input, requestedLimit) {
    const query = normalizeSearchQuery(input);
    const limit = boundedLimit(requestedLimit);
    return (
      await cachedSearch(DataSource.CLINVAR, query, limit, () =>
        loadClinVarSearch(query, limit),
      )
    ).result;
  },
};

export async function searchClinVar(
  query: string,
  limit: number,
  forceRefresh = false,
) {
  const normalized = normalizeSearchQuery(query);
  const bounded = boundedLimit(limit);
  return cachedSearch(DataSource.CLINVAR, normalized, bounded, () =>
    loadClinVarSearch(normalized, bounded),
    forceRefresh,
  );
}