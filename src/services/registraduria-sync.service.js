import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { MesaOficialBogota } from "../models/MesaOficialBogota.js";
import { getBogotaLocalidades } from "../shared/bogota-territory.js";
import { canonicalizeBogotaLocality } from "../shared/territoryNormalization.js";
import { normalizeMesaNumber, normalizeText } from "../shared/textNormalization.js";

const DEFAULT_DEPARTMENT_URL = "https://divulgacione14congreso.registraduria.gov.co/departamento/16";
const HTTP_TIMEOUT_MS = 20000;
const BOGOTA_DEPARTMENT_CODE = "16";
const JSON_CANDIDATE_URLS = [
  "https://divulgacione14congreso.registraduria.gov.co/assets/temis/divipol_json/departmentsTree.json",
  "https://divulgacione14congreso.registraduria.gov.co/divipol_json/departmentsTree.json",
  "https://divulgacione14congreso.registraduria.gov.co/assets/congreso/divipol_json/departmentsTree.json"
];
const GRAPHQL_ENDPOINT = "https://apx2e14awsprodcong.tps.net.co/graphql";
const GRAPHQL_REGION = "us-east-2";
const COGNITO_IDENTITY_POOL_ID = "us-east-2:b3d8591c-b2ce-40b6-a96c-550c26f7bfd9";
const COGNITO_IDENTITY_ENDPOINT = `https://cognito-identity.${GRAPHQL_REGION}.amazonaws.com/`;
const DEFAULT_CORPORACION = "CAMARA";
const BOGOTA_ZONE_TO_LOCALIDAD = new Map(
  getBogotaLocalidades().map((item) => [String(item.zoneCode).padStart(2, "0"), item.displayName || item.name])
);
const DEPARTMENTS_TREE_QUERY = `
query DepartmentsTree($first: Int = 500000) {
  departmentsTree(first: $first, orderBy: "DEPARTMENT_NAME_ASC") {
    edges {
      node {
        idDepartmentCode
        departmentName
        municipalities {
          municipalityCode
          municipalityName
          zones {
            idZoneCode
            zoneName
            stands {
              standCode
              standName
              countTable
            }
          }
        }
      }
    }
  }
}
`;

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function buildSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = crypto.createHmac("sha256", kDate).update(region, "utf8").digest();
  const kService = crypto.createHmac("sha256", kRegion).update(service, "utf8").digest();
  return crypto.createHmac("sha256", kService).update("aws4_request", "utf8").digest();
}

function formatAmzDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8)
  };
}

async function getGuestAwsCredentials() {
  const commonHeaders = {
    "Content-Type": "application/x-amz-json-1.1"
  };

  const getIdResponse = await axios.post(
    COGNITO_IDENTITY_ENDPOINT,
    { IdentityPoolId: COGNITO_IDENTITY_POOL_ID },
    {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        ...commonHeaders,
        "X-Amz-Target": "AWSCognitoIdentityService.GetId"
      }
    }
  );

  const identityId = getIdResponse?.data?.IdentityId;
  if (!identityId) {
    throw new Error("No se obtuvo IdentityId invitado desde Cognito");
  }

  const credentialsResponse = await axios.post(
    COGNITO_IDENTITY_ENDPOINT,
    { IdentityId: identityId },
    {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        ...commonHeaders,
        "X-Amz-Target": "AWSCognitoIdentityService.GetCredentialsForIdentity"
      }
    }
  );

  const credentials = credentialsResponse?.data?.Credentials;
  if (!credentials?.AccessKeyId || !credentials?.SecretKey || !credentials?.SessionToken) {
    throw new Error("No se obtuvieron credenciales temporales IAM");
  }

  return credentials;
}

