import * as XLSX from "exceljs"; // We use exceljs based on your package.json
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Client-Side Excel Workbook Exporter
 */
export async function exportToXlsx(data, isBank = false) {
  if (!data) {
    alert("No data available to export.");
    return;
  }

  try {
    const workbook = new XLSX.Workbook();
    
    // Add Company Data Sheet
    if (data.rows && data.rows.length > 0) {
      const sheet = workbook.addWorksheet(isBank ? "Bank_Data" : "Company_Data");
      const headers = Object.keys(data.rows[0]);
      sheet.addRow(headers);
      
      data.rows.forEach(row => {
        sheet.addRow(Object.values(row));
      });
    }

    const filename = `${isBank ? "Bank" : "Company"}_Financial_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
    
  } catch (err) {
    console.error("Excel generation failed:", err);
    alert("Failed to export Excel file.");
  }
}

/**
 * Client-Side PDF Exporter
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

// Ensure LedgerWrapper.jsx can destructure exactly what it imports
export const exportReports = exportToPdf; 

export default {
  exportToXlsx,
  exportToPdf,
  exportReports
};