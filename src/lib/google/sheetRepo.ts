import "server-only";
import { getSheetsClient, getSpreadsheetId } from "./sheetsClient";
import { HEADERS, type SheetName } from "./schema";

export type SheetRow = Record<string, string>;

interface CacheEntry {
  rows: SheetRow[];
  expiresAt: number;
}

const cache = new Map<SheetName, CacheEntry>();

/** Cache trong bộ nhớ tiến trình, TTL ngắn — giảm số lần gọi Google Sheets API
 * cho các sheet cấu hình ít thay đổi (Classes, Criteria, Settings, Users).
 * Vercel serverless có thể tái sử dụng warm instance nên vẫn có lợi trong
 * các request liên tiếp gần nhau; không ảnh hưởng tính đúng đắn vì TTL ngắn. */
const CACHE_TTL_MS = 60_000;

function colLetter(index: number): string {
  // index 0-based -> "A", "B", ... "Z", "AA", ...
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function rowArrayToObject(headers: readonly string[], row: string[]): SheetRow {
  const obj: SheetRow = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  return obj;
}

function objectToRowArray(headers: readonly string[], obj: SheetRow): string[] {
  return headers.map((h) => obj[h] ?? "");
}

async function fetchAllRows(sheetName: SheetName): Promise<SheetRow[]> {
  const headers = HEADERS[sheetName];
  const lastCol = colLetter(headers.length - 1);
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A2:${lastCol}`,
  });
  const values = res.data.values ?? [];
  return values
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => rowArrayToObject(headers, row as string[]));
}

export async function getAllRows(
  sheetName: SheetName,
  opts: { cache?: boolean } = {},
): Promise<SheetRow[]> {
  const useCache = opts.cache ?? true;
  if (useCache) {
    const entry = cache.get(sheetName);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.rows;
    }
  }
  const rows = await fetchAllRows(sheetName);
  cache.set(sheetName, { rows, expiresAt: Date.now() + CACHE_TTL_MS });
  return rows;
}

export function invalidateCache(sheetName: SheetName) {
  cache.delete(sheetName);
}

export async function appendRow(
  sheetName: SheetName,
  obj: SheetRow,
): Promise<void> {
  const headers = HEADERS[sheetName];
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [objectToRowArray(headers, obj)] },
  });
  invalidateCache(sheetName);
}

export async function appendRows(
  sheetName: SheetName,
  objs: SheetRow[],
): Promise<void> {
  if (objs.length === 0) return;
  const headers = HEADERS[sheetName];
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: objs.map((obj) => objectToRowArray(headers, obj)) },
  });
  invalidateCache(sheetName);
}

/**
 * Tìm dòng theo điều kiện `matcher` và cập nhật toàn bộ dòng đó bằng `updates`
 * (merge nông vào bản ghi cũ). Trả về false nếu không tìm thấy.
 * Đọc lại trực tiếp từ Sheets (không dùng cache) để giảm rủi ro ghi đè dữ liệu cũ.
 */
export async function updateRowWhere(
  sheetName: SheetName,
  matcher: (row: SheetRow) => boolean,
  updates: Partial<SheetRow>,
): Promise<boolean> {
  const headers = HEADERS[sheetName];
  const lastCol = colLetter(headers.length - 1);
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A2:${lastCol}`,
  });
  const values = res.data.values ?? [];

  for (let i = 0; i < values.length; i++) {
    const rowArr = values[i] as string[];
    const rowObj = rowArrayToObject(headers, rowArr);
    if (matcher(rowObj)) {
      const merged = { ...rowObj, ...updates } as SheetRow;
      const rowNumber = i + 2; // +1 header, +1 vì mảng 0-based
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values: [objectToRowArray(headers, merged)] },
      });
      invalidateCache(sheetName);
      return true;
    }
  }
  return false;
}

export async function ensureSheetWithHeader(sheetName: SheetName): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some(
    (s) => s.properties?.title === sheetName,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }
  const headers = HEADERS[sheetName];
  const lastCol = colLetter(headers.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:${lastCol}1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...headers]] },
  });
}
