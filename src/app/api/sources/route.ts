import { connectorCatalog } from "@/lib/connectors/registry";

export async function GET() {
  return Response.json({ sources: connectorCatalog });
}