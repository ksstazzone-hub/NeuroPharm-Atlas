import type { DataSource } from "@prisma/client";

export interface SearchResult<TRecord> {
  source: DataSource;
  query: string;
  fetchedAt: string;
  total: number;
  records: TRecord[];
}

export interface GeneRecord {
  source: "NCBI_GENE";
  sourceRecordId: string;
  ncbiGeneId: string;
  symbol: string | null;
  name: string | null;
  description: string | null;
  chromosome: string | null;
  taxonomyId: number;
  sourceUrl: string;
  queriedAt: string;
  rawRecord: unknown;
}

export interface ClinVarGeneReference {
  ncbiGeneId: string | null;
  symbol: string | null;
}

export interface ClinVarVariantRecord {
  source: "CLINVAR";
  sourceRecordId: string;
  clinVarAccession: string | null;
  dbSnpRsIds: string[];
  ncbiGeneIds: string[];
  geneSymbols: string[];
  genes: ClinVarGeneReference[];
  title: string | null;
  variantType: string | null;
  assembly: string | null;
  chromosome: string | null;
  position: string | null;
  referenceAllele: string | null;
  alternateAllele: string | null;
  clinicalSignificance: string | null;
  reviewStatus: string | null;
  sourceUrl: string;
  queriedAt: string;
  rawRecord: unknown;
}

export interface BioDataConnector<TRecord> {
  readonly source: DataSource;
  search(query: string, limit: number): Promise<SearchResult<TRecord>>;
}

export function normalizeSearchQuery(query: string): string {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (
    normalized.length < 2 ||
    normalized.length > 120 ||
    !/^[\p{L}\p{N}][\p{L}\p{N}\s._:+>*\/()|=;,-]*$/u.test(normalized)
  ) {
    throw new Error("La consulta debe tener entre 2 y 120 caracteres de búsqueda válidos.");
  }
  return normalized;
}

export function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("El límite debe ser un entero entre 1 y 50.");
  }
  return limit;
}