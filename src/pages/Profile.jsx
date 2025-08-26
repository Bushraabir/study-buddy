import React, { useEffect, useState, useMemo, useCallback } from "react";
import styled from "styled-components";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, deleteDoc, deleteField } from "firebase/firestore";import { auth, db } from "../components/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

// Styled Components (keeping your existing styles)
const ProfileContainer = styled.div`
  background: #1a1a1a;
  color: #e4e4e7;
  border-radius: 12px;
  padding: 20px;
  max-width: 1600px;
  width: 95%;
  margin: 20px auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  overflow: hidden;
  min-height: 100vh;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    margin: 20px auto;
    padding: 20px;
  }
`;

const LeftSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const RightSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const InfoContainer = styled.div`
  background: linear-gradient(145deg, #2d2d3a, #1f1f2e);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, #5a67d8, #667eea, #764ba2, #f093fb);
    border-radius: 20px;
    opacity: 0.05;
    z-index: 0;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  h1 {
    font-size: 2.8rem;
    background: linear-gradient(45deg, #5a67d8, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 25px;
    text-align: center;
    font-weight: 700;
    
    @media (max-width: 768px) {
      font-size: 2.2rem;
    }
  }

  p {
    font-size: 1.2rem;
    color: #b4b4c1;
    margin: 15px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid rgba(90, 103, 216, 0.2);

    &:last-of-type {
      border-bottom: none;
    }

    strong {
      color: #ffffff;
      font-weight: 600;
    }

    span {
      color: #5a67d8;
      font-weight: 500;
    }
    
    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      font-size: 1.1rem;
    }
  }

  .logout-button {
    background: linear-gradient(135deg, #5a67d8, #764ba2);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    padding: 15px 30px;
    cursor: pointer;
    margin-top: 25px;
    width: 100%;
    box-shadow: 0 8px 25px rgba(90, 103, 216, 0.4);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    position: relative;
    overflow: hidden;

    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 35px rgba(90, 103, 216, 0.6);

      &:before {
        left: 100%;
      }
    }

    &:active {
      transform: translateY(-1px);
    }
  }

  .reset-button {
    background: linear-gradient(135deg, #e53e3e, #c53030);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    padding: 12px 25px;
    cursor: pointer;
    margin-top: 15px;
    width: 100%;
    box-shadow: 0 8px 25px rgba(229, 62, 62, 0.4);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    position: relative;
    overflow: hidden;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 35px rgba(229, 62, 62, 0.6);
    }

    &:active {
      transform: translateY(-1px);
    }
  }
`;

const StatsContainer = styled.div`
  background: linear-gradient(145deg, #2d2d3a, #1f1f2e);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  h3 {
    color: #ffffff;
    margin-bottom: 25px;
    font-size: 1.8rem;
    text-align: center;
    background: linear-gradient(45deg, #5a67d8, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 25px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .stat-item {
    background: linear-gradient(145deg, #3e3e4a, #2a2a36);
    padding: 25px;
    border-radius: 16px;
    text-align: center;
    border: 1px solid rgba(90, 103, 216, 0.3);
    transition: all 0.4s ease;
    position: relative;
    overflow: hidden;

    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(45deg, rgba(90, 103, 216, 0.1), rgba(118, 75, 162, 0.1));
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      transform: translateY(-5px) scale(1.02);
      box-shadow: 0 15px 40px rgba(90, 103, 216, 0.3);

      &:before {
        opacity: 1;
      }
    }

    .stat-value {
      font-size: 2.2rem;
      font-weight: 800;
      background: linear-gradient(45deg, #5a67d8, #667eea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
      position: relative;
      z-index: 1;
    }

    .stat-label {
      font-size: 1rem;
      color: #b4b4c1;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
  }
`;

