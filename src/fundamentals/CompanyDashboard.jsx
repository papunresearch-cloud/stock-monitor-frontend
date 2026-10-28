import React, { useState } from 'react';
import { 
  Building2, TrendingUp, BarChart3, ShieldCheck, Info
} from 'lucide-react';
import { ChartPanel } from './Charts';
import PerShareRollingSummary from './PerShareRollingSummary';

export default function CompanyDashboard({ data }) {
  const [activeSection, setActiveSection] = useState('overview');
  if (!data || !data.rows || data.rows.length === 0) return <div>No data available</div>;
  const metrics = data.rows;

  const renderSectionTabs = () => (
    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '20px' }}>
      <button
        onClick={() => setActiveSection('overview')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s',
          backgroundColor: activeSection === 'overview' ? '#10b981' : '#1e293b',
          color: activeSection === 'overview' ? '#000000' : '#94a3b8'
        }}
      >
        <Building2 size={16} /> Key Metrics
      </button>
      <button
        onClick={() => setActiveSection('yearly')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s',
          backgroundColor: activeSection === 'yearly' ? '#10b981' : '#1e293b',
          color: activeSection === 'yearly' ? '#000000' : '#94a3b8'
        }}
      >
        <BarChart3 size={16} /> Annual Statement
      </button>
      <button
        onClick={() => setActiveSection('quarterly')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s',
          backgroundColor: activeSection === 'quarterly' ? '#10b981' : '#1e293b',
          color: activeSection === 'quarterly' ? '#000000' : '#94a3b8'
        }}
      >
        <TrendingUp size={16} /> Quarterly Statement
      </button>
      <button
        onClick={() => setActiveSection('tables')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s',
          backgroundColor: activeSection === 'tables' ? '#10b981' : '#1e293b',
          color: activeSection === 'tables' ? '#000000' : '#94a3b8'
        }}
      >
        <Info size={16} /> Full Data Tables
      </button>
      <button
        onClick={() => setActiveSection('checks')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '13px', transition: 'all 0.2s',
          backgroundColor: activeSection === 'checks' ? '#10b981' : '#1e293b',
          color: activeSection === 'checks' ? '#000000' : '#94a3b8'
        }}
      >
        <ShieldCheck size={16} /> Checkpoints
      </button>
    </div>
  );

  const renderOverview = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PerShareRollingSummary data={data} />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#10b981', fontSize: '14px', textTransform: 'uppercase' }}>Profitability Margins (%)</h3>
            <ChartPanel data={metrics} type="bar" primaryMetric="OPM %" secondaryMetric="Net Profit Margin %" height={220} />
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#38bdf8', fontSize: '14px', textTransform: 'uppercase' }}>Return Ratios (%)</h3>
            <ChartPanel data={metrics} type="line" primaryMetric="ROCE %" secondaryMetric="ROE %" height={220} />
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f59e0b', fontSize: '14px', textTransform: 'uppercase' }}>Topline Growth</h3>
            <ChartPanel data={metrics} type="bar" primaryMetric="Sales YOY %" height={220} />
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#c084fc', fontSize: '14px', textTransform: 'uppercase' }}>Bottomline Growth</h3>
            <ChartPanel data={metrics} type="bar" primaryMetric="Net Profit YOY %" height={220} />
          </div>
        </div>
      </div>
    );
  };

  const renderFinancialTable = (sheetName) => {
    if (!data.sheets || !data.sheets[sheetName]) return <div style={{ color: '#94a3b8' }}>{sheetName} data not available.</div>;
    const sheetData = data.sheets[sheetName];
    if (sheetData.length === 0) return <div style={{ color: '#94a3b8' }}>No records found in {sheetName}.</div>;

    const headers = Object.keys(sheetData[0]);

    return (
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', marginBottom: '24px', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#38bdf8', fontSize: '15px', textTransform: 'uppercase' }}>{sheetName}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #1e293b', color: '#94a3b8', whiteSpace: 'nowrap', backgroundColor: '#020617' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.map((row, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#0f172a' : '#111827' }}>
                {headers.map(h => {
                  const val = row[h];
                  const isNegative = typeof val === 'number' && val < 0;
                  return (
                    <td key={h} style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #1e293b', color: isNegative ? '#f87171' : '#e2e8f0', whiteSpace: 'nowrap' }}>
                      {typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (val || '-')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {renderSectionTabs()}
      
      <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'yearly' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {renderFinancialTable('Profit & Loss')}
            {renderFinancialTable('Balancesheet')}
            {renderFinancialTable('Cash Flow')}
          </div>
        )}
        {activeSection === 'quarterly' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {renderFinancialTable('Quarters')}
          </div>
        )}
        {activeSection === 'tables' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {renderFinancialTable('Data Sheet')}
            {renderFinancialTable('Ratios')}
          </div>
        )}
        {activeSection === 'checks' && (
          <div style={{ backgroundColor: '#0f172a', padding: '24px', borderRadius: '8px', border: '1px solid #1e293b', color: '#94a3b8' }}>
            Checkpoints module running based on pure data validation constraints.
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}