async function fetchDepartmentsTreeGraphqlWithGuestIdentity() {
  const credentials = await getGuestAwsCredentials();
  const { amzDate, dateStamp } = formatAmzDate();
  const endpoint = new URL(process.env.E14_GRAPHQL_URL || GRAPHQL_ENDPOINT);
  const host = endpoint.host;
  const payload = JSON.stringify({
    query: DEPARTMENTS_TREE_QUERY,
    variables: { first: 500000 }
  });
  const payloadHash = sha256Hex(payload);
  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\nx-amz-security-token:${credentials.SessionToken}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token";
  const canonicalRequest = [
    "POST",
    endpoint.pathname || "/graphql",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${GRAPHQL_REGION}/appsync/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = buildSignatureKey(credentials.SecretKey, dateStamp, GRAPHQL_REGION, "appsync");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await axios.post(
    endpoint.toString(),
    payload,
    {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Host: host,
        "X-Amz-Date": amzDate,
        "X-Amz-Security-Token": credentials.SessionToken,
        "X-Amz-Content-Sha256": payloadHash,
        Authorization: authorization
      }
    }
  );

  return response.data;
}

function resolveUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch (_) {
    return null;
  }
}

function uniqueLinks(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function extractLinksByHint(html, pageUrl, hints = []) {
  const $ = cheerio.load(html);
  const links = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const text = ($(el).text() || "").trim().toLowerCase();
    const hit = hints.some((hint) => href.toLowerCase().includes(hint) || text.includes(hint));
    if (hit) {
      const absolute = resolveUrl(pageUrl, href);
      if (absolute) links.push(absolute);
    }
  });
  return uniqueLinks(links);
}

function extractMesasFromHtml(html) {
  const $ = cheerio.load(html);
  const mesas = new Set();

  // tablas/listas con etiqueta "mesa"
  $("tr, li, option, a, td, span, div").each((_, el) => {
    const text = ($(el).text() || "").trim();
    if (!text) return;
    const mesaMatch = text.match(/\bmesa\s*[:#\-]?\s*(\d{1,4})\b/i);
    if (mesaMatch) {
      const mesa = normalizeMesaNumber(mesaMatch[1]);
      if (mesa) mesas.add(mesa);
    }
  });

  // fallback: secuencias de "mesa 1, mesa 2..." dentro del HTML
  const regex = /\bmesa\s*[:#\-]?\s*(\d{1,4})\b/gi;
  let found = regex.exec(html);
  while (found) {
    const mesa = normalizeMesaNumber(found[1]);
    if (mesa) mesas.add(mesa);
    found = regex.exec(html);
  }

  return [...mesas].sort((a, b) => a - b);
}

function extractLocalidadAndPuesto(html) {
  const $ = cheerio.load(html);
  const breadcrumbs = $(".breadcrumb li, nav[aria-label='breadcrumb'] li")
    .map((_, el) => ($(el).text() || "").trim())
    .get()
    .filter(Boolean);
  const h1 = $("h1").first().text().trim();
  const h2 = $("h2").first().text().trim();
  const title = $("title").text().trim();

  const localityCandidate =
    breadcrumbs.find((x) => /bogota|suba|usaquen|kennedy|engativa|chapinero|bosa|fontibon|teusaquillo|usme|ciudad bolivar|antonio narino|barrios unidos|candelaria|martires|puente aranda|rafael uribe|san cristobal|sumapaz|tunjuelito/i.test(x)) ||
    h2 ||
    "";

  const puestoCandidate =
    breadcrumbs[breadcrumbs.length - 1] ||
    h1 ||
    title ||
    "";

  return {
    localidad: localityCandidate || "BOGOTA",
    puesto: puestoCandidate || "PUESTO SIN NOMBRE"
  };
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MiServidorBot/1.0; +https://localhost)",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  return response.data;
}

async function fetchJsonCandidate(url) {
  const response = await axios.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MiServidorBot/1.0; +https://localhost)",
      Accept: "application/json,text/plain,*/*"
    }
  });
  return response.data;
}

async function fetchDepartmentsTreeGraphql() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; MiServidorBot/1.0; +https://localhost)",
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  // Permite auth explícita por ambiente para despliegues donde sea necesario
  if (process.env.E14_GRAPHQL_AUTHORIZATION) {
    headers.Authorization = process.env.E14_GRAPHQL_AUTHORIZATION;
  }
  if (process.env.E14_GRAPHQL_API_KEY) {
    headers["x-api-key"] = process.env.E14_GRAPHQL_API_KEY;
  }

  try {
    const response = await axios.post(
      process.env.E14_GRAPHQL_URL || GRAPHQL_ENDPOINT,
      {
        query: DEPARTMENTS_TREE_QUERY,
        variables: { first: 500000 }
      },
      {
        timeout: HTTP_TIMEOUT_MS,
        headers
      }
    );
    return response.data;
  } catch (error) {
    if (error?.response?.status !== 401 && error?.response?.status !== 403) {
      throw error;
    }
    return fetchDepartmentsTreeGraphqlWithGuestIdentity();
  }
}