const AnalyticsContainer = styled.div`
  background: linear-gradient(145deg, #2d2d3a, #1f1f2e);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  h3 {
    color: #ffffff;
    margin-bottom: 25px;
    font-size: 1.8rem;
    text-align: center;
    background: linear-gradient(45deg, #5a67d8, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }

  .chart-container {
    height: 400px;
    margin-bottom: 25px;
    border-radius: 12px;
    background: rgba(26, 26, 26, 0.5);
    padding: 20px;
    position: relative;
    
    @media (max-width: 768px) {
      height: 300px;
      padding: 15px;
    }
  }

  .period-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .period-tab {
    padding: 10px 20px;
    background: linear-gradient(145deg, #3e3e4a, #2a2a36);
    border: 1px solid rgba(90, 103, 216, 0.3);
    border-radius: 25px;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    font-weight: 500;
    position: relative;
    overflow: hidden;

    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      transition: left 0.4s;
    }

    &.active {
      background: linear-gradient(135deg, #5a67d8, #667eea);
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(90, 103, 216, 0.4);
    }

    &:hover:not(.active) {
      background: linear-gradient(135deg, #4c51bf, #5a67d8);
      transform: translateY(-2px);
      
      &:before {
        left: 100%;
      }
    }
    
    @media (max-width: 768px) {
      padding: 8px 16px;
      font-size: 0.8rem;
    }
  }

  .empty-chart {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #b4b4c1;
    text-align: center;
    font-size: 1.1rem;
    flex-direction: column;
    gap: 10px;
  }

  .data-refresh {
    text-align: center;
    margin-bottom: 15px;
    color: #b4b4c1;
    font-size: 0.9rem;
  }

  .last-updated {
    color: #5a67d8;
    font-weight: 500;
  }

  .chart-info {
    text-align: center;
    color: #b4b4c1;
    font-size: 0.9rem;
    margin-top: 10px;
    padding: 10px;
    background: rgba(90, 103, 216, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(90, 103, 216, 0.1);
  }
`;

const FieldTimesContainer = styled.div`
  background: linear-gradient(145deg, #2d2d3a, #1f1f2e);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  h3 {
    color: #ffffff;
    margin-bottom: 25px;
    font-size: 1.8rem;
    text-align: center;
    background: linear-gradient(45deg, #5a67d8, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }

  .field-time-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 0;
    border-bottom: 1px solid rgba(90, 103, 216, 0.2);
    transition: all 0.3s ease;
    
    &:last-child {
      border-bottom: none;
    }

    &:hover {
      padding-left: 10px;
      background: rgba(90, 103, 216, 0.05);
      border-radius: 8px;
    }

    .field-name {
      color: #ffffff;
      font-weight: 600;
      font-size: 1.1rem;
    }

    .field-time {
      color: #5a67d8;
      font-weight: 700;
      font-size: 1.2rem;
      font-family: 'Courier New', monospace;
    }

    .remove-field-btn {
      background: rgba(229, 62, 62, 0.2);
      border: 1px solid #e53e3e;
      color: #e53e3e;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.3s ease;

      &:hover {
        background: #e53e3e;
        color: white;
      }
    }
  }

  .no-data-message {
    text-align: center;
    color: #b4b4c1;
    font-style: italic;
    padding: 40px 20px;
    background: rgba(90, 103, 216, 0.05);
    border-radius: 12px;
    border: 1px dashed rgba(90, 103, 216, 0.2);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  flex-direction: column;
  gap: 20px;
  grid-column: 1 / -1;
`;

const ConnectionStatus = styled.div`
  background: ${props => props.error 
    ? 'linear-gradient(145deg, #4a2d2d, #2e1f1f)' 
    : 'linear-gradient(145deg, #2d4a2d, #1f2e1f)'};
  border: 2px solid ${props => props.error ? '#f56565' : '#48bb78'};
  border-radius: 15px;
  padding: 20px;
  text-align: center;
  color: ${props => props.error ? '#f56565' : '#48bb78'};

  h4 {
    margin: 0 0 10px 0;
    font-size: 1.2rem;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    color: #b4b4c1;
  }

  .refresh-button {
    background: linear-gradient(135deg, #5a67d8, #667eea);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    margin-top: 10px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(135deg, #4c51bf, #5a67d8);
      transform: translateY(-2px);
    }
  }
`;

const TasksOverviewContainer = styled.div`
  background: linear-gradient(145deg, #2d2d3a, #1f1f2e);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  h3 {
    color: #ffffff;
    margin-bottom: 25px;
    font-size: 1.8rem;
    text-align: center;
    background: linear-gradient(45deg, #5a67d8, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }

  .task-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    margin: 8px 0;
    background: rgba(62, 62, 74, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(90, 103, 216, 0.2);
    
    &.completed {
      opacity: 0.6;
      .task-text {
        text-decoration: line-through;
      }
    }

    .task-text {
      color: #e4e4e7;
      flex: 1;
    }

    .task-priority {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      
      &.high {
        background: rgba(229, 62, 62, 0.2);
        color: #fc8181;
        border: 1px solid #e53e3e;
      }
      
      &.medium {
        background: rgba(237, 137, 54, 0.2);
        color: #f6ad55;
        border: 1px solid #ed8936;
      }
      
      &.low {
        background: rgba(72, 187, 120, 0.2);
        color: #68d391;
        border: 1px solid #48bb78;
      }
    }
  }
`;

