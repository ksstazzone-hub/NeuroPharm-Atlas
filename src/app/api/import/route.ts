import { DataSource, Prisma } from "@prisma/client";
import { searchClinVar } from "@/lib/connectors/clinvar";
import { searchNcbiGenes } from "@/lib/connectors/ncbi-gene";
import type {
  ClinVarVariantRecord,
  GeneRecord,
} from "@/lib/connectors/types";
import { prisma } from "@/lib/prisma";

type ImportBody = {
  source?: string;
  query?: string;
  limit?: number;
  refresh?: boolean;
};

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "Configura DATABASE_URL para importar datos localmente." },
      { status: 503 },
    );
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query : "";
  const limit = Number(body.limit ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return Response.json({ error: "El límite debe ser un entero entre 1 y 50." }, { status: 400 });
  }
  if (body.source !== DataSource.NCBI_GENE && body.source !== DataSource.CLINVAR) {
    return Response.json({ error: "Fuente de importación no habilitada." }, { status: 400 });
  }

  const source = body.source;
  const run = await prisma.ingestionRun.create({ data: { source, query } });

  try {
    const result =
      source === DataSource.NCBI_GENE
        ? (await searchNcbiGenes(query, limit, body.refresh === true)).result
        : (await searchClinVar(query, limit, body.refresh === true)).result;

    let recordsUpserted = 0;
    if (source === DataSource.NCBI_GENE) {
      const geneRecords = result.records.filter(
        (record): record is GeneRecord => record.source === DataSource.NCBI_GENE,
      );
      for (const record of geneRecords) {
        await prisma.gene.upsert({
          where: { ncbiGeneId: record.ncbiGeneId },
          create: {
            ncbiGeneId: record.ncbiGeneId,
            sourceRecordId: record.sourceRecordId,
            symbol: record.symbol,
            name: record.name,
            description: record.description,
            chromosome: record.chromosome,
            taxonomyId: record.taxonomyId,
            source: DataSource.NCBI_GENE,
            rawRecord: record.rawRecord as Prisma.InputJsonValue,
            queriedAt: new Date(record.queriedAt),
          },
          update: {
            sourceRecordId: record.sourceRecordId,
            symbol: record.symbol,
            name: record.name,
            description: record.description,
            chromosome: record.chromosome,
            taxonomyId: record.taxonomyId,
            source: DataSource.NCBI_GENE,
            rawRecord: record.rawRecord as Prisma.InputJsonValue,
            queriedAt: new Date(record.queriedAt),
          },
        });
        recordsUpserted += 1;
      }
    } else {
      const variantRecords = result.records.filter(
        (record): record is ClinVarVariantRecord => record.source === DataSource.CLINVAR,
      );
      for (const record of variantRecords) {
        if (!record.clinVarAccession) continue;
        await prisma.variant.upsert({
          where: { clinVarAccession: record.clinVarAccession },
          create: {
            clinVarAccession: record.clinVarAccession,
            sourceRecordId: record.sourceRecordId,
            dbSnpRsIds: record.dbSnpRsIds,
            ncbiGeneIds: record.ncbiGeneIds,
            geneSymbols: record.geneSymbols,
            title: record.title,
            variantType: record.variantType,
            assembly: record.assembly,
            chromosome: record.chromosome,
            position: record.position,
            referenceAllele: record.referenceAllele,
            alternateAllele: record.alternateAllele,
            clinicalSignificance: record.clinicalSignificance,
            reviewStatus: record.reviewStatus,
            source: DataSource.CLINVAR,
            rawRecord: record.rawRecord as Prisma.InputJsonValue,
            queriedAt: new Date(record.queriedAt),
          },
          update: {
            sourceRecordId: record.sourceRecordId,
            dbSnpRsIds: record.dbSnpRsIds,
            ncbiGeneIds: record.ncbiGeneIds,
            geneSymbols: record.geneSymbols,
            title: record.title,
            variantType: record.variantType,
            assembly: record.assembly,
            chromosome: record.chromosome,
            position: record.position,
            referenceAllele: record.referenceAllele,
            alternateAllele: record.alternateAllele,
            clinicalSignificance: record.clinicalSignificance,
            reviewStatus: record.reviewStatus,
            source: DataSource.CLINVAR,
            rawRecord: record.rawRecord as Prisma.InputJsonValue,
            queriedAt: new Date(record.queriedAt),
          },
        });
        recordsUpserted += 1;
      }
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        recordsFetched: result.records.length,
        recordsUpserted,
      },
    });
    return Response.json({
      runId: run.id,
      source,
      query,
      recordsFetched: result.records.length,
      recordsUpserted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de importación.";
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date(), error: message },
    });
    return Response.json({ error: message, runId: run.id }, { status: 502 });
  }
}