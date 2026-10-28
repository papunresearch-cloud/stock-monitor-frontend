import React from 'react';

export default function PerShareRollingSummary({ data, isBank = false }) {
  if (!data || !data.rows || data.rows.length === 0) return null;

  // Grab the last 5 records
  const recentData = data.rows.slice(-5);

  const themeColor = isBank ? '#f59e0b' : '#10b981';

  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}>
      <h3 style={{ margin: '0 0 16px 0', color: themeColor, fontSize: '15px', textTransform: 'uppercase' }}>
        Per Share Rolling Summary
      </h3>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #1e293b', color: '#94a3b8', backgroundColor: '#020617' }}>Metric</th>
            {recentData.map((row, idx) => (
              <th key={idx} style={{ textAlign: 'right', padding: '8px', borderBottom: '2px solid #1e293b', color: themeColor, backgroundColor: '#020617', whiteSpace: 'nowrap' }}>
                {row['Year'] || row['Quarter'] || `Period ${idx + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {['EPS', 'Book Value', 'Dividend'].map((metric, idx) => (
            <tr key={metric} style={{ backgroundColor: idx % 2 === 0 ? '#0f172a' : '#111827' }}>
              <td style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #1e293b', color: '#e2e8f0', fontWeight: 'bold' }}>{metric}</td>
              {recentData.map((row, rowIdx) => {
                const val = row[metric];
                return (
                  <td key={rowIdx} style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                    {typeof val === 'number' ? val.toFixed(2) : (val || '-')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}