// Chart Error Boundary Component
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Chart Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-chart">
          <p>Chart temporarily unavailable</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'linear-gradient(135deg, #5a67d8, #667eea)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry Chart
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Chart Components
const SafeBarChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="empty-chart">
        <p>No data available yet</p>
        <p>Start studying to see your analytics!</p>
      </div>
    );
  }

  return (
    <BarChart 
      data={data} 
      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#3e3e4a" />
      <XAxis 
        dataKey="name" 
        stroke="#b4b4c1" 
        fontSize={12}
        angle={-45}
        textAnchor="end"
        height={60}
        interval={0}
      />
      <YAxis 
        stroke="#b4b4c1" 
        fontSize={12}
        label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
      />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#2d2d3a', 
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          color: '#ffffff'
        }}
        formatter={(value, name) => [`${value} minutes`, 'Study Time']}
        labelFormatter={(label) => `${label}`}
      />
      <Bar 
        dataKey="time" 
        fill="#5a67d8" 
        radius={[6, 6, 0, 0]}
        name="Study Time"
      />
    </BarChart>
  );
};

const SafeLineChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="empty-chart">
        <p>No data available yet</p>
        <p>Start studying to see your progress!</p>
      </div>
    );
  }

  return (
    <LineChart 
      data={data} 
      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#3e3e4a" />
      <XAxis 
        dataKey="name" 
        stroke="#b4b4c1" 
        fontSize={12}
        angle={-45}
        textAnchor="end"
        height={60}
      />
      <YAxis 
        stroke="#b4b4c1" 
        fontSize={12}
        label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
      />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#2d2d3a', 
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          color: '#ffffff'
        }}
        formatter={(value, name) => [`${value} minutes`, 'Study Time']}
      />
      <Line 
        type="monotone" 
        dataKey="time" 
        stroke="#5a67d8" 
        strokeWidth={3}
        dot={{ fill: '#5a67d8', strokeWidth: 2, r: 4 }}
        activeDot={{ r: 6, fill: '#667eea' }}
      />
    </LineChart>
  );
};

// Field distribution pie chart colors
const FIELD_COLORS = [
  '#5a67d8', '#667eea', '#764ba2', '#f093fb', 
  '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
  '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
];

const SafePieChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="empty-chart">
        <p>No field data available</p>
        <p>Study different subjects to see distribution!</p>
      </div>
    );
  }

  return (
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={120}
        paddingAngle={5}
        dataKey="time"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={FIELD_COLORS[index % FIELD_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#2d2d3a', 
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          color: '#ffffff'
        }}
        formatter={(value, name) => [`${value} minutes`, name]}
      />
    </PieChart>
  );
};

