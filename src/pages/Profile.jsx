import React, { useEffect, useState, Suspense, useMemo, useCallback } from "react";
import styled from "styled-components";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../components/firebase";
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
} from "recharts";

// Styled Components with improved responsive design
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

  .chart-tabs {
    display: flex;
    gap: 12px;
    margin-bottom: 25px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .chart-tab {
    padding: 12px 20px;
    background: linear-gradient(145deg, #3e3e4a, #2a2a36);
    border: 1px solid rgba(90, 103, 216, 0.3);
    border-radius: 25px;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    font-size: 0.95rem;
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
      box-shadow: 0 8px 25px rgba(90, 103, 216, 0.4);
      transform: translateY(-2px);
    }

    &:hover:not(.active) {
      background: linear-gradient(135deg, #4c51bf, #5a67d8);
      transform: translateY(-2px);
      
      &:before {
        left: 100%;
      }
    }
    
    @media (max-width: 768px) {
      padding: 10px 16px;
      font-size: 0.9rem;
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
    padding: 8px 16px;
    background: linear-gradient(145deg, #3e3e4a, #2a2a36);
    border: 1px solid rgba(90, 103, 216, 0.3);
    border-radius: 20px;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    font-weight: 500;

    &.active {
      background: linear-gradient(135deg, #5a67d8, #667eea);
      transform: scale(1.05);
    }

    &:hover:not(.active) {
      background: linear-gradient(135deg, #4c51bf, #5a67d8);
    }
    
    @media (max-width: 768px) {
      padding: 6px 12px;
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
`;

const ModelContainer = styled.div`
  background: linear-gradient(145deg, #2d2d3a, #1f1f2e);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 20px;
  padding: 25px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  height: 600px;
  position: relative;
  overflow: hidden;

  h3 {
    color: #ffffff;
    margin-bottom: 20px;
    font-size: 1.6rem;
    text-align: center;
    background: linear-gradient(45deg, #5a67d8, #667eea);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
  }

  .canvas-container {
    height: calc(100% - 60px);
    border-radius: 16px;
    overflow: hidden;
    background: linear-gradient(145deg, #1a1a1a, #2d2d3a);
    border: 1px solid rgba(90, 103, 216, 0.2);
    position: relative;

    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at center, rgba(90, 103, 216, 0.1), transparent);
      pointer-events: none;
      z-index: 1;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #b4b4c1;
    text-align: center;
    flex-direction: column;
    gap: 15px;

    .retry-button {
      background: linear-gradient(135deg, #5a67d8, #667eea);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;

      &:hover {
        background: linear-gradient(135deg, #4c51bf, #5a67d8);
        transform: translateY(-2px);
      }
    }
  }
  
  @media (max-width: 768px) {
    height: 400px;
    padding: 20px;
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
  }
`;

const ErrorBoundary = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #b4b4c1;
  text-align: center;
  flex-direction: column;
  gap: 15px;
`;

// Chart Error Boundary Component
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    console.warn('Chart Error:', error);
    return { hasError: true };
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
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: 'linear-gradient(135deg, #5a67d8, #667eea)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Error Boundary Component for 3D
class ThreeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("3D Model Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundary>
          <p>3D model temporarily unavailable</p>
          <button 
            className="retry-button"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </ErrorBoundary>
      );
    }

    return this.props.children;
  }
}


// Chart Components with null safety
const SafeBarChart = ({ data }) => (
  <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#3e3e4a" />
    <XAxis 
      dataKey="name" 
      stroke="#b4b4c1" 
      fontSize={12}
      angle={-45}
      textAnchor="end"
      height={60}
    />
    <YAxis stroke="#b4b4c1" fontSize={12} />
    <Tooltip 
      contentStyle={{ 
        backgroundColor: '#2d2d3a', 
        border: '1px solid #5a67d8',
        borderRadius: '8px',
        color: '#ffffff'
      }}
      formatter={(value) => [`${value} min`, 'Study Time']}
    />
    <Bar 
      dataKey="time" 
      fill="#5a67d8" 
      radius={[6, 6, 0, 0]}
    />
  </BarChart>
);

const SafeAreaChart = ({ data }) => (
  <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
    <defs>
      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#5a67d8" stopOpacity={0.8}/>
        <stop offset="95%" stopColor="#5a67d8" stopOpacity={0.1}/>
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#3e3e4a" />
    <XAxis 
      dataKey="name" 
      stroke="#b4b4c1" 
      fontSize={12}
      angle={-45}
      textAnchor="end"
      height={60}
    />
    <YAxis stroke="#b4b4c1" fontSize={12} />
    <Tooltip 
      contentStyle={{ 
        backgroundColor: '#2d2d3a', 
        border: '1px solid #5a67d8',
        borderRadius: '8px',
        color: '#ffffff'
      }}
      formatter={(value) => [`${value} min`, 'Study Time']}
    />
    <Area 
      type="monotone" 
      dataKey="time" 
      stroke="#5a67d8" 
      fill="url(#colorGradient)"
      strokeWidth={3}
    />
  </AreaChart>
);

const SafePieChart = ({ data }) => {
  const COLORS = ['#5a67d8', '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4ecdc4', '#45b7d1'];
  
  return (
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={80}
        outerRadius={140}
        paddingAngle={5}
        dataKey="time"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#2d2d3a', 
          border: '1px solid #5a67d8',
          borderRadius: '8px',
          color: '#ffffff'
        }}
        formatter={(value, name) => [`${value} min`, name]}
      />
    </PieChart>
  );
};

const SafeRadialBarChart = ({ data }) => (
  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={data}>
    <RadialBar
      minAngle={15}
      clockWise
      dataKey="time"
      cornerRadius={5}
      fill="#5a67d8"
    />
    <Tooltip 
      contentStyle={{ 
        backgroundColor: '#2d2d3a', 
        border: '1px solid #5a67d8',
        borderRadius: '8px',
        color: '#ffffff'
      }}
      formatter={(value) => [`${value} min`, 'Study Time']}
    />
  </RadialBarChart>
);

const EmptyChart = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100%',
    color: '#b4b4c1',
    textAlign: 'center',
    fontSize: '1.1rem'
  }}>
    <p>Start studying to see your analytics!</p>
  </div>
);

function Profile() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState('bar');
  const [activePeriod, setActivePeriod] = useState('daily');
  const [connectionError, setConnectionError] = useState(false);
  const [use3D, setUse3D] = useState(true);
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

  // Setup real-time listener with improved error handling
  const setupRealtimeListener = useCallback((userId) => {
    const docRef = doc(db, "users", userId);
    
    return onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setUserData(data);
        setConnectionError(false);
      } else {
        console.warn("User document does not exist");
        setConnectionError(true);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to user data:", error);
      setConnectionError(true);
      toast.error("Connection issue with database");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let unsubscribeAuth = null;
    let unsubscribeUser = null;

    const initializeAuth = async () => {
      try {
        unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
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
      }
    };

    initializeAuth();

    return () => {
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

  // Prepare chart data with improved error handling
  const chartData = useMemo(() => {
    if (!userData) return [];

    let data = [];
    const colors = ['#5a67d8', '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4ecdc4', '#45b7d1'];

    try {
      switch (activePeriod) {
        case 'daily':
          if (userData.dailyStats) {
            data = Object.entries(userData.dailyStats)
              .filter(([, stats]) => stats && typeof stats.totalTime === 'number')
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .slice(-7) // Last 7 days
              .map(([date, stats], index) => ({
                name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                time: Math.floor((stats.totalTime || 0) / 60),
                fill: colors[index % colors.length]
              }));
          }
          break;
        
        case 'weekly':
          if (userData.weeklyStats) {
            data = Object.entries(userData.weeklyStats)
              .filter(([, stats]) => stats && typeof stats.totalTime === 'number')
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .slice(-4) // Last 4 weeks
              .map(([week, stats], index) => ({
                name: `Week ${index + 1}`,
                time: Math.floor((stats.totalTime || 0) / 60),
                fill: colors[index % colors.length]
              }));
          }
          break;
        
        case 'monthly':
          if (userData.monthlyStats) {
            data = Object.entries(userData.monthlyStats)
              .filter(([, stats]) => stats && typeof stats.totalTime === 'number')
              .sort(([a], [b]) => new Date(a + '-01') - new Date(b + '-01'))
              .slice(-6) // Last 6 months
              .map(([month, stats], index) => ({
                name: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
                time: Math.floor((stats.totalTime || 0) / 60),
                fill: colors[index % colors.length]
              }));
          }
          break;
        
        default:
          if (userData.fieldTimes) {
            data = Object.entries(userData.fieldTimes)
              .filter(([field, time]) => field && typeof time === 'number' && time > 0)
              .map(([field, time], index) => ({
                name: field,
                time: Math.floor(time / 60),
                fill: colors[index % colors.length]
              }));
          }
      }
    } catch (error) {
      console.error("Error processing chart data:", error);
    }

    return data.length > 0 ? data : [];
  }, [userData, activePeriod]);

  // Calculate statistics with fallbacks
  const stats = useMemo(() => {
    if (!userData) return { 
      completedTasks: 0, 
      totalTasks: 0, 
      completionRate: 0, 
      totalTimeToday: 0,
      totalTimeWeek: 0,
      totalTimeMonth: 0,
      totalTimeAllTime: 0
    };

    const todoList = userData.todoList || [];
    const completedTasks = todoList.filter(task => task && task.completed).length;
    const totalTasks = todoList.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { 
      completedTasks, 
      totalTasks, 
      completionRate,
      totalTimeToday: userData.totalTimeToday || 0,
      totalTimeWeek: userData.totalTimeWeek || 0,
      totalTimeMonth: userData.totalTimeMonth || 0,
      totalTimeAllTime: userData.totalTimeAllTime || 0
    };
  }, [userData]);

  // Render chart component based on active chart type
  const renderChart = useCallback(() => {
    if (chartData.length === 0) {
      return <EmptyChart />;
    }

    switch (activeChart) {
      case 'bar':
        return <SafeBarChart data={chartData} />;
      case 'area':
        return <SafeAreaChart data={chartData} />;
      case 'pie':
        return <SafePieChart data={chartData} />;
      case 'radial':
        return <SafeRadialBarChart data={chartData} />;
      default:
        return <SafeBarChart data={chartData} />;
    }
  }, [activeChart, chartData]);

  if (loading) {
    return (
      <ProfileContainer>
        <div style={{ textAlign: "center", gridColumn: "1 / -1" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h3>Loading profile...</h3>
            {connectionError && (
              <p style={{ color: '#f56565', marginTop: '10px' }}>
                Connection issues detected. Retrying...
              </p>
            )}
          </motion.div>
        </div>
      </ProfileContainer>
    );
  }

  if (!user) {
    return (
      <ProfileContainer>
        <div style={{ textAlign: "center", gridColumn: "1 / -1" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3>Please log in to view your profile.</h3>
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
        </div>
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

          {connectionError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: '#f56565', fontSize: '0.9rem', textAlign: 'center' }}
            >
              Some data may be outdated due to connection issues
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
            {userData?.fieldTimes && Object.keys(userData.fieldTimes).length > 0 ? (
              <AnimatePresence>
                {Object.entries(userData.fieldTimes)
                  .filter(([field, time]) => field && time > 0)
                  .sort(([,a], [,b]) => b - a)
                  .map(([field, time], index) => (
                    <motion.div 
                      key={field} 
                      className="field-time-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <span className="field-name">{field}</span>
                      <span className="field-time">{formatTime(time)}</span>
                    </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <p style={{ textAlign: 'center', color: '#b4b4c1', fontStyle: 'italic' }}>
                No study data available yet. Start your first study session!
              </p>
            )}
          </motion.div>
        </FieldTimesContainer>
      </LeftSection>

      {/* Right Section */}
      <RightSection>
        {/* Analytics Charts */}
        <AnalyticsContainer>
          <h3>Study Analytics</h3>
          
          <div className="period-selector">
            {['daily', 'weekly', 'monthly', 'fields'].map((period) => (
              <motion.div 
                key={period}
                className={`period-tab ${activePeriod === period ? 'active' : ''}`}
                onClick={() => setActivePeriod(period)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </motion.div>
            ))}
          </div>

          <div className="chart-tabs">
            {['bar', 'area', 'pie', 'radial'].map((chart) => (
              <motion.div 
                key={chart}
                className={`chart-tab ${activeChart === chart ? 'active' : ''}`}
                onClick={() => setActiveChart(chart)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {chart.charAt(0).toUpperCase() + chart.slice(1)} Chart
              </motion.div>
            ))}
          </div>
          
          <motion.div 
            className="chart-container"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <ChartErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </ChartErrorBoundary>
          </motion.div>
        </AnalyticsContainer>

   
      </RightSection>
    </ProfileContainer>
  );
}

export default Profile;