# Acceso y limitaciones de fuentes

Evaluación inicial: 2026-11-02. Un endpoint documentado no implica que haya sido probado desde este entorno ni que se permita redistribuir sus datos. Los términos de servicio/licencia deben revisarse por recurso y versión antes de habilitar cargas masivas o redistribución.

## Fuentes farmacogenómicas

| Fuente | Superficie oficial de acceso | Resultado de evaluación | Límites y tratamiento |
|---|---|---|---|
| PharmGKB | [Descargas](https://www.pharmgkb.org/downloads) · [Términos](https://www.pharmgkb.org/terms) | Los recursos de descarga están publicados; API estable y acceso automatizado no confirmados en este entorno. | Revisar términos y condiciones del archivo concreto. No asumir que una anotación clínica equivale a recomendación de dosis. |
| PharmGKB Clinical Annotations | [Anotaciones clínicas](https://www.pharmgkb.org/clinicalAnnotation) · [Descargas](https://www.pharmgkb.org/downloads) | Se consulta como parte de PharmGKB; no se ha implementado ni verificado un endpoint de API. | Conservar nivel, fenotipo, medicamento, publicación y versión de anotación. Evaluar accionabilidad por separado. |
| CPIC | [Guías](https://cpicpgx.org/guidelines/) | Guías y materiales suplementarios consultables en su sitio; API pública estable no confirmada. | Respetar licencia del artículo/material y distinguir recomendación CPIC de evidencia observacional. |
| PharmVar | [PharmVar](https://www.pharmvar.org/) · [Descargas](https://www.pharmvar.org/downloads) | Sitio y descargas oficiales; API no confirmada. | Los alelos dependen de versiones y nomenclatura. Registrar versión de referencia y cita. |
| FDA Pharmacogenetic Associations | [Tabla oficial](https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations) | Tabla web oficial localizada; endpoint REST estable no confirmado. | La inclusión en la tabla no significa por sí sola que FDA recomiende pruebas o ajuste terapéutico. |
| DPWG | [Recursos de farmacogenética de KNMP](https://www.knmp.nl/patientenzorg/medicatiebewaking/farmacogenetica) | Materiales y guías accesibles a través de KNMP/publicaciones; API pública estable no confirmada. | Comprobar acceso, versión, idioma y derechos de reutilización de cada guía o suplemento. |

## Genética y biología molecular

| Fuente | Superficie oficial de acceso | Resultado de evaluación | Límites y tratamiento |
|---|---|---|---|
| NCBI Gene | [E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) | **Probado:** `ESearch` y `ESummary` de `db=gene` devolvieron HTTP 200 en este entorno; la consulta de BRCA1 resolvió Gene ID 672. | NCBI publica un límite por defecto de 3 solicitudes/s por IP y hasta 10/s con API key. El conector usa ~2.85/s sin key o ~9/s con key, reintentos y `tool`; `NCBI_EMAIL` y `NCBI_API_KEY` son opcionales. Ver [política E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25497/). |
| Ensembl | [REST API](https://rest.ensembl.org/documentation/) | La documentación oficial existe; `rest.ensembl.org/info/ping` agotó el tiempo de espera en este entorno. No está implementado. | Respetar las cabeceras de rate limit y los requisitos de atribución de datos. No se afirma que el servicio estuviera caído globalmente. |
| UniProt | [REST API](https://www.uniprot.org/help/api) | API oficial documentada; no se hizo una consulta operativa desde este entorno. | Consultar políticas de uso, paginación y formatos antes de sincronizar. |
| ClinVar | [Documentación](https://www.ncbi.nlm.nih.gov/clinvar/docs/) · [E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) | **Probado:** `ESearch` y `ESummary` de `db=clinvar` devolvieron HTTP 200; una búsqueda de rs429358 devolvió 8 IDs en el momento de la consulta. | El conector conserva clasificación/revisión y acceso ClinVar; no convierte la interpretación de variante en acción farmacológica. Límites E-utilities compartidos con NCBI Gene. |
| dbSNP | [Documentación dbSNP](https://www.ncbi.nlm.nih.gov/snp/docs/) · [E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) | IDs dbSNP/rs se extraen como referencias cruzadas de los registros ClinVar importados; no hay conector independiente. | No usar un rsID aislado como sustituto de alelo, ensamblaje o representación normalizada. |
| gnomAD | [Portal gnomAD](https://gnomad.broadinstitute.org/) · [API](https://gnomad.broadinstitute.org/api) | Portal/API y recursos de datos son puntos de entrada oficiales; acceso, esquema y licencia de una integración no se probaron. | Distinguir versión del conjunto, ensamblaje y frecuencia poblacional; no inferir patogenicidad ni respuesta a fármacos. |

## Farmacología

| Fuente | Superficie oficial de acceso | Resultado de evaluación | Límites y tratamiento |
|---|---|---|---|
| ChEMBL | [API de datos](https://www.ebi.ac.uk/chembl/api/data/docs) | REST documentada; no probada desde este entorno. | Confirmar licencia/atribución del recurso descargado y registrar el ID ChEMBL. |
| PubChem | [PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) | API oficial documentada; no probada desde este entorno. | Aplicar sus límites de servicio, backoff y manejo de respuestas de sobrecarga; usar CID como identificador oficial. |
| DGIdb | [API](https://dgidb.org/api) | API documentada; no probada desde este entorno. | Validar esquema GraphQL, versión, licencia y procedencia de cada interacción antes de importarla. |
| Open Targets Platform | [GraphQL y acceso a datos](https://platform-docs.opentargets.org/data-access/graphql-api) | API/documentación de acceso oficial; no probada desde este entorno. | Evidencia agregada puede tener fuentes primarias distintas; conservar fuente y tipo de evidencia de cada asociación. |
| DrugBank | [DrugBank](https://go.drugbank.com/) · [Developer portal](https://dev.drugbank.com/) | No se ha configurado ni consultado. | Deshabilitado hasta que exista licencia y autorización explícita para la API/datos requeridos. |

## Implementado y política de actualización

Solo NCBI Gene y ClinVar están registrados como conectores activos. Se probaron E-utilities con consultas puntuales de solo lectura el 2026-11-02; los resultados cambian con las actualizaciones de NCBI y no se guardan como fixtures ni como evidencia clínica.

Las consultas se cachean durante seis horas. `refresh=true` fuerza una nueva consulta. La importación conserva el registro original y hace upsert por NCBI Gene ID o acceso ClinVar; cada ejecución se registra en `IngestionRun`. Un scheduler externo puede repetir consultas guardadas vía `POST /api/import` con `refresh: true`. No hay todavía un cron desplegado ni una sincronización masiva automática.

Las demás fuentes permanecen en el catálogo del esquema, no en el registro de conectores. Antes de activarlas: revisar documentación/versiones, permisos y términos; medir cuotas; implementar paginación/backoff; crear pruebas de contrato con respuestas autorizadas; y guardar procedencia/citas. No se hace scraping de HTML ni se inventan endpoints.

## Uso clínico

`AssociationType` diferencia farmacocinética, farmacodinámica, efectos adversos, evidencia experimental y otros tipos. `ActionabilityStatus` es un campo separado y empieza en `NOT_ASSESSED`. Importar una variante o una clasificación ClinVar no crea una asociación gen-fármaco ni una recomendación clínica. La atribución de accionabilidad requiere evidencia y guía aplicable verificadas.