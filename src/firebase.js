import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDxRtiLvIqxbyr6TfRkf-hSPDJEnObP9mY",
  authDomain: "stock-dashboard-5c25c.firebaseapp.com",
  databaseURL: "https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "stock-dashboard-5c25c",
  storageBucket: "stock-dashboard-5c25c.firebasestorage.app",
  messagingSenderId: "967333212433",
  appId: "1:967333212433:web:0eb928b9e76ad31dec5cb0",
  measurementId: "G-GCL8TPTZ8B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database connection for Filter, Advanced_Filter, and Watchlist
export const database = getDatabase(app);