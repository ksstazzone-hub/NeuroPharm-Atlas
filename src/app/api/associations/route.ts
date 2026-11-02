import {
  ActionabilityStatus,
  AssociationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const textFilter = (value: string) => ({
  contains: value,
  mode: Prisma.QueryMode.insensitive,
});

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "Configura DATABASE_URL para consultar asociaciones locales." },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  const filters: Prisma.AssociationWhereInput[] = [];
  const geneName = params.get("geneName")?.trim();
  const symbol = params.get("hgncSymbol")?.trim();
  const ncbiGeneId = params.get("ncbiGeneId")?.trim();
  const variant = params.get("variant")?.trim();
  const rsId = params.get("rsId")?.trim();
  const drug = params.get("drug")?.trim();
  const activeIngredient = params.get("activeIngredient")?.trim();
  const enzyme = params.get("enzyme")?.trim();
  const target = params.get("target")?.trim();
  const pathology = params.get("pathology")?.trim();
  const phenotype = params.get("phenotype")?.trim();
  const evidenceType = params.get("evidenceType")?.trim().toUpperCase();
  const actionability = params.get("actionability")?.trim().toUpperCase();

  if (geneName) filters.push({ gene: { is: { name: textFilter(geneName) } } });
  if (symbol) filters.push({ gene: { is: { symbol: textFilter(symbol) } } });
  if (ncbiGeneId) filters.push({ gene: { is: { ncbiGeneId } } });
  if (variant) {
    filters.push({
      variant: {
        is: {
          OR: [
            { title: textFilter(variant) },
            { clinVarAccession: textFilter(variant) },
          ],
        },
      },
    });
  }
  if (rsId) {
    const normalizedRsId = rsId.toLowerCase().startsWith("rs")
      ? rsId.toLowerCase()
      : `rs${rsId}`;
    filters.push({ variant: { is: { dbSnpRsIds: { has: normalizedRsId } } } });
  }
  if (drug) filters.push({ drug: { is: { name: textFilter(drug) } } });
  if (activeIngredient) {
    filters.push({
      drug: { is: { activeIngredient: textFilter(activeIngredient) } },
    });
  }
  if (enzyme) {
    filters.push({
      OR: [
        { enzyme: textFilter(enzyme) },
        { gene: { is: { symbol: textFilter(enzyme) } } },
      ],
    });
  }
  if (target) {
    filters.push({ target: { is: { name: textFilter(target) } } });
  }
  if (pathology) filters.push({ pathology: textFilter(pathology) });
  if (phenotype) {
    filters.push({ phenotype: { is: { name: textFilter(phenotype) } } });
  }
  if (
    evidenceType &&
    Object.values(AssociationType).includes(evidenceType as AssociationType)
  ) {
    filters.push({ associationType: evidenceType as AssociationType });
  } else if (evidenceType) {
    filters.push({ evidenceLevel: textFilter(evidenceType) });
  }
  if (
    actionability &&
    Object.values(ActionabilityStatus).includes(actionability as ActionabilityStatus)
  ) {
    filters.push({ actionability: actionability as ActionabilityStatus });
  }

  const take = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 100);
  const skip = Math.min(Math.max(Number(params.get("offset") ?? 0), 0), 5000);

  try {
    const [records, total] = await prisma.$transaction([
      prisma.association.findMany({
        where: { AND: filters },
        include: {
          gene: true,
          variant: true,
          allele: true,
          phenotype: true,
          drug: true,
          target: true,
        },
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.association.count({ where: { AND: filters } }),
    ]);
    return Response.json({ records, total, limit: take, offset: skip });
  } catch {
    return Response.json(
      { error: "No se pudo consultar la base local. Comprueba la conexión y migraciones." },
      { status: 503 },
    );
  }
}