import { DataSource } from "@prisma/client";
import { clinVarConnector } from "@/lib/connectors/clinvar";
import { ncbiGeneConnector } from "@/lib/connectors/ncbi-gene";

export const connectorRegistry = {
  [DataSource.NCBI_GENE]: ncbiGeneConnector,
  [DataSource.CLINVAR]: clinVarConnector,
};

export const connectorCatalog = [
  {
    source: DataSource.NCBI_GENE,
    label: "NCBI Gene",
    status: "ACTIVE",
    access: "E-utilities ESearch + ESummary",
  },
  {
    source: DataSource.CLINVAR,
    label: "ClinVar",
    status: "ACTIVE",
    access: "E-utilities ESearch + ESummary",
  },
] as const;