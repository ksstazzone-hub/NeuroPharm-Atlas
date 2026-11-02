# NeuroPharm Atlas

Plataforma inicial para integrar datos farmacogenómicos y neurobiológicos con identificadores oficiales, procedencia explícita y separación entre asociación científica y accionabilidad clínica.

## Estado actual

- Esquema PostgreSQL/Prisma para genes, variantes, alelos, fenotipos, fármacos, dianas, asociaciones, caché e historial de ingestas.
- Conectores funcionales para NCBI Gene y ClinVar mediante NCBI E-utilities (`ESearch`/`ESummary`).
- Búsqueda remota, caché de seis horas en memoria/PostgreSQL, actualización forzada e importación idempotente por Gene ID y acceso ClinVar.
- API REST para filtros combinables en asociaciones locales.
- Sin asociaciones clínicas precargadas ni datos de demostración. Las búsquedas NCBI/ClinVar no generan asociaciones farmacológicas.
- Estado de accionabilidad por defecto `NOT_ASSESSED`. La clasificación ClinVar se conserva como interpretación de variante, no como recomendación de tratamiento.

La evaluación de acceso, endpoints y limitaciones de las fuentes está en [docs/data-sources.md](docs/data-sources.md).

## Desarrollo local

Requisitos: Node.js 20.9+, Docker Compose y una instancia PostgreSQL.

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev --name init
npm run dev
```

Abre `http://localhost:3000`. Las consultas externas funcionan sin PostgreSQL; importar datos y filtrar asociaciones locales requiere aplicar la migración y tener la base activa.

Comandos útiles: `npm run db:generate`, `npm run db:migrate`, `npm run db:deploy`, `npm run lint` y `npm run build`.

## API

- `GET /api/connectors/ncbi-gene?q=CYP2D6&limit=10`
- `GET /api/connectors/clinvar?q=rs429358&limit=10`
- Añade `refresh=true` para omitir la caché y consultar la fuente.
- `POST /api/import` con JSON `{ "source": "NCBI_GENE", "query": "CYP2D6", "limit": 10, "refresh": true }`; `source` acepta `NCBI_GENE` o `CLINVAR`.
- `GET /api/associations` acepta filtros combinables: `geneName`, `hgncSymbol`, `ncbiGeneId`, `variant`, `rsId`, `drug`, `activeIngredient`, `enzyme`, `target`, `pathology`, `phenotype`, `evidenceType` y `actionability`.
- `GET /api/sources` lista los conectores implementados.

El endpoint de importación no incluye autenticación de usuarios. Antes de exponerlo públicamente hay que protegerlo con autenticación/autorización y límites de uso. Para refrescos periódicos, un scheduler externo puede invocar `POST /api/import` por consulta guardada, con `refresh: true`; cada ejecución se registra en `IngestionRun`.

## Arquitectura de conectores

Cada conector implementa `BioDataConnector<T>` y se registra de forma independiente en `src/lib/connectors/registry.ts`. El transporte, control de frecuencia, normalización, caché y persistencia se comparten sin acoplar los adaptadores. Para añadir una fuente, documenta primero API/versiones/licencia, conserva el registro original y evita crear una `Association` salvo que la fuente respalde realmente esa relación.