import * as XLSX from "xlsx";

/**
 * Pure client-side Excel parser using SheetJS (xlsx)
 * Converts Screener .xlsx workbook into structured financial statement objects
 */
export async function parseWorkbook(file) {
  if (!file) throw new Error("No file provided");

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const result = {
    companyName: file.name.replace(/\.[^/.]+$/, ""),
    sheets: {},
    rows: []
  };

  // Extract all sheets into JSON rows
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    result.sheets[sheetName] = jsonData;
  });

  // Pick the primary statement sheet for quick table rendering
  const preferredSheets = ["Data Sheet", "Profit & Loss", "Balancesheet", "Financials", workbook.SheetNames[0]];
  for (const name of preferredSheets) {
    if (result.sheets[name] && result.sheets[name].length > 0) {
      result.rows = result.sheets[name];
      break;
    }
  }

  return result;
}

export default parseWorkbook;