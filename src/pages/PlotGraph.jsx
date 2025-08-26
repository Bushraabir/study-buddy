import React, { useState, useEffect, useCallback } from 'react';
import Plot from 'react-plotly.js';
import * as math from 'mathjs';
import { Trash2, Plus, Eye, EyeOff, Settings, Grid, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import "./PlotGraph.css";
const GraphingCalculator = () => {
  const [equations, setEquations] = useState([
    { id: 1, expression: 'y = x^2', color: '#8b5cf6', visible: true, error: null }
  ]);
  const [newEquation, setNewEquation] = useState('');
  const [nextId, setNextId] = useState(2);
  const [graphSettings, setGraphSettings] = useState({
    xMin: -10, xMax: 10, yMin: -10, yMax: 10,
    showGrid: true, showAxes: true, showLabels: true,
    gridStyle: 'solid', aspectRatio: 'auto'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [variables, setVariables] = useState({});

  const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316'];

  // Generate data points for plotting
  const generateDataPoints = useCallback((expression, numPoints = 1000) => {
    const { xMin, xMax } = graphSettings;
    const step = (xMax - xMin) / (numPoints - 1);
    const xValues = [];
    const yValues = [];

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      try {
        let y;
        
        // Handle different equation types
        if (expression.toLowerCase().includes('y =')) {
          const expr = expression.replace(/y\s*=\s*/i, '').trim();
          y = math.evaluate(expr, { x, ...variables });
        } else if (expression.toLowerCase().includes('x =')) {
          // For x = f(y) equations, we need to solve differently
          continue;
        } else {
          // Assume it's a function of x
          y = math.evaluate(expression, { x, ...variables });
        }

        if (typeof y === 'number' && isFinite(y)) {
          xValues.push(x);
          yValues.push(y);
        }
      } catch (error) {
        // Skip invalid points
      }
    }

    return { x: xValues, y: yValues };
  }, [graphSettings, variables]);

  // Handle implicit equations (like x^2 + y^2 = 25)
  const generateImplicitData = useCallback((expression) => {
    const { xMin, xMax, yMin, yMax } = graphSettings;
    const resolution = 200;
    const xStep = (xMax - xMin) / resolution;
    const yStep = (yMax - yMin) / resolution;
    
    const xValues = [];
    const yValues = [];
    
    // Parse the equation to get left and right sides
    let leftSide, rightSide;
    if (expression.includes('=')) {
      const parts = expression.split('=');
      leftSide = parts[0].trim();
      rightSide = parts[1].trim() || '0';
    } else {
      leftSide = expression;
      rightSide = '0';
    }

    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const x = xMin + i * xStep;
        const y = yMin + j * yStep;
        
        try {
          const leftValue = math.evaluate(leftSide, { x, y, ...variables });
          const rightValue = math.evaluate(rightSide, { x, y, ...variables });
          const diff = Math.abs(leftValue - rightValue);
          
          if (diff < 0.1) {
            xValues.push(x);
            yValues.push(y);
          }
        } catch (error) {
          // Skip invalid points
        }
      }
    }

    return { x: xValues, y: yValues };
  }, [graphSettings, variables]);

  // Generate parametric equations (x = f(t), y = g(t))
  const generateParametricData = useCallback((xExpr, yExpr) => {
    const tValues = [];
    const xValues = [];
    const yValues = [];
    
    const tMin = -10;
    const tMax = 10;
    const numPoints = 1000;
    const step = (tMax - tMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const t = tMin + i * step;
      try {
        const x = math.evaluate(xExpr, { t, ...variables });
        const y = math.evaluate(yExpr, { t, ...variables });
        
        if (typeof x === 'number' && typeof y === 'number' && 
            isFinite(x) && isFinite(y)) {
          xValues.push(x);
          yValues.push(y);
        }
      } catch (error) {
        // Skip invalid points
      }
    }

    return { x: xValues, y: yValues };
  }, [variables]);

  // Detect equation type and generate appropriate data
  const processEquation = useCallback((equation) => {
    const expr = equation.expression.toLowerCase().trim();
    
    try {
      // Parametric equations
      if (expr.includes('x =') && expr.includes('y =')) {
        const parts = equation.expression.split(',');
        const xPart = parts.find(p => p.toLowerCase().includes('x ='));
        const yPart = parts.find(p => p.toLowerCase().includes('y ='));
        
        if (xPart && yPart) {
          const xExpr = xPart.replace(/x\s*=\s*/i, '').trim();
          const yExpr = yPart.replace(/y\s*=\s*/i, '').trim();
          return {
            ...generateParametricData(xExpr, yExpr),
            mode: 'lines',
            type: 'scatter',
            name: equation.expression,
            line: { color: equation.color, width: 2 },
            visible: equation.visible
          };
        }
      }
      
      // Implicit equations
      if (expr.includes('=') && !expr.includes('y =') && !expr.includes('x =')) {
        return {
          ...generateImplicitData(equation.expression),
          mode: 'markers',
          type: 'scatter',
          name: equation.expression,
          marker: { color: equation.color, size: 1 },
          visible: equation.visible
        };
      }
      
      // Explicit equations (y = f(x))
      return {
        ...generateDataPoints(equation.expression),
        mode: 'lines',
        type: 'scatter',
        name: equation.expression,
        line: { color: equation.color, width: 2 },
        visible: equation.visible
      };
    } catch (error) {
      return {
        x: [],
        y: [],
        mode: 'lines',
        type: 'scatter',
        name: equation.expression,
        line: { color: equation.color, width: 2 },
        visible: equation.visible
      };
    }
  }, [generateDataPoints, generateImplicitData, generateParametricData]);

  // Extract variables from equations
  useEffect(() => {
    const extractedVars = {};
    equations.forEach(eq => {
      try {
        const node = math.parse(eq.expression);
        node.filter(node => node.isSymbolNode).forEach(symbolNode => {
          const name = symbolNode.name;
          if (!['x', 'y', 't', 'e', 'pi', 'sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'].includes(name) &&
              !extractedVars.hasOwnProperty(name)) {
            extractedVars[name] = variables[name] || 1;
          }
        });
      } catch (error) {
        // Skip parsing errors
      }
    });
    
    if (JSON.stringify(extractedVars) !== JSON.stringify(variables)) {
      setVariables(extractedVars);
    }
  }, [equations, variables]);

  const addEquation = () => {
    if (newEquation.trim()) {
      const newEq = {
        id: nextId,
        expression: newEquation.trim(),
        color: colors[(nextId - 1) % colors.length],
        visible: true,
        error: null
      };
      
      setEquations([...equations, newEq]);
      setNewEquation('');
      setNextId(nextId + 1);
    }
  };

  const updateEquation = (id, field, value) => {
    setEquations(equations.map(eq => 
      eq.id === id ? { ...eq, [field]: value } : eq
    ));
  };

  const deleteEquation = (id) => {
    setEquations(equations.filter(eq => eq.id !== id));
  };

  const toggleVisibility = (id) => {
    updateEquation(id, 'visible', !equations.find(eq => eq.id === id).visible);
  };

  const resetView = () => {
    setGraphSettings(prev => ({
      ...prev,
      xMin: -10, xMax: 10, yMin: -10, yMax: 10
    }));
  };

  const zoomIn = () => {
    const factor = 0.8;
    setGraphSettings(prev => {
      const xCenter = (prev.xMin + prev.xMax) / 2;
      const yCenter = (prev.yMin + prev.yMax) / 2;
      const xRange = (prev.xMax - prev.xMin) * factor;
      const yRange = (prev.yMax - prev.yMin) * factor;
      
      return {
        ...prev,
        xMin: xCenter - xRange / 2,
        xMax: xCenter + xRange / 2,
        yMin: yCenter - yRange / 2,
        yMax: yCenter + yRange / 2
      };
    });
  };

  const zoomOut = () => {
    const factor = 1.25;
    setGraphSettings(prev => {
      const xCenter = (prev.xMin + prev.xMax) / 2;
      const yCenter = (prev.yMin + prev.yMax) / 2;
      const xRange = (prev.xMax - prev.xMin) * factor;
      const yRange = (prev.yMax - prev.yMin) * factor;
      
      return {
        ...prev,
        xMin: xCenter - xRange / 2,
        xMax: xCenter + xRange / 2,
        yMin: yCenter - yRange / 2,
        yMax: yCenter + yRange / 2
      };
    });
  };

  const plotData = equations.map(processEquation);

  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e5e7eb', family: 'Inter, sans-serif' },
    title: {
      text: '',
      font: { size: 20, color: '#f3f4f6' }
    },
    xaxis: {
      range: [graphSettings.xMin, graphSettings.xMax],
      showgrid: graphSettings.showGrid,
      gridcolor: 'rgba(139, 92, 246, 0.2)',
      gridwidth: 1,
      zeroline: graphSettings.showAxes,
      zerolinecolor: 'rgba(139, 92, 246, 0.5)',
      zerolinewidth: 2,
      showticklabels: graphSettings.showLabels,
      tickcolor: 'rgba(139, 92, 246, 0.3)',
      color: '#e5e7eb'
    },
    yaxis: {
      range: [graphSettings.yMin, graphSettings.yMax],
      showgrid: graphSettings.showGrid,
      gridcolor: 'rgba(139, 92, 246, 0.2)',
      gridwidth: 1,
      zeroline: graphSettings.showAxes,
      zerolinecolor: 'rgba(139, 92, 246, 0.5)',
      zerolinewidth: 2,
      showticklabels: graphSettings.showLabels,
      tickcolor: 'rgba(139, 92, 246, 0.3)',
      color: '#e5e7eb'
    },
    margin: { l: 60, r: 20, t: 40, b: 50 },
    showlegend: false,
    dragmode: 'pan'
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: [
      'zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d',
      'autoScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian',
      'toggleSpikelines', 'toImage'
    ],
    displaylogo: false
  };

  return (
    <div className="graphing-calculator">
      <div className="sidebar">
        <div className="header">
         
          <div className="controls">
            <button onClick={() => setShowSettings(!showSettings)} className="control-btn">
              <Settings size={18} />
            </button>
            <button onClick={zoomIn} className="control-btn">
              <ZoomIn size={18} />
            </button>
            <button onClick={zoomOut} className="control-btn">
              <ZoomOut size={18} />
            </button>
            <button onClick={resetView} className="control-btn">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <h3>Graph Settings</h3>
            <div className="setting-group">
              <label>X Range:</label>
              <div className="range-inputs">
                <input
                  type="number"
                  value={graphSettings.xMin}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, xMin: parseFloat(e.target.value) }))}
                  step="0.1"
                />
                <span>to</span>
                <input
                  type="number"
                  value={graphSettings.xMax}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, xMax: parseFloat(e.target.value) }))}
                  step="0.1"
                />
              </div>
            </div>
            <div className="setting-group">
              <label>Y Range:</label>
              <div className="range-inputs">
                <input
                  type="number"
                  value={graphSettings.yMin}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, yMin: parseFloat(e.target.value) }))}
                  step="0.1"
                />
                <span>to</span>
                <input
                  type="number"
                  value={graphSettings.yMax}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, yMax: parseFloat(e.target.value) }))}
                  step="0.1"
                />
              </div>
            </div>
            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={graphSettings.showGrid}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, showGrid: e.target.checked }))}
                />
                Show Grid
              </label>
            </div>
            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={graphSettings.showAxes}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, showAxes: e.target.checked }))}
                />
                Show Axes
              </label>
            </div>
            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={graphSettings.showLabels}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
                />
                Show Labels
              </label>
            </div>
          </div>
        )}

        <div className="equations-section">
          <h3>Equations</h3>
          
          <div className="add-equation">
            <input
              type="text"
              value={newEquation}
              onChange={(e) => setNewEquation(e.target.value)}
              placeholder="Enter equation (e.g., y = x^2)"
              onKeyPress={(e) => e.key === 'Enter' && addEquation()}
            />
            <button onClick={addEquation} className="add-btn">
              <Plus size={18} />
            </button>
          </div>

          <div className="equations-list">
            {equations.map((equation) => (
              <div key={equation.id} className="equation-item">
                <div className="equation-color" style={{ backgroundColor: equation.color }}></div>
                <input
                  type="text"
                  value={equation.expression}
                  onChange={(e) => updateEquation(equation.id, 'expression', e.target.value)}
                  className="equation-input"
                />
                <button
                  onClick={() => toggleVisibility(equation.id)}
                  className={`visibility-btn ${equation.visible ? 'visible' : 'hidden'}`}
                >
                  {equation.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => deleteEquation(equation.id)}
                  className="delete-btn"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(variables).length > 0 && (
          <div className="variables-section">
            <h3>Variables</h3>
            {Object.keys(variables).map((varName) => (
              <div key={varName} className="variable-slider">
                <label>{varName}: {variables[varName].toFixed(2)}</label>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={variables[varName]}
                  onChange={(e) => setVariables(prev => ({
                    ...prev,
                    [varName]: parseFloat(e.target.value)
                  }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="examples">
          <h3>Examples</h3>
          <div className="example-buttons">
            <button onClick={() => setNewEquation('y = sin(x)')}>Sine Wave</button>
            <button onClick={() => setNewEquation('y = x^3 - 3*x')}>Cubic</button>
            <button onClick={() => setNewEquation('x^2 + y^2 = 25')}>Circle</button>
            <button onClick={() => setNewEquation('x = cos(t), y = sin(t)')}>Parametric</button>
          </div>
        </div>
      </div>

      <div className="graph-container">
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          onRelayout={(event) => {
            if (event['xaxis.range[0]'] !== undefined) {
              setGraphSettings(prev => ({
                ...prev,
                xMin: event['xaxis.range[0]'],
                xMax: event['xaxis.range[1]'],
                yMin: event['yaxis.range[0]'],
                yMax: event['yaxis.range[1]']
              }));
            }
          }}
        />
      </div>
    </div>
  );
};

export default GraphingCalculator;