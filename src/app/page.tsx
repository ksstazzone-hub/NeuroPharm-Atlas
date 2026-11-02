"use client";

import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  Dna,
  ExternalLink,
  Filter,
  FlaskConical,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

type SearchSource = "NCBI_GENE" | "CLINVAR";

type GeneHit = {
  source: "NCBI_GENE";
  sourceRecordId: string;
  ncbiGeneId: string;
  symbol: string | null;
  name: string | null;
  description: string | null;
  chromosome: string | null;
  sourceUrl: string;
};

type ClinVarHit = {
  source: "CLINVAR";
  sourceRecordId: string;
  clinVarAccession: string | null;
  dbSnpRsIds: string[];
  geneSymbols: string[];
  ncbiGeneIds: string[];
  title: string | null;
  variantType: string | null;
  assembly: string | null;
  chromosome: string | null;
  position: string | null;
  clinicalSignificance: string | null;
  reviewStatus: string | null;
  sourceUrl: string;
};

type SearchHit = GeneHit | ClinVarHit;

type AssociationHit = {
  id: string;
  associationType: string;
  actionability: string;
  evidenceLevel: string | null;
  source: string;
  mechanism: string | null;
  publicationId: string | null;
  gene: { symbol: string | null } | null;
  variant: { title: string | null; dbSnpRsIds: string[] } | null;
  drug: { name: string } | null;
  phenotype: { name: string } | null;
};

type SearchResponse = {
  records: SearchHit[];
  total: number;
  cacheHit: boolean;
  error?: string;
};

const filterFields = [
  { name: "geneName", label: "Nombre del gen" },
  { name: "hgncSymbol", label: "Símbolo HGNC" },
  { name: "ncbiGeneId", label: "ID NCBI Gene" },
  { name: "variant", label: "Variante" },
  { name: "rsId", label: "rsID" },
  { name: "drug", label: "Fármaco" },
  { name: "activeIngredient", label: "Principio activo" },
  { name: "enzyme", label: "Enzima metabólica" },
  { name: "target", label: "Diana farmacológica" },
  { name: "pathology", label: "Patología" },
  { name: "phenotype", label: "Fenotipo metabolizador" },
  { name: "evidenceType", label: "Tipo de evidencia" },
];

