import { useState, useEffect } from 'react';

export default function LiveFeed() {
  const [feedData, setFeedData] = useState([]);

  useEffect(() => {
    // 1. Open the connection to the Python WebSocket
    // Note: We use ws:// instead of http://
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/live-feed');

    // 2. Listen for messages being pushed from the server
    ws.onmessage = (event) => {
      const incomingData = JSON.parse(event.data);
      setFeedData(incomingData); // Instantly updates the UI
    };

    // 3. Cleanup: Close the connection if the component is removed
    return () => {
      ws.close();
    };
  }, []); // The empty array ensures this connection only happens once on load

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '20px auto', fontFamily: 'sans-serif' }}>
      <h3 style={{ textAlign: 'center', color: '#333' }}>Live Market Feed</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {feedData.map((stock) => (
          <div key={stock.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#eef2f5', borderRadius: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>{stock.symbol}</span>
            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
              {stock.price.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}