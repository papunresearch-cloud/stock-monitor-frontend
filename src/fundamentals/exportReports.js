import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Excel Export Function
 */
export function exportToXlsx(data, isBank = false) {
  if (!data) {
    alert("No data available to export.");
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    if (data.sheets && typeof data.sheets === "object") {
      Object.keys(data.sheets).forEach((sheetName) => {
        const sheetData = data.sheets[sheetName];
        if (Array.isArray(sheetData)) {
          const ws = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
        }
      });
    } else if (Array.isArray(data.rows)) {
      const ws = XLSX.utils.json_to_sheet(data.rows);
      XLSX.utils.book_append_sheet(wb, ws, isBank ? "Bank_Financials" : "Company_Financials");
    } else {
      const rows = Object.entries(data).map(([key, value]) => ({
        Metric: key,
        Value: typeof value === "object" ? JSON.stringify(value) : value,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, isBank ? "Bank_Data" : "Financial_Data");
    }

    const filename = `${isBank ? "Banking" : "Corporate"}_Financial_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error("Excel generation failed:", err);
    alert("Failed to export Excel file.");
  }
}

/**
 * PDF Export Function
 */
export function exportToPdf(data, elementId = null, isBank = false) {
  if (!data) {
    alert("No data available to export.");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const title = isBank ? "BANKING FINANCIAL STATEMENT REPORT" : "CORPORATE FINANCIAL STATEMENT REPORT";
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 40, 40);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 58);

    let tableHeaders = ["Metric", "Details"];
    let tableRows = [];

    if (Array.isArray(data.rows) && data.rows.length > 0) {
      tableHeaders = Object.keys(data.rows[0]);
      tableRows = data.rows.map((row) => Object.values(row));
    } else if (data.sheets && typeof data.sheets === "object") {
      const firstSheetName = Object.keys(data.sheets)[0];
      const sheet = data.sheets[firstSheetName];
      if (Array.isArray(sheet) && sheet.length > 0) {
        tableHeaders = Object.keys(sheet[0]);
        tableRows = sheet.map((row) => Object.values(row));
      }
    } else {
      tableRows = Object.entries(data).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
    }

    autoTable(doc, {
      startY: 75,
      head: [tableHeaders],
      body: tableRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: isBank ? [245, 158, 11] : [16, 185, 129], textColor: [0, 0, 0] },
    });

    const filename = `${isBank ? "Banking" : "Corporate"}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("Failed to export PDF file.");
  }
}

// Aliases for full compatibility
export const exportToPDF = exportToPdf;
export const exportToExcel = exportToXlsx;

export default {
  exportToPdf,
  exportToPDF,
  exportToXlsx,
  exportToExcel,
};