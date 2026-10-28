import React, { useMemo } from 'react';

/**
 * ChartPanel renders a robust inline SVG chart without any external dependencies (like Chart.js/Recharts).
 */
export function ChartPanel({ 
  data, 
  type = 'line', 
  primaryMetric, 
  secondaryMetric, 
  height = 250 
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Clone and reverse so the oldest period is on the left
    const chronological = [...data].reverse();

    return chronological.map((row, idx) => {
      // Handle the X-axis label (Year or Quarter)
      let label = `P${idx + 1}`;
      if (row['Year']) label = String(row['Year']).replace('Mar ', '');
      if (row['Quarter']) label = String(row['Quarter']).replace('Dec ', 'Q4').replace('Sep ', 'Q3').replace('Jun ', 'Q2').replace('Mar ', 'Q1');

      return {
        label,
        primary: typeof row[primaryMetric] === 'number' ? row[primaryMetric] : 0,
        secondary: secondaryMetric && typeof row[secondaryMetric] === 'number' ? row[secondaryMetric] : null
      };
    });
  }, [data, primaryMetric, secondaryMetric]);

  if (chartData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        No data available for {primaryMetric}
      </div>
    );
  }

  // Calculate scales and boundaries
  const allValues = chartData.flatMap(d => d.secondary !== null ? [d.primary, d.secondary] : [d.primary]);
  const maxVal = Math.max(...allValues, 0.1); 
  const minVal = Math.min(...allValues, 0); 
  
  // Create padding for Y-axis
  const range = maxVal - minVal;
  const paddedMax = maxVal + (range * 0.1);
  const paddedMin = minVal < 0 ? minVal - (range * 0.1) : 0;
  
  const yRange = paddedMax - paddedMin;
  
  // SVG Dimensions
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const innerHeight = height - padding.top - padding.bottom;

  const getY = (val) => padding.top + innerHeight - ((val - paddedMin) / yRange) * innerHeight;

  return (
    <div style={{ width: '100%', height, position: 'relative', fontFamily: 'system-ui, sans-serif' }}>
      <svg width="100%" height="100%" style={{ overflow: 'visible' }} preserveAspectRatio="none">
        
        {/* Y-Axis Grid Lines & Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const yVal = paddedMin + (yRange * ratio);
          const yPos = getY(yVal);
          
          return (
            <g key={ratio}>
              <line 
                x1={padding.left} 
                y1={yPos} 
                x2="100%" 
                y2={yPos} 
                stroke="#1e293b" 
                strokeDasharray={yVal === 0 ? "" : "4 4"}
                strokeWidth={yVal === 0 ? 2 : 1}
              />
              <text 
                x={padding.left - 8} 
                y={yPos + 4} 
                fill="#64748b" 
                fontSize="10px" 
                textAnchor="end"
              >
                {yVal >= 1000 ? (yVal/1000).toFixed(1) + 'k' : yVal.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-Axis Labels */}
        {chartData.map((d, i) => {
          const xPercent = `${padding.left + (i * ((100 - padding.left) / Math.max(chartData.length - 1, 1)))}%`;
          return (
            <text 
              key={i} 
              x={xPercent} 
              y={height - 10} 
              fill="#94a3b8" 
              fontSize="10px" 
              textAnchor="middle"
            >
              {d.label}
            </text>
          );
        })}

        {/* Render Lines or Bars */}
        {type === 'line' ? (
          <>
            {/* Secondary Line (if exists) */}
            {secondaryMetric && (
              <polyline
                points={chartData.map((d, i) => {
                  const x = padding.left + (i * ((100 - padding.left) / Math.max(chartData.length - 1, 1)));
                  return `${x}%,${getY(d.secondary)}`;
                }).join(' ')}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            
            {/* Primary Line */}
            <polyline
              points={chartData.map((d, i) => {
                const x = padding.left + (i * ((100 - padding.left) / Math.max(chartData.length - 1, 1)));
                return `${x}%,${getY(d.primary)}`;
              }).join(' ')}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="2.5"
            />
            
            {/* Data Points */}
            {chartData.map((d, i) => {
              const xPercent = `${padding.left + (i * ((100 - padding.left) / Math.max(chartData.length - 1, 1)))}%`;
              return (
                <g key={i}>
                  <circle cx={xPercent} cy={getY(d.primary)} r="4" fill="#0ea5e9" stroke="#0f172a" strokeWidth="2" />
                  <title>{`${d.label}: ${d.primary.toFixed(2)}`}</title>
                </g>
              );
            })}
          </>
        ) : (
          /* Render Bars */
          chartData.map((d, i) => {
            const numPoints = Math.max(chartData.length, 1);
            const xOffset = padding.left + (i * ((100 - padding.left) / numPoints)) + ((100 - padding.left) / numPoints / 2);
            
            const barWidth = 14; 
            const y0 = getY(Math.max(0, paddedMin)); 
            
            return (
              <g key={i}>
                {secondaryMetric && d.secondary !== null && (
                  <rect
                    x={`calc(${xOffset}% - ${barWidth + 2}px)`}
                    y={getY(Math.max(d.secondary, 0))}
                    width={barWidth}
                    height={Math.abs(getY(d.secondary) - y0)}
                    fill="#64748b"
                    rx="2"
                  >
                    <title>{`${secondaryMetric} - ${d.label}: ${d.secondary.toFixed(2)}`}</title>
                  </rect>
                )}
                <rect
                  x={`calc(${xOffset}% ${secondaryMetric ? '+ 2px' : `- ${barWidth/2}px`})`}
                  y={getY(Math.max(d.primary, 0))}
                  width={barWidth}
                  height={Math.abs(getY(d.primary) - y0)}
                  fill={d.primary >= 0 ? "#10b981" : "#ef4444"}
                  rx="2"
                >
                  <title>{`${primaryMetric} - ${d.label}: ${d.primary.toFixed(2)}`}</title>
                </rect>
              </g>
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div style={{ position: 'absolute', top: 0, right: 10, display: 'flex', gap: '12px', fontSize: '10px', color: '#cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: type === 'line' ? '#0ea5e9' : '#10b981', borderRadius: type === 'line' ? '50%' : '2px' }} />
          {primaryMetric}
        </div>
        {secondaryMetric && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#64748b', border: type === 'line' ? '1px dashed #94a3b8' : 'none', borderRadius: type === 'line' ? '50%' : '2px' }} />
            {secondaryMetric}
          </div>
        )}
      </div>
    </div>
  );
}