function displayLabel(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function SearchResultRow({
  record,
  onOpen,
}: {
  record: SearchHit;
  onOpen: (record: SearchHit) => void;
}) {
  if (record.source === "NCBI_GENE") {
    return (
      <article className="result-row">
        <div className="result-index gene-index"><Dna size={17} /></div>
        <div className="result-main">
          <div className="result-title-line">
            <h3>{record.symbol ?? `Gene ${record.ncbiGeneId}`}</h3>
            <span className="data-tag">NCBI Gene</span>
          </div>
          <p>{record.name ?? "Sin descripción en el registro"}</p>
          <div className="result-meta-line">
            <span>Gene ID {record.ncbiGeneId}</span>
            {record.chromosome && <span>Cromosoma {record.chromosome}</span>}
          </div>
        </div>
        <div className="result-actions">
          <button className="external-link" type="button" onClick={() => onOpen(record)} title="Abrir ficha normalizada" aria-label="Abrir ficha normalizada">
            <ArrowUpRight size={17} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="result-row">
      <div className="result-index variant-index"><Dna size={17} /></div>
      <div className="result-main">
        <div className="result-title-line">
          <h3>{record.title ?? record.clinVarAccession ?? "Variante ClinVar"}</h3>
          <span className="data-tag data-tag-clinvar">ClinVar</span>
        </div>
        <p>
          {record.geneSymbols.length > 0 ? record.geneSymbols.join(", ") : "Gen no especificado"}
          {record.dbSnpRsIds.length > 0 && ` · ${record.dbSnpRsIds.join(", ")}`}
        </p>
        <div className="result-meta-line">
          <span>{record.clinVarAccession ?? `UID ${record.sourceRecordId}`}</span>
          {record.assembly && record.chromosome && record.position && (
            <span>{record.assembly} · chr{record.chromosome}:{record.position}</span>
          )}
          {record.clinicalSignificance && <span>{record.clinicalSignificance}</span>}
        </div>
      </div>
      <div className="result-actions">
        <button className="external-link" type="button" onClick={() => onOpen(record)} title="Abrir ficha normalizada" aria-label="Abrir ficha normalizada">
          <ArrowUpRight size={17} />
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const [source, setSource] = useState<SearchSource>("NCBI_GENE");
  const [query, setQuery] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<SearchHit | null>(null);
  const [total, setTotal] = useState(0);
  const [cacheHit, setCacheHit] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [filterPending, setFilterPending] = useState(false);
  const [associations, setAssociations] = useState<AssociationHit[]>([]);
  const [associationTotal, setAssociationTotal] = useState(0);
  const [filterMessage, setFilterMessage] = useState("");

  async function searchExternal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchPending(true);
    setMessage("");
    setSearched(true);
    try {
      const path = source === "NCBI_GENE" ? "ncbi-gene" : "clinvar";
      const response = await fetch(`/api/connectors/${path}?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(payload.error ?? "No se pudo completar la consulta.");
      setHits(payload.records);
      setTotal(payload.total);
      setCacheHit(payload.cacheHit);
    } catch (error) {
      setHits([]);
      setTotal(0);
      setMessage(error instanceof Error ? error.message : "Error de conexión.");
    } finally {
      setSearchPending(false);
    }
  }

  async function importResults() {
    setImportPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, query, limit: 10, refresh: true }),
      });
      const payload = (await response.json()) as {
        recordsUpserted?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo importar.");
      setMessage(`${payload.recordsUpserted ?? 0} registros normalizados y actualizados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error de importación.");
    } finally {
      setImportPending(false);
    }
  }

  async function filterAssociations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterPending(true);
    setFilterMessage("");
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) params.set(key, value.trim());
    }
    try {
      const response = await fetch(`/api/associations?${params.toString()}`);
      const payload = (await response.json()) as {
        records?: AssociationHit[];
        total?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron filtrar asociaciones.");
      setAssociations(payload.records ?? []);
      setAssociationTotal(payload.total ?? 0);
    } catch (error) {
      setAssociations([]);
      setAssociationTotal(0);
      setFilterMessage(error instanceof Error ? error.message : "Error de consulta local.");
    } finally {
      setFilterPending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <div className="brand-lockup">
          <div className="brand-mark"><Dna size={21} strokeWidth={2.2} /></div>
          <div><strong>NeuroPharm</strong><span>ATLAS / 01</span></div>
        </div>
        <div className="rail-caption">ESPACIO DE TRABAJO</div>
        <nav className="rail-nav" aria-label="Navegación principal">
          <button className="rail-link rail-link-active" type="button"><Search size={17} />Explorador</button>
          <button className="rail-link" type="button" onClick={() => document.getElementById("local-filters")?.scrollIntoView({ behavior: "smooth" })}>
            <SlidersHorizontal size={17} />Asociaciones
          </button>
          <button className="rail-link" type="button" onClick={() => document.getElementById("source-status")?.scrollIntoView({ behavior: "smooth" })}>
            <Database size={17} />Fuentes
          </button>
        </nav>
        <div className="rail-divider" />
        <div className="rail-caption">CONECTORES ACTIVOS</div>
        <div className="connector-status"><span className="status-dot" /><span>NCBI Gene</span><span className="status-live">LIVE</span></div>
        <div className="connector-status"><span className="status-dot" /><span>ClinVar</span><span className="status-live">LIVE</span></div>
        <div className="rail-spacer" />
        <div className="rail-footnote"><Activity size={15} /><span>Datos de origen identificados<br />sin inferir accionabilidad</span></div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="breadcrumb">PLATAFORMA <ChevronRight size={13} /> FARMACOGENÓMICA</div>
          <div className="topbar-state"><span className="status-dot" />SISTEMA OPERATIVO</div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">INTEGRACIÓN DE FARMACOGENÓMICA Y NEUROCIENCIAS</p>
              <h1>NeuroPharm Atlas</h1>
              <p className="heading-copy">Explora registros científicos y construye relaciones trazables entre genes, variantes y evidencia.</p>
            </div>
            <div className="source-count"><span className="count-number">02</span><span>conectores<br />verificados</span></div>
          </section>

          <div className="relation-path" aria-label="Modelo de relaciones">
            {[["GEN", "gene"], ["VARIANTE", "variant"], ["ALELO", "allele"], ["FENOTIPO", "phenotype"], ["FÁRMACO", "drug"], ["MECANISMO", "mechanism"], ["EVIDENCIA", "evidence"]].map(([label, kind], index) => (
              <div className={`path-node path-${kind}`} key={kind}>
                <span>{label}</span>{index < 6 && <ChevronRight size={13} />}
              </div>
            ))}
          </div>

          <section className="search-section" aria-labelledby="external-search-heading">
            <div className="section-heading">
              <div className="section-number">01</div>
              <div><p className="eyebrow">CONSULTA EXTERNA</p><h2 id="external-search-heading">Buscar en fuentes científicas</h2></div>
              <div className="segmented-control" role="group" aria-label="Seleccionar fuente">
                <button type="button" className={source === "NCBI_GENE" ? "segment selected" : "segment"} onClick={() => setSource("NCBI_GENE")} aria-pressed={source === "NCBI_GENE"}>NCBI Gene</button>
                <button type="button" className={source === "CLINVAR" ? "segment selected" : "segment"} onClick={() => setSource("CLINVAR")} aria-pressed={source === "CLINVAR"}>ClinVar</button>
              </div>
            </div>

            <form className="search-form" onSubmit={searchExternal}>
              <div className="search-input-wrap"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={120} required placeholder={source === "NCBI_GENE" ? "Símbolo, alias, nombre o ID NCBI" : "Gen, rsID, variante o acceso ClinVar"} aria-label="Término de búsqueda" /></div>
              <button className="primary-button" type="submit" disabled={searchPending}>{searchPending ? "Consultando" : "Consultar fuente"}<ArrowUpRight size={16} /></button>
            </form>

            <div className="search-toolbar">
              <div className="source-caption"><span className="status-dot" />Fuente oficial · {source === "NCBI_GENE" ? "NCBI E-utilities" : "ClinVar vía NCBI E-utilities"}</div>
              <button className="text-action" type="button" onClick={importResults} disabled={!searched || hits.length === 0 || importPending}>
                {importPending ? "Actualizando..." : "Actualizar e importar"}<ArrowUpRight size={14} />
              </button>
            </div>

            {message && <div className={message.includes("registros normalizados") ? "inline-notice success-notice" : "inline-notice error-notice"} role="status">{message.includes("registros normalizados") ? <Check size={16} /> : <CircleAlert size={16} />}{message}</div>}

            <div className="results-heading">
              <span>RESULTADOS</span>
              {searched && <span>{total} encontrados{cacheHit ? " · caché" : " · consulta en vivo"}</span>}
            </div>
            <div className="results-list" aria-live="polite">
              {!searched && <div className="empty-state"><div className="empty-icon"><FlaskConical size={21} /></div><div><strong>Consulta una fuente para comenzar</strong><span>Los registros se mostrarán con su identificador y procedencia.</span></div></div>}
              {searched && !searchPending && hits.length === 0 && !message && <div className="empty-state"><div className="empty-icon"><Search size={20} /></div><div><strong>Sin resultados para esta consulta</strong><span>Prueba un símbolo, ID oficial o rsID.</span></div></div>}
              {hits.map((record) => <SearchResultRow key={`${record.source}:${record.sourceRecordId}`} record={record} onOpen={setSelectedRecord} />)}
              {searchPending && <div className="loading-row">Consultando {source === "NCBI_GENE" ? "NCBI Gene" : "ClinVar"}...</div>}
            </div>
            <div className="clinical-note"><CircleAlert size={16} /><span>Las clasificaciones de ClinVar describen interpretación de variantes; no son recomendaciones terapéuticas ni determinan accionabilidad farmacológica.</span></div>
          </section>

          {selectedRecord && (
            <div className="record-backdrop" onMouseDown={() => setSelectedRecord(null)}>
              <section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className="record-dialog-header">
                  <div>
                    <p className="eyebrow">FICHA NORMALIZADA · {selectedRecord.source === "NCBI_GENE" ? "NCBI GENE" : "CLINVAR"}</p>
                    <h2 id="record-dialog-title">{selectedRecord.source === "NCBI_GENE" ? selectedRecord.symbol ?? `Gene ${selectedRecord.ncbiGeneId}` : selectedRecord.title ?? selectedRecord.clinVarAccession ?? "Variante ClinVar"}</h2>
                  </div>
                  <button className="dialog-close" type="button" onClick={() => setSelectedRecord(null)} aria-label="Cerrar ficha"><X size={18} /></button>
                </header>
                {selectedRecord.source === "NCBI_GENE" ? (
                  <dl className="record-fields">
                    <div><dt>Nombre</dt><dd>{selectedRecord.name ?? "No informado"}</dd></div>
                    <div><dt>ID NCBI Gene</dt><dd>{selectedRecord.ncbiGeneId}</dd></div>
                    <div><dt>Cromosoma</dt><dd>{selectedRecord.chromosome ?? "No informado"}</dd></div>
                    <div><dt>Descripción / alias</dt><dd>{selectedRecord.description?.split("|").join(" · ") ?? "No informado"}</dd></div>
                  </dl>
                ) : (
                  <dl className="record-fields">
                    <div><dt>Acceso ClinVar</dt><dd>{selectedRecord.clinVarAccession ?? `UID ${selectedRecord.sourceRecordId}`}</dd></div>
                    <div><dt>Genes asociados</dt><dd>{selectedRecord.geneSymbols.join(", ") || "No informados"}</dd></div>
                    <div><dt>rsID</dt><dd>{selectedRecord.dbSnpRsIds.join(", ") || "No informado"}</dd></div>
                    <div><dt>Tipo de variante</dt><dd>{selectedRecord.variantType ?? "No informado"}</dd></div>
                    <div><dt>Ubicación</dt><dd>{selectedRecord.assembly && selectedRecord.chromosome && selectedRecord.position ? `${selectedRecord.assembly} · chr${selectedRecord.chromosome}:${selectedRecord.position}` : "No informada"}</dd></div>
                    <div><dt>Interpretación ClinVar</dt><dd>{selectedRecord.clinicalSignificance ?? "No informada"}{selectedRecord.reviewStatus ? ` · ${selectedRecord.reviewStatus}` : ""}</dd></div>
                  </dl>
                )}
                <div className="record-dialog-footer">
                  <span>ID de origen: {selectedRecord.sourceRecordId}</span>
                  <a href={selectedRecord.sourceUrl} target="_blank" rel="noreferrer">Fuente original <ExternalLink size={14} /></a>
                </div>
                {selectedRecord.source === "CLINVAR" && <p className="record-caveat">La clasificación ClinVar no representa por sí sola una recomendación farmacológica ni accionabilidad terapéutica.</p>}
              </section>
            </div>
          )}

          <section className="local-section" id="local-filters" aria-labelledby="local-filter-heading">
            <div className="section-heading local-heading">
              <div className="section-number coral-number">02</div>
              <div><p className="eyebrow">BASE LOCAL · POSTGRESQL</p><h2 id="local-filter-heading">Filtrar asociaciones</h2></div>
              <span className="local-only-label"><Filter size={14} />FILTROS COMBINABLES</span>
            </div>
            <form className="filter-form" onSubmit={filterAssociations}>
              <div className="filter-grid">
                {filterFields.map((field) => (
                  <label className="filter-field" key={field.name}>
                    <span>{field.label}</span>
                    <input name={field.name} placeholder="Cualquier valor" />
                  </label>
                ))}
                <label className="filter-field">
                  <span>Accionabilidad</span>
                  <select name="actionability" defaultValue="">
                    <option value="">Cualquier estado</option>
                    <option value="ACTIONABLE_GUIDELINE">Guía clínica accionable</option>
                    <option value="CLINICAL_ASSOCIATION">Asociación clínica</option>
                    <option value="RESEARCH_ONLY">Solo investigación</option>
                    <option value="NOT_ASSESSED">No evaluada</option>
                    <option value="CONFLICTING_EVIDENCE">Evidencia conflictiva</option>
                  </select>
                </label>
              </div>
              <div className="filter-actions">
                {filterMessage && <span className="filter-error" role="status">{filterMessage}</span>}
                <button className="secondary-button" type="submit" disabled={filterPending}>{filterPending ? "Filtrando..." : "Aplicar filtros"}<ArrowUpRight size={15} /></button>
              </div>
            </form>
            {associations.length > 0 ? (
              <div className="association-list">
                <div className="results-heading"><span>ASOCIACIONES LOCALES</span><span>{associationTotal} coincidencias</span></div>
                {associations.map((association) => (
                  <article className="association-row" key={association.id}>
                    <div className="association-primary"><strong>{association.gene?.symbol ?? "Gen no especificado"}</strong><span>{association.variant?.dbSnpRsIds.join(", ") || association.variant?.title || "Sin variante especificada"}</span></div>
                    <div className="association-primary"><strong>{association.drug?.name ?? "Fármaco no especificado"}</strong><span>{association.phenotype?.name ?? association.mechanism ?? "Sin mecanismo informado"}</span></div>
                    <div className="association-status"><span className="type-label">{displayLabel(association.associationType)}</span><span className={`actionability action-${association.actionability.toLowerCase()}`}>{displayLabel(association.actionability)}</span><small>{association.source} · {association.evidenceLevel ?? "nivel no informado"}</small></div>
                  </article>
                ))}
              </div>
            ) : (
              !filterMessage && <div className="local-empty"><SlidersHorizontal size={17} /><span>Aplica uno o más filtros para consultar asociaciones importadas.</span></div>
            )}
          </section>

          <footer className="page-footer" id="source-status">
            <span><span className="footer-mark" />NEUROPHARM ATLAS · MOTOR DE INTEGRACIÓN</span>
            <span>Solo se muestran conectores comprobados; fuentes adicionales pendientes de acceso y licencia.</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