function Profile() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('fields');
  const [activeChartType, setActiveChartType] = useState('bar');
  const [connectionError, setConnectionError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataRefreshCount, setDataRefreshCount] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const navigate = useNavigate();

  // Helper function to format time
  const formatTime = useCallback((timeInSeconds) => {
    if (!timeInSeconds || timeInSeconds === 0) return "0m";
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  const localYMD = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localYearMonth = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const localWeekStart = (d = new Date(), weekStartsOn = 1 /* 1=Mon */) => {
  const day = d.getDay() === 0 ? 7 : d.getDay(); // 1..7
  const diff = day - weekStartsOn;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  return localYMD(start);
};


  // Get date keys for consistency with Session.jsx
 const getTodayKey = useCallback(() => localYMD(), []);
 const getWeekKey = useCallback(() => localWeekStart(), []);
 const getMonthKey = useCallback(() => localYearMonth(), []);

  // Setup real-time listener with improved error handling
  const setupRealtimeListener = useCallback((userId) => {
    console.log("Setting up real-time listener for user:", userId);
    
    const docRef = doc(db, "users", userId);
    
    return onSnapshot(docRef, (docSnapshot) => {
      console.log("Received real-time update:", docSnapshot.exists());
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        console.log("User data updated:", data);
        setUserData(data);
        setConnectionError(false);
        setLastUpdated(new Date());
        setDataRefreshCount(prev => prev + 1);
      } else {
        console.warn("User document does not exist");
        setConnectionError(true);
        toast.error("User profile not found");
      }
      setLoading(false);
    }, (error) => {
      console.error("Real-time listener error:", error);
      setConnectionError(true);
      toast.error("Connection issue with database. Data may not be current.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let unsubscribeAuth = null;
    let unsubscribeUser = null;

    const initializeAuth = async () => {
      try {
        console.log("Initializing authentication...");
        
        unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
          console.log("Auth state changed:", currentUser ? "User logged in" : "User logged out");
          
          if (currentUser) {
            setUser(currentUser);
            unsubscribeUser = setupRealtimeListener(currentUser.uid);
          } else {
            setUser(null);
            setUserData(null);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Auth initialization error:", error);
        setLoading(false);
        setConnectionError(true);
        toast.error("Authentication failed");
      }
    };

    initializeAuth();

    return () => {
      console.log("Cleaning up listeners...");
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [setupRealtimeListener]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("You have been logged out");
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  // Enhanced reset function with proper data structure reset
  const handleResetData = async () => {
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      const todayKey = getTodayKey();
      const weekKey = getWeekKey();
      const monthKey = getMonthKey();

      // Reset all time-related data while preserving user info and preferences
      const resetData = {
        // Reset time tracking
        totalTimeToday: 0,
        totalTimeWeek: 0,
        totalTimeMonth: 0,
        totalTimeAllTime: 0,
        
        // Reset field times
        fieldTimes: {},
        
        // Reset analytics with proper structure
        dailyStats: {
          [todayKey]: {
            totalTime: 0,
            fieldTimes: {},
            sessionsCount: 0
          }
        },
        weeklyStats: {
          [weekKey]: {
            totalTime: 0,
            fieldTimes: {},
            sessionsCount: 0
          }
        },
        monthlyStats: {
          [monthKey]: {
            totalTime: 0,
            fieldTimes: {},
            sessionsCount: 0
          }
        },
        
        // Reset tasks
        todoList: [],
        
        // Reset study fields to default
        studyFields: ["General"],
        
        // Update metadata
        lastStudyDate: null,
      };

      await updateDoc(userDocRef, resetData);
      setShowResetConfirm(false);
      toast.success("All data has been reset successfully!");
    } catch (error) {
      console.error("Error resetting data:", error);
      toast.error("Failed to reset data");
    }
  };

  // Delete account function
  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      // Delete user document from Firestore
      const userDocRef = doc(db, "users", user.uid);
      await deleteDoc(userDocRef);
      
      // Delete Firebase Auth user
      await user.delete();
      
      toast.success("Account deleted successfully");
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please try logging out and back in first.");
    }
  };

  // Remove specific field from user's study fields
  const removeStudyField = async (fieldToRemove) => {
    if (!user || !userData) return;
    
    if (fieldToRemove === "General") {
      toast.error("Cannot remove the General field");
      return;
    }

    if (userData.studyFields?.length <= 1) {
      toast.error("Must have at least one study field");
      return;
    }

    try {
      const updatedFields = userData.studyFields.filter(field => field !== fieldToRemove);
      const updateData = { studyFields: updatedFields };

      // Also remove the field from fieldTimes and all stats
     const currentFieldTimes = userData.fieldTimes || {};
     if (currentFieldTimes[fieldToRemove]) {
       updateData[`fieldTimes.${fieldToRemove}`] = deleteField();
     }

      // Remove from all analytics data
      if (userData.dailyStats) {
        Object.keys(userData.dailyStats).forEach(date => {
          if (userData.dailyStats[date].fieldTimes && userData.dailyStats[date].fieldTimes[fieldToRemove]) {
           updateData[`dailyStats.${date}.fieldTimes.${fieldToRemove}`] = deleteField();
          }
        });
      }

      if (userData.weeklyStats) {
        Object.keys(userData.weeklyStats).forEach(week => {
          if (userData.weeklyStats[week].fieldTimes && userData.weeklyStats[week].fieldTimes[fieldToRemove]) {
            updateData[`weeklyStats.${week}.fieldTimes.${fieldToRemove}`] = deleteField();
          }
        });
      }

      if (userData.monthlyStats) {
        Object.keys(userData.monthlyStats).forEach(month => {
          if (userData.monthlyStats[month].fieldTimes && userData.monthlyStats[month].fieldTimes[fieldToRemove]) {
            updateData[`monthlyStats.${month}.fieldTimes.${fieldToRemove}`] = deleteField();
          }
        });
      }

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, updateData);
      
      toast.success(`${fieldToRemove} field removed successfully`);
    } catch (error) {
      console.error("Error removing field:", error);
      toast.error("Failed to remove study field");
    }
  };

  // Process chart data based on period and chart type
  const chartData = useMemo(() => {
    console.log("Processing chart data for period:", activePeriod);
    console.log("Available userData:", userData);
    
    if (!userData) {
      console.log("No user data available for chart");
      return [];
    }

    let data = [];

    try {
      switch (activePeriod) {
        case 'daily':
          if (userData.dailyStats) {
            console.log("Processing daily stats:", userData.dailyStats);
            data = Object.entries(userData.dailyStats)
              .filter(([date, stats]) => {
                return stats && 
                       typeof stats === 'object' && 
                       typeof stats.totalTime === 'number' && 
                       stats.totalTime > 0;
              })
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .slice(-14) // Show last 14 days
              .map(([date, stats]) => ({
                name: new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                }),
                time: Math.round((stats.totalTime || 0) / 60),
                fullDate: date,
                sessions: stats.sessionsCount || 0
              }));
          }
          break;
        
        case 'weekly':
          if (userData.weeklyStats) {
            console.log("Processing weekly stats:", userData.weeklyStats);
            data = Object.entries(userData.weeklyStats)
              .filter(([week, stats]) => {
                return stats && 
                       typeof stats === 'object' && 
                       typeof stats.totalTime === 'number' && 
                       stats.totalTime > 0;
              })
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .slice(-8) // Show last 8 weeks
              .map(([week, stats], index) => ({
                name: `Week ${index + 1}`,
                time: Math.round((stats.totalTime || 0) / 60),
                fullDate: week,
                sessions: stats.sessionsCount || 0
              }));
          }
          break;
        
        case 'monthly':
          if (userData.monthlyStats) {
            console.log("Processing monthly stats:", userData.monthlyStats);
            data = Object.entries(userData.monthlyStats)
              .filter(([month, stats]) => {
                return stats && 
                       typeof stats === 'object' && 
                       typeof stats.totalTime === 'number' && 
                       stats.totalTime > 0;
              })
              .sort(([a], [b]) => new Date(a + '-01') - new Date(b + '-01'))
              .slice(-12) // Show last 12 months
              .map(([month, stats]) => ({
                name: new Date(month + '-01').toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short' 
                }),
                time: Math.round((stats.totalTime || 0) / 60),
                fullDate: month,
                sessions: stats.sessionsCount || 0
              }));
          }
          break;
        
        case 'fields':
          console.log("Processing field times:", userData.fieldTimes);
          // For pie chart, we need different data structure
          if (activeChartType === 'pie') {
            if (userData.fieldTimes && typeof userData.fieldTimes === 'object') {
              data = Object.entries(userData.fieldTimes)
                .filter(([field, time]) => {
                  return field && 
                         typeof time === 'number' && 
                         time > 0;
                })
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([field, time]) => ({
                  name: field,
                  time: Math.round(time / 60),
                  fullName: field
                }));
            }
          } else {
            // For bar/line charts
            if (userData.fieldTimes && typeof userData.fieldTimes === 'object') {
              data = Object.entries(userData.fieldTimes)
                .filter(([field, time]) => {
                  return field && 
                         typeof time === 'number' && 
                         time > 0;
                })
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([field, time]) => ({
                  name: field.length > 15 ? field.substring(0, 15) + '...' : field,
                  time: Math.round(time / 60),
                  fullName: field
                }));
            }
          }
          break;
        
        default:
          console.warn("Unknown period:", activePeriod);
      }
    } catch (error) {
      console.error("Error processing chart data:", error);
      toast.error("Error processing chart data");
    }

    console.log("Processed chart data:", data);
    return data;
  }, [userData, activePeriod, activeChartType, dataRefreshCount]);

  // Calculate statistics with fallbacks and real-time updates
  const stats = useMemo(() => {
    console.log("Calculating stats from user data:", userData);
    
    if (!userData) {
      return { 
        completedTasks: 0, 
        totalTasks: 0, 
        completionRate: 0, 
        totalTimeToday: 0,
        totalTimeWeek: 0,
        totalTimeMonth: 0,
        totalTimeAllTime: 0,
        totalSessions: 0,
        averageSessionLength: 0,
        streakDays: 0
      };
    }

    const todoList = userData.todoList || [];
    const completedTasks = todoList.filter(task => task && task.completed).length;
    const totalTasks = todoList.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate total sessions from daily stats
    let totalSessions = 0;
    if (userData.dailyStats) {
      totalSessions = Object.values(userData.dailyStats).reduce((sum, dayStats) => {
        return sum + (dayStats.sessionsCount || 0);
      }, 0);
    }

    // Calculate average session length
    const totalTime = userData.totalTimeAllTime || 0;
    const averageSessionLength = totalSessions > 0 ? Math.round(totalTime / totalSessions) : 0;

    // Calculate streak days (consecutive days with study time)
    let streakDays = 0;
    if (userData.dailyStats) {
      const sortedDays = Object.entries(userData.dailyStats)
        .filter(([date, stats]) => stats.totalTime > 0)
        .sort(([a], [b]) => new Date(b) - new Date(a));
      
      const today = new Date();
      let currentDate = new Date(today);
      
      for (const [dateStr] of sortedDays) {
        const dayDate = new Date(dateStr);
        const diffTime = currentDate - dayDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= streakDays + 1) {
          streakDays++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const calculatedStats = { 
      completedTasks, 
      totalTasks, 
      completionRate,
      totalTimeToday: userData.totalTimeToday || 0,
      totalTimeWeek: userData.totalTimeWeek || 0,
      totalTimeMonth: userData.totalTimeMonth || 0,
      totalTimeAllTime: userData.totalTimeAllTime || 0,
      totalSessions,
      averageSessionLength,
      streakDays
    };

    console.log("Calculated stats:", calculatedStats);
    return calculatedStats;
  }, [userData, dataRefreshCount]);

  // Get field times for display
  const fieldTimes = useMemo(() => {
    if (!userData?.fieldTimes) return [];
    
    return Object.entries(userData.fieldTimes)
      .filter(([field, time]) => field && time > 0)
      .sort(([,a], [,b]) => b - a);
  }, [userData?.fieldTimes]);

  // Get recent tasks for overview
  const recentTasks = useMemo(() => {
    if (!userData?.todoList) return [];
    
    return userData.todoList
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [userData?.todoList]);

  // Render appropriate chart based on type and period
  const renderChart = useCallback(() => {
    if (activePeriod === 'fields' && activeChartType === 'pie') {
      return <SafePieChart data={chartData} />;
    } else if (activeChartType === 'line') {
      return <SafeLineChart data={chartData} />;
    } else {
      return <SafeBarChart data={chartData} />;
    }
  }, [chartData, activePeriod, activeChartType]);

  // Loading state
  if (loading) {
    return (
      <ProfileContainer>
        <LoadingContainer>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h3>Loading your profile...</h3>
            <p style={{ color: '#b4b4c1' }}>
              Connecting to database and fetching real-time data...
            </p>
            {connectionError && (
              <div style={{ 
                color: '#f56565', 
                marginTop: '10px',
                padding: '10px',
                background: 'rgba(245, 101, 101, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 101, 101, 0.3)'
              }}>
                Connection issues detected. Retrying...
              </div>
            )}
          </motion.div>
        </LoadingContainer>
      </ProfileContainer>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <ProfileContainer>
        <LoadingContainer>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3>Please log in to view your profile</h3>
            <button 
              onClick={() => navigate("/login")}
              style={{
                background: 'linear-gradient(135deg, #5a67d8, #667eea)',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '12px',
                marginTop: '20px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                transition: 'all 0.3s ease'
              }}
            >
              Go to Login
            </button>
          </motion.div>
        </LoadingContainer>
      </ProfileContainer>
    );
  }

  return (
    <ProfileContainer>
      {/* Left Section */}
      <LeftSection>
        {/* User Information */}
        <InfoContainer>
          <motion.h1
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            Welcome, {userData?.name || user.displayName || "User"}!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <strong>Email:</strong> 
            <span>{userData?.email || user.email}</span>
          </motion.p>
          
          <motion.p
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <strong>Member since:</strong>
            <span>
              {userData?.createdAt?.toDate
                ? userData.createdAt.toDate().toLocaleDateString()
                : user.metadata?.creationTime
                ? new Date(user.metadata.creationTime).toLocaleDateString()
                : "Unknown"}
            </span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <strong>Study Streak:</strong>
            <span>{stats.streakDays} days</span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <strong>Total Sessions:</strong>
            <span>{stats.totalSessions}</span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <strong>Avg Session:</strong>
            <span>{formatTime(stats.averageSessionLength)}</span>
          </motion.p>

          {connectionError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ 
                color: '#f56565', 
                fontSize: '0.9rem', 
                textAlign: 'center',
                background: 'rgba(245, 101, 101, 0.1)',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(245, 101, 101, 0.3)'
              }}
            >
              Connection issues detected. Some data may be outdated.
            </motion.p>
          )}

          <motion.button
            onClick={handleLogout}
            className="logout-button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Logout
          </motion.button>

          <motion.button
            onClick={() => setShowResetConfirm(true)}
            className="reset-button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Reset All Data
          </motion.button>
        </InfoContainer>

        {/* Study Statistics */}
        <StatsContainer>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1, type: "spring", stiffness: 120 }}
          >
            <h3>Study Statistics</h3>
            <div className="stats-grid">
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {formatTime(stats.totalTimeToday)}
                </div>
                <div className="stat-label">Today's Study Time</div>
              </motion.div>
              
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {formatTime(stats.totalTimeWeek)}
                </div>
                <div className="stat-label">This Week</div>
              </motion.div>
              
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {stats.completedTasks}
                </div>
                <div className="stat-label">Completed Tasks</div>
              </motion.div>
              
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {stats.completionRate}%
                </div>
                <div className="stat-label">Completion Rate</div>
              </motion.div>
            </div>
          </motion.div>
        </StatsContainer>

        {/* Field Times Breakdown */}
        <FieldTimesContainer>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <h3>Study Time by Field</h3>
            {fieldTimes.length > 0 ? (
              <AnimatePresence>
                {fieldTimes.map(([field, time], index) => (
                  <motion.div 
                    key={field} 
                    className="field-time-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div>
                      <span className="field-name">{field}</span>
                      <span className="field-time">{formatTime(time)}</span>
                    </div>
                    {field !== "General" && (
                      <button 
                        onClick={() => removeStudyField(field)}
                        className="remove-field-btn"
                        title="Remove field"
                      >
                        Remove
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <motion.div 
                className="no-data-message"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                No study data available yet. Start your first study session!
              </motion.div>
            )}
          </motion.div>
        </FieldTimesContainer>

        {/* Tasks Overview */}
        <TasksOverviewContainer>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            <h3>Recent Tasks</h3>
            {recentTasks.length > 0 ? (
              <div>
                {recentTasks.map((task, index) => (
                  <motion.div 
                    key={task.id || index} 
                    className={`task-item ${task.completed ? 'completed' : ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <span className="task-text">{task.text}</span>
                    <span className={`task-priority ${task.priority?.toLowerCase() || 'medium'}`}>
                      {task.priority || 'Medium'}
                    </span>
                  </motion.div>
                ))}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{ 
                    textAlign: 'center', 
                    marginTop: '15px', 
                    color: '#5a67d8',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate('/session')}
                >
                  View all tasks in Study Session →
                </motion.p>
              </div>
            ) : (
              <motion.div 
                className="no-data-message"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{ textAlign: 'center', color: '#b4b4c1' }}
              >
                No tasks yet. Start by adding tasks in your study session!
              </motion.div>
            )}
          </motion.div>
        </TasksOverviewContainer>
      </LeftSection>

      {/* Right Section */}
      <RightSection>
        {/* Analytics Chart */}
        <AnalyticsContainer>
          <h3>Study Analytics</h3>
          
          {/* Data Refresh Indicator */}
          {lastUpdated && (
            <div className="data-refresh">
              <span className="last-updated">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              {!connectionError && (
                <span style={{ color: '#48bb78', marginLeft: '10px' }}>
                  ● Live data
                </span>
              )}
            </div>
          )}
          
          {/* Chart Type Selector */}
          <div className="period-selector">
            {[
              { key: 'bar', label: 'Bar Chart' },
              { key: 'line', label: 'Line Chart' },
              ...(activePeriod === 'fields' ? [{ key: 'pie', label: 'Pie Chart' }] : [])
            ].map(({ key, label }) => (
              <motion.div 
                key={key}
                className={`period-tab ${activeChartType === key ? 'active' : ''}`}
                onClick={() => setActiveChartType(key)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {label}
              </motion.div>
            ))}
          </div>

          {/* Period Selector */}
          <div className="period-selector">
            {[
              { key: 'fields', label: 'By Fields' },
              { key: 'daily', label: 'Daily' },
              { key: 'weekly', label: 'Weekly' },
              { key: 'monthly', label: 'Monthly' }
            ].map(({ key, label }) => (
              <motion.div 
                key={key}
                className={`period-tab ${activePeriod === key ? 'active' : ''}`}
                onClick={() => {
                  console.log("Switching to period:", key);
                  setActivePeriod(key);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {label}
              </motion.div>
            ))}
          </div>

          {/* Chart Container */}
          <motion.div 
            className="chart-container"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            key={`${activePeriod}-${activeChartType}-${dataRefreshCount}`}
          >
            <ChartErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </ChartErrorBoundary>
          </motion.div>

          {/* Chart Info */}
          <div className="chart-info">
            {chartData.length > 0 ? (
              <span>
                Showing {chartData.length} data points • 
                Total: {chartData.reduce((sum, item) => sum + item.time, 0)} minutes
                {activePeriod !== 'fields' && (
                  <span> • Sessions: {chartData.reduce((sum, item) => sum + (item.sessions || 0), 0)}</span>
                )}
              </span>
            ) : (
              <span>
                Start studying to populate your analytics dashboard
              </span>
            )}
          </div>
        </AnalyticsContainer>

        {/* Additional Stats Container */}
        <StatsContainer>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h3>Additional Metrics</h3>
            <div className="stats-grid">
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {formatTime(stats.totalTimeMonth)}
                </div>
                <div className="stat-label">This Month</div>
              </motion.div>
              
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {formatTime(stats.totalTimeAllTime)}
                </div>
                <div className="stat-label">All Time</div>
              </motion.div>
              
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {userData?.studyFields ? userData.studyFields.length : 0}
                </div>
                <div className="stat-label">Study Fields</div>
              </motion.div>
              
              <motion.div 
                className="stat-item"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className="stat-value">
                  {stats.totalTimeAllTime > 0 ? 
                    Math.round(stats.totalTimeAllTime / (24 * 60 * 60)) : 0}
                </div>
                <div className="stat-label">Study Days</div>
              </motion.div>
            </div>
          </motion.div>
        </StatsContainer>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <ConnectionStatus error={connectionError}>
            <h4>
              {connectionError ? 'Connection Issues' : 'Real-time Connected'}
            </h4>
            <p>
              {connectionError 
                ? 'Data may not be current. Check your internet connection.' 
                : 'Your data is syncing in real-time with the database.'}
            </p>
            {connectionError && (
              <button
                className="refresh-button"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            )}
          </ConnectionStatus>
        </motion.div>
      </RightSection>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                background: 'linear-gradient(145deg, #2d2d3a, #1f1f2e)',
                padding: '40px',
                borderRadius: '20px',
                border: '2px solid #e53e3e',
                color: '#e4e4e7',
                textAlign: 'center',
                maxWidth: '500px',
                margin: '20px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ color: '#e53e3e', marginBottom: '20px' }}>
                Confirm Data Reset
              </h3>
              <p style={{ marginBottom: '30px', color: '#b4b4c1' }}>
                This will permanently delete all your study data, including:
                <br />• All study time records
                <br />• All tasks and to-do items
                <br />• All analytics and statistics
                <br />• Custom study fields (except General)
                <br /><br />
                This action cannot be undone!
              </p>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  style={{
                    background: 'linear-gradient(135deg, #4a5568, #2d3748)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetData}
                  style={{
                    background: 'linear-gradient(135deg, #e53e3e, #c53030)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Yes, Reset All Data
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ProfileContainer>
  );
}

export default Profile;