function extractCodigoPuestoFromUrl(url) {
  const matches = url.match(/(\d{3,})/g);
  if (!matches || matches.length === 0) return null;
  return matches[matches.length - 1];
}

function canonicalizeOfficialZone(zoneName, zoneCode = null) {
  const normalizedCode = zoneCode ? String(zoneCode).padStart(2, "0") : "";
  const byCode = normalizedCode ? BOGOTA_ZONE_TO_LOCALIDAD.get(normalizedCode) : null;
  const canonical = canonicalizeBogotaLocality(byCode || zoneName);
  return String(canonical || zoneName || "Sin Zona").trim();
}

function buildOfficialCatalogDoc({
  localidad,
  zonaCodigo = null,
  puesto,
  mesa,
  codigoPuesto = null,
  sourceUrl = null,
  officialSourceVersion = null
}) {
  const canonicalLocalidad = canonicalizeOfficialZone(localidad);
  return {
    corporacion: DEFAULT_CORPORACION,
    departamentoCodigo: BOGOTA_DEPARTMENT_CODE,
    municipio: "BOGOTA. D.C.",
    localidad: canonicalLocalidad,
    zonaNombre: canonicalLocalidad,
    zonaCodigo: zonaCodigo ? String(zonaCodigo) : null,
    puesto: String(puesto || "").trim(),
    mesa,
    codigoPuesto: codigoPuesto ? String(codigoPuesto) : null,
    sourceUrl,
    officialSourceVersion,
    syncedAt: new Date(),
    normalizedLocalidad: normalizeText(canonicalLocalidad),
    normalizedPuesto: normalizeText(puesto)
  };
}

