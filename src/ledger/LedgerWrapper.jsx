import React, { useState } from 'react';
import { parseWorkbook } from './parseWorkbook';
import CompanyDashboard from './CompanyDashboard';
import BankDashboard from './BankDashboard';
import { exportReports } from './exportReports';
import './styles.css';

export default function LedgerWrapper() {
  const [financialData, setFinancialData] = useState(null);
  const [activeMode, setActiveMode] = useState('company'); // 'company' or 'bank'
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      // Parses purely in-browser without sending data to the Render backend
      const parsed = await parseWorkbook(file, activeMode === 'bank');
      setFinancialData(parsed);
    } catch (err) {
      console.error('Workbook parsing failed:', err);
      alert('Failed to parse workbook. Ensure it is a valid Screener Data Sheet format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPDF = () => exportReports(financialData, 'pdf', activeMode);
  const handleExportExcel = () => exportReports(financialData, 'excel', activeMode);

  return (
    <div className="ledger-dashboard-container" style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '24px', fontWeight: '800' }}>📊 Ledger Fundamentals</h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={activeMode} 
            onChange={(e) => { setActiveMode(e.target.value); setFinancialData(null); }}
            style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155' }}
          >
            <option value="company">🏢 Corporate Mode</option>
            <option value="bank">🏦 Bank Mode</option>
          </select>

          <label style={{ cursor: 'pointer', backgroundColor: '#06b6d4', color: '#000', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
            {isProcessing ? '⏳ Parsing...' : '📁 Upload .XLSX'}
            <input type="file" accept=".xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {financialData && (
            <>
              <button onClick={handleExportPDF} style={{ backgroundColor: '#f59e0b', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>📄 PDF</button>
              <button onClick={handleExportExcel} style={{ backgroundColor: '#10b981', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>📥 Excel</button>
            </>
          )}
        </div>
      </div>

      {!financialData ? (
        <div style={{ border: '2px dashed #334155', borderRadius: '12px', padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <h3>Upload a Screener Workbook to Begin</h3>
          <p>Analysis and calculations run entirely in your local browser sandbox.</p>
        </div>
      ) : (
        <div className="ledger-content">
          {activeMode === 'company' ? (
            <CompanyDashboard data={financialData} />
          ) : (
            <BankDashboard data={financialData} />
          )}
        </div>
      )}
    </div>
  );
}