import { searchClinVar } from "@/lib/connectors/clinvar";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const query = parameters.get("q") ?? "";
  const limit = Number(parameters.get("limit") ?? 10);
  const forceRefresh = parameters.get("refresh") === "true";

  try {
    const result = await searchClinVar(query, limit, forceRefresh);
    const { result: data, cacheHit } = result;
    return Response.json({
      ...data,
      records: data.records.map((record) => {
        const { rawRecord, ...publicRecord } = record;
        void rawRecord;
        return publicRecord;
      }),
      cacheHit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de consulta.";
    const status = message.startsWith("La consulta") || message.startsWith("El límite")
      ? 400
      : 502;
    return Response.json({ error: message }, { status });
  }
}