export async function syncBogotaMesas(options = {}) {
  const departmentUrl = options.departmentUrl || DEFAULT_DEPARTMENT_URL;
  const warnings = [];
  const errors = [];
  let puestosProcesados = 0;
  let mesasEncontradas = 0;
  let mesasInsertadas = 0;
  let mesasActualizadas = 0;
  let sourceUsed = "html";
  const trace = {
    departmentUrl,
    municipioLinksFound: 0,
    puestoLinksFound: 0,
    puestoPagesVisited: 0,
    mesaPagesWithResults: 0,
    sampleMunicipioLinks: [],
    samplePuestoLinks: []
  };

  const upsertOps = [];
  const sourceVersion = `bogota-camara-${new Date().toISOString().slice(0, 10)}`;

  // 0) Intento GraphQL directo (si hay auth disponible)
  try {
    const gqlPayload = await fetchDepartmentsTreeGraphql();
    const edges = gqlPayload?.data?.departmentsTree?.edges;
    if (Array.isArray(edges) && edges.length > 0) {
      edges.forEach((edge) => {
        const dept = edge?.node;
        if (!dept || String(dept.idDepartmentCode) !== BOGOTA_DEPARTMENT_CODE) return;
        const municipalities = Array.isArray(dept.municipalities) ? dept.municipalities : [];
        municipalities.forEach((mun) => {
          const zones = Array.isArray(mun?.zones) ? mun.zones : [];
          zones.forEach((zone) => {
            const zoneCode = zone?.idZoneCode ? String(zone.idZoneCode).padStart(2, "0") : null;
            if (!BOGOTA_ZONE_TO_LOCALIDAD.has(zoneCode)) return;
            const localidad = canonicalizeOfficialZone(zone?.zoneName || mun?.municipalityName || "BOGOTA", zoneCode);
            const stands = Array.isArray(zone?.stands) ? zone.stands : [];
            stands.forEach((stand) => {
              const puesto = String(stand?.standName || "").trim();
              const codigoPuesto = stand?.standCode ? String(stand.standCode) : null;
              const numberTable = Number.parseInt(String(stand?.countTable ?? "0"), 10);
              if (!puesto || !Number.isFinite(numberTable) || numberTable <= 0) return;
              puestosProcesados += 1;
              for (let mesa = 1; mesa <= numberTable; mesa += 1) {
                mesasEncontradas += 1;
                const doc = buildOfficialCatalogDoc({
                  localidad,
                  zonaCodigo: zoneCode,
                  puesto,
                  mesa,
                  codigoPuesto,
                  sourceUrl: process.env.E14_GRAPHQL_URL || GRAPHQL_ENDPOINT,
                  officialSourceVersion: sourceVersion
                });
                upsertOps.push({
                  updateOne: {
                    filter: {
                      corporacion: DEFAULT_CORPORACION,
                      normalizedLocalidad: doc.normalizedLocalidad,
                      normalizedPuesto: doc.normalizedPuesto,
                      mesa
                    },
                    update: {
                      $set: doc
                    },
                    upsert: true
                  }
                });
              }
            });
          });
        });
      });
      if (upsertOps.length > 0) {
        sourceUsed = "graphql";
      }
    }
  } catch (error) {
    warnings.push(`GraphQL E14 no accesible sin credenciales firmadas (${error.message}).`);
  }

  // 1) Intento principal: fuente JSON interna del portal (si está pública)
  for (const url of JSON_CANDIDATE_URLS) {
    if (upsertOps.length > 0) break;
    try {
      const payload = await fetchJsonCandidate(url);
      const asString = typeof payload === "string" ? payload : JSON.stringify(payload || {});
      if (/<!doctype html>/i.test(asString)) {
        warnings.push(`JSON no accesible en ${url} (respondió HTML).`);
        continue;
      }

      const edges = payload?.data?.departmentsTree?.edges;
      if (!Array.isArray(edges) || edges.length === 0) {
        warnings.push(`JSON sin estructura departmentsTree en ${url}.`);
        continue;
      }

      edges.forEach((edge) => {
        const dept = edge?.node;
        if (!dept || String(dept.idDepartmentCode) !== BOGOTA_DEPARTMENT_CODE) return;
        const municipalities = Array.isArray(dept.municipalities) ? dept.municipalities : [];
        municipalities.forEach((mun) => {
          const zones = Array.isArray(mun?.zones) ? mun.zones : [];
          zones.forEach((zone) => {
            const zoneCode = zone?.idZoneCode ? String(zone.idZoneCode).padStart(2, "0") : null;
            if (!BOGOTA_ZONE_TO_LOCALIDAD.has(zoneCode)) return;
            const localidad = canonicalizeOfficialZone(zone?.zoneName || mun?.municipalityName || "BOGOTA", zoneCode);
            const stands = Array.isArray(zone?.stands) ? zone.stands : [];
            stands.forEach((stand) => {
              const puesto = String(stand?.standName || "").trim();
              const codigoPuesto = stand?.standCode ? String(stand.standCode) : null;
              const numberTable = Number.parseInt(String(stand?.countTable ?? "0"), 10);
              if (!puesto || !Number.isFinite(numberTable) || numberTable <= 0) return;
              puestosProcesados += 1;
              for (let mesa = 1; mesa <= numberTable; mesa += 1) {
                mesasEncontradas += 1;
                const doc = buildOfficialCatalogDoc({
                  localidad,
                  zonaCodigo: zoneCode,
                  puesto,
                  mesa,
                  codigoPuesto,
                  sourceUrl: url,
                  officialSourceVersion: sourceVersion
                });
                upsertOps.push({
                  updateOne: {
                    filter: {
                      corporacion: DEFAULT_CORPORACION,
                      normalizedLocalidad: doc.normalizedLocalidad,
                      normalizedPuesto: doc.normalizedPuesto,
                      mesa
                    },
                    update: {
                      $set: doc
                    },
                    upsert: true
                  }
                });
              }
            });
          });
        });
      });

      if (upsertOps.length > 0) {
        sourceUsed = `json:${url}`;
        break;
      }
    } catch (error) {
      warnings.push(`Error consultando fuente JSON ${url}: ${error.message}`);
    }
  }

  let departmentHtml = "";
  // 2) Fallback HTML crawler (si JSON no fue accesible)
  if (upsertOps.length === 0) {
    try {
      departmentHtml = await fetchHtml(departmentUrl);
    } catch (error) {
      return {
        success: false,
        puestosProcesados: 0,
        mesasEncontradas: 0,
        mesasInsertadas: 0,
        mesasActualizadas: 0,
        errores: [{ stage: "departamento", url: departmentUrl, error: error.message }],
        source: sourceUsed
      };
    }

    let municipioLinks = extractLinksByHint(departmentHtml, departmentUrl, ["municipio"]);
    trace.municipioLinksFound = municipioLinks.length;
    trace.sampleMunicipioLinks = municipioLinks.slice(0, 5);
    if (municipioLinks.length === 0) {
      warnings.push("No se detectaron enlaces de municipio; se procesa la página de departamento como fallback.");
      municipioLinks = [departmentUrl];
    }

    for (const municipioUrl of municipioLinks) {
      let municipioHtml = "";
      try {
        municipioHtml = municipioUrl === departmentUrl ? departmentHtml : await fetchHtml(municipioUrl);
      } catch (error) {
        errors.push({ stage: "municipio", url: municipioUrl, error: error.message });
        continue;
      }

      let puestoLinks = extractLinksByHint(municipioHtml, municipioUrl, ["puesto"]);
      trace.puestoLinksFound += puestoLinks.length;
      if (trace.samplePuestoLinks.length < 5) {
        trace.samplePuestoLinks = trace.samplePuestoLinks.concat(
          puestoLinks.slice(0, 5 - trace.samplePuestoLinks.length)
        );
      }
      if (puestoLinks.length === 0) {
        // Fallback: misma página puede traer mesas por puesto
        puestoLinks = [municipioUrl];
      }

      for (const puestoUrl of puestoLinks) {
        trace.puestoPagesVisited += 1;
        let puestoHtml = "";
        try {
          puestoHtml = puestoUrl === municipioUrl ? municipioHtml : await fetchHtml(puestoUrl);
        } catch (error) {
          errors.push({ stage: "puesto", url: puestoUrl, error: error.message });
          continue;
        }

        const mesas = extractMesasFromHtml(puestoHtml);
        const extracted = extractLocalidadAndPuesto(puestoHtml);
        const localidad = canonicalizeOfficialZone(extracted.localidad);
        const puesto = extracted.puesto;
        const codigoPuesto = extractCodigoPuestoFromUrl(puestoUrl);

        puestosProcesados += 1;
        mesasEncontradas += mesas.length;

        if (mesas.length === 0) {
          warnings.push(`Sin mesas detectadas para puesto URL: ${puestoUrl}`);
          continue;
        }
        trace.mesaPagesWithResults += 1;

        for (const mesa of mesas) {
          const doc = buildOfficialCatalogDoc({
            localidad,
            puesto,
            mesa,
            codigoPuesto: codigoPuesto || null,
            sourceUrl: puestoUrl,
            officialSourceVersion: sourceVersion
          });
          upsertOps.push({
            updateOne: {
              filter: {
                corporacion: DEFAULT_CORPORACION,
                normalizedLocalidad: doc.normalizedLocalidad,
                normalizedPuesto: doc.normalizedPuesto,
                mesa
              },
              update: {
                $set: doc
              },
              upsert: true
            }
          });
        }
      }
    }
  }

  if (upsertOps.length > 0) {
    await MesaOficialBogota.deleteMany({});
    const result = await MesaOficialBogota.bulkWrite(upsertOps, { ordered: false });
    mesasInsertadas = Number(result.upsertedCount || 0);
    mesasActualizadas = Number(result.modifiedCount || 0);
  } else {
    warnings.push("No se pudo extraer ninguna mesa oficial con las fuentes disponibles.");
  }

  return {
    success: errors.length === 0,
    puestosProcesados: puestosProcesados,
    mesasEncontradas: mesasEncontradas,
    mesasInsertadas: mesasInsertadas,
    mesasActualizadas: mesasActualizadas,
    errores: errors,
    warnings,
    source: sourceUsed,
    trace,
    // Compat con formato anterior
    puestos_procesados: puestosProcesados,
    mesas_encontradas: mesasEncontradas,
    mesas_insertadas: mesasInsertadas
  };
}

export default {
  syncBogotaMesas
};
