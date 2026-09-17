import React, { useState, useEffect, useCallback } from 'react';
import Stock_window from './Stock_window';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

export default function StockGrid({ 
  activeStocks = [],
  displayOrder = 'Alphabetical Dec. (A - Z)',
  groupBy = 'No filter',
  isAutoMode, 
  isFrozen, 
  refreshRate, 
  refreshTrigger, 
  updateTrigger 
}) {
  const [detailedDb, setDetailedDb] = useState(null);
  const [groupedStockMap, setGroupedStockMap] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchDatabase = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      const firebaseUrl = `${FIREBASE_DB_URL}/watchlist.json?_=${timestamp}`;
      const response = await fetch(firebaseUrl, { cache: 'no-store' });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data && data.detailedDb) {
        setDetailedDb(data.detailedDb);
      }
    } catch (error) {
      console.error("Error fetching from Firebase:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabase();
  }, [fetchDatabase]);

  useEffect(() => {
    if (updateTrigger > 0) fetchDatabase();
  }, [updateTrigger, fetchDatabase]);

  useEffect(() => {
    if (!detailedDb || !activeStocks || activeStocks.length === 0) {
      setGroupedStockMap({});
      return;
    }

    let currentList = activeStocks.map(rawName => {
      const cleanName = (rawName?.ticker || rawName?.Name || rawName || '').trim(); 
      return detailedDb[cleanName] || detailedDb[rawName];
    }).filter(stock => stock !== undefined);

    let buckets = {};
    if (groupBy === 'No filter') {
      buckets['All'] = currentList;
    } else {
      currentList.forEach(stock => {
        let keyName = "Uncategorized";
        if (groupBy === 'Group') keyName = stock.GROUP || stock.Group || "Uncategorized";
        if (groupBy === 'Sector') keyName = stock.SECTOR || stock.Sector || stock.sector || "Uncategorized";
        if (groupBy === 'Industry') keyName = stock.INDUSTRY || stock.Industry || stock.industry || "Uncategorized";
        
        keyName = keyName.toUpperCase(); 
        if (!buckets[keyName]) buckets[keyName] = [];
        buckets[keyName].push(stock);
      });
    }

    Object.keys(buckets).forEach(bucketKey => {
      buckets[bucketKey].sort((a, b) => {
        const getVal = (obj, key) => obj[key] !== undefined && obj[key] !== null ? parseFloat(obj[key]) : 0;

        switch(displayOrder) {
          case "Mkt Cap Rank inc.": return getVal(a, 'PCCAP') - getVal(b, 'PCCAP');
          case "Mkt Cap Rank dec.": return getVal(b, 'PCCAP') - getVal(a, 'PCCAP');
          case "F-score Inc.": return getVal(a, 'F-score') - getVal(b, 'F-score');
          case "F-score dec.": return getVal(b, 'F-score') - getVal(a, 'F-score');
          case "G-score inc.": return getVal(a, 'G-score') - getVal(b, 'G-score');
          case "G-score dec.": return getVal(b, 'G-score') - getVal(a, 'G-score');
          case "T-score inc.": return getVal(a, 'T-score') - getVal(b, 'T-score');
          case "T-score dec.": return getVal(b, 'T-score') - getVal(a, 'T-score');
          case "RSI inc.": return getVal(a, 'RSI') - getVal(b, 'RSI');
          case "RSI dec.": return getVal(b, 'RSI') - getVal(a, 'RSI');
          case "Alphabetical Dec. (A - Z)":
          default:
            const nameA = a.Name ? a.Name.toLowerCase() : "";
            const nameB = b.Name ? b.Name.toLowerCase() : "";
            return nameA.localeCompare(nameB);
        }
      });
    });

    setGroupedStockMap(buckets);
  }, [activeStocks, displayOrder, groupBy, detailedDb]);

  if (loading) {
    return <h2 style={{ color: 'white', textAlign: 'center' }}>Loading Watchlist...</h2>;
  }

  const sortedGroupKeys = Object.keys(groupedStockMap).sort((a, b) => a.localeCompare(b));

  const renderGridContent = (stocks) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', padding: '10px' }}>
      {stocks.map((stock) => (
        <Stock_window 
          key={stock?.TICKER || stock?.Name} 
          name={stock?.Name} 
          ticker={stock?.TICKER} 
          nse={stock?.NSE} 
          code={stock?.CODE} 
          
          pe={stock?.PE}
          dpe={stock?.['DPE%']} 
          pb={stock?.PB}
          dpb={stock?.['DPB%']}
          ps={stock?.PS}
          dy={stock?.DY}
          tScore={stock?.['T-score']}
          fScore={stock?.['F-score']}
          gScore={stock?.['G-score']}
          
          review={stock?.REVIEW || stock?.Review}
          group={stock?.GROUP || stock?.Group}
          remark={stock?.REMARK || stock?.Remark}
          duration={stock?.DURATION || stock?.Duration}
          sector={stock?.SECTOR || stock?.Sector || stock?.sector}
          industry={stock?.INDUSTRY || stock?.Industry || stock?.industry}
          pccap={stock?.PCCAP ?? stock?.pccap}

          sg_ttm={stock?.['SG-TTM'] || stock?.['sg-ttm']}
          ysg={stock?.YSG || stock?.ysg}
          pg_1={stock?.['PG-1'] || stock?.['pg-1']}
          ypg={stock?.YPG || stock?.ypg}

          r1w={stock?.['1W'] || stock?.['1wr']}
          r1m={stock?.['1M'] || stock?.['1mr']}
          r3m={stock?.['3M'] || stock?.['3mr']}
          r6m={stock?.['6M'] || stock?.['6mr']}
          r1yr={stock?.['1YR'] || stock?.['1yr']}
          r3yr={stock?.['3YR'] || stock?.['3yr']}
          rsi={stock?.RSI || stock?.rsi}
          ma50={stock?.['50MA'] || stock?.['50ma']}
          ma200={stock?.['200MA'] || stock?.['200ma']}
          w52h={stock?.['52WH'] || stock?.['52wh']}
          w52l={stock?.['52WL'] || stock?.['52wl']}

          ex_div_date={stock?.ex_div_date}
          last_quarter_name={stock?.last_quarter_name}
          next_quarter_date={stock?.next_quarter_date}

          isAutoMode={isAutoMode} 
          isFrozen={isFrozen} 
          refreshRate={refreshRate} 
          refreshTrigger={refreshTrigger} 
          updateTrigger={updateTrigger}
        />
      ))}
    </div>
  );

  return (
    <div style={{ padding: '0px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
      {sortedGroupKeys.map(groupName => {
        const groupStocks = groupedStockMap[groupName];

        if (groupBy === 'No filter') {
          return <React.Fragment key={groupName}>{renderGridContent(groupStocks)}</React.Fragment>;
        }

        return (
          <fieldset 
            key={groupName}
            style={{
              border: '3px solid #00BCD4', 
              borderRadius: '12px',
              padding: '5px 20px',
              margin: '0 auto',
              width: '95%',
              boxSizing: 'border-box',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
            }}
          >
            <legend 
              style={{
                color: '#FFD700', 
                fontSize: '18px',
                fontWeight: 'bold',
                padding: '0 15px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '3px',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
              }}
            >
              {groupName}
            </legend>
            {renderGridContent(groupStocks)}
          </fieldset>
        );
      })}
    </div>
  );
}