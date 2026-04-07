/**
 * bank-import/twogis.ts
 *
 * Поиск информации о мерчанте через 2GIS Suggest/Search API.
 * Возвращает нормализованное название и внешнюю категорию.
 *
 * Env: TWOGIS_API_KEY — ключ из https://dev.2gis.ru/
 */

export type GisResult = {
  normalizedName: string;
  externalCategory: string | null; // например "Продукты", "Кафе", "АЗС"
  address: string | null;
  found: boolean;
};

const GIS_SUGGEST_URL = "https://catalog.api.2gis.com/3.0/suggests";
const GIS_SEARCH_URL  = "https://catalog.api.2gis.com/3.0/items";

function normalizeMerchant(raw: string): string {
  return raw
    .replace(/\d{4,}/g, "")          // убираем коды терминала
    .replace(/\bSPB\b|\bMSK\b/ig, "") // убираем коды городов
    .replace(/[*#@]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80);
}

export async function searchMerchant(merchantRaw: string): Promise<GisResult> {
  const apiKey = process.env.TWOGIS_API_KEY;
  if (!apiKey) {
    return { normalizedName: normalizeMerchant(merchantRaw), externalCategory: null, address: null, found: false };
  }

  const query = normalizeMerchant(merchantRaw);
  if (!query) {
    return { normalizedName: merchantRaw, externalCategory: null, address: null, found: false };
  }

  try {
    const url = new URL(GIS_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fields", "items.rubrics,items.address_name,items.name");
    url.searchParams.set("page_size", "1");
    url.searchParams.set("locale", "ru_RU");

    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) throw new Error(`2GIS status ${resp.status}`);

    const data = await resp.json() as any;
    const item = data?.result?.items?.[0];
    if (!item) {
      return { normalizedName: query, externalCategory: null, address: null, found: false };
    }

    const rubric: string | null = item.rubrics?.[0]?.name ?? null;
    const address: string | null = item.address_name ?? null;
    const name: string = item.name ?? query;

    return { normalizedName: name, externalCategory: rubric, address, found: true };
  } catch (e: any) {
    console.warn("[2gis] search failed:", e.message);
    return { normalizedName: query, externalCategory: null, address: null, found: false };
  }
}
