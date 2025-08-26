import React, { useState, useEffect, useCallback, useRef } from 'react';
import Plot from 'react-plotly.js';
import * as math from 'mathjs';
import { 
  Trash2, Plus, Eye, EyeOff, Settings, Grid, ZoomIn, ZoomOut, 
  RotateCcw, Box, Play, Pause, RotateCw, Move, Layers } from 'lucide-react';
import './3D.css'

const GraphingCalculator3D = () => {
  const [surfaces, setSurfaces] = useState([
    { id: 1, expression: 'z = sin(x) * cos(y)', type: 'surface', color: '#8b5cf6', visible: true, opacity: 0.8 }
  ]);
  const [curves, setCurves] = useState([]);
  const [points, setPoints] = useState([]);
  const [newExpression, setNewExpression] = useState('');
  const [activeTab, setActiveTab] = useState('surface'); // surface, curve, points
  const [nextId, setNextId] = useState(2);
  
  const [graphSettings, setGraphSettings] = useState({
    xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5,
    resolution: 50, showAxes: true, showGrid: true,
    backgroundColor: 'rgba(15, 15, 35, 0.9)',
    cameraPosition: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
  });
  
  const [animation, setAnimation] = useState({
    enabled: false, speed: 1, parameter: 't', timeValue: 0
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [variables, setVariables] = useState({ t: 0 });
  const animationRef = useRef();

  const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316'];
  const surfaceTypes = [
    { value: 'surface', label: 'Surface z = f(x,y)', icon: Layers },
    { value: 'parametric_surface', label: 'Parametric Surface', icon: Box },
    { value: 'curve', label: 'Space Curve', icon: Move },
    { value: 'points', label: 'Point Cloud', icon: Grid }
  ];

  // Generate surface data z = f(x,y)
  const generateSurfaceData = useCallback((expression, resolution = 50) => {
    const { xMin, xMax, yMin, yMax } = graphSettings;
    const xStep = (xMax - xMin) / (resolution - 1);
    const yStep = (yMax - yMin) / (resolution - 1);
    
    const x = [];
    const y = [];
    const z = [];
    
    for (let i = 0; i < resolution; i++) {
      const xRow = [];
      const yRow = [];
      const zRow = [];
      
      for (let j = 0; j < resolution; j++) {
        const xVal = xMin + i * xStep;
        const yVal = yMin + j * yStep;
        
        try {
          const expr = expression.replace(/z\s*=\s*/i, '').trim();
          const zVal = math.evaluate(expr, { x: xVal, y: yVal, ...variables });
          
          if (typeof zVal === 'number' && isFinite(zVal)) {
            xRow.push(xVal);
            yRow.push(yVal);
            zRow.push(zVal);
          } else {
            xRow.push(xVal);
            yRow.push(yVal);
            zRow.push(null);
          }
        } catch (error) {
          xRow.push(xVal);
          yRow.push(yVal);
          zRow.push(null);
        }
      }
      
      x.push(xRow);
      y.push(yRow);
      z.push(zRow);
    }
    
    return { x, y, z };
  }, [graphSettings, variables]);

  // Generate parametric surface data
  const generateParametricSurface = useCallback((expressions) => {
    const resolution = graphSettings.resolution;
    const uMin = -2, uMax = 2, vMin = -2, vMax = 2;
    const uStep = (uMax - uMin) / (resolution - 1);
    const vStep = (vMax - vMin) / (resolution - 1);
    
    const x = [];
    const y = [];
    const z = [];
    
    // Parse expressions
    const xExpr = expressions.x || 'u';
    const yExpr = expressions.y || 'v';
    const zExpr = expressions.z || '0';
    
    for (let i = 0; i < resolution; i++) {
      const xRow = [];
      const yRow = [];
      const zRow = [];
      
      for (let j = 0; j < resolution; j++) {
        const u = uMin + i * uStep;
        const v = vMin + j * vStep;
        
        try {
          const xVal = math.evaluate(xExpr, { u, v, ...variables });
          const yVal = math.evaluate(yExpr, { u, v, ...variables });
          const zVal = math.evaluate(zExpr, { u, v, ...variables });
          
          xRow.push(typeof xVal === 'number' && isFinite(xVal) ? xVal : null);
          yRow.push(typeof yVal === 'number' && isFinite(yVal) ? yVal : null);
          zRow.push(typeof zVal === 'number' && isFinite(zVal) ? zVal : null);
        } catch (error) {
          xRow.push(null);
          yRow.push(null);
          zRow.push(null);
        }
      }
      
      x.push(xRow);
      y.push(yRow);
      z.push(zRow);
    }
    
    return { x, y, z };
  }, [graphSettings, variables]);

  // Generate space curve data
  const generateSpaceCurve = useCallback((expressions, numPoints = 500) => {
    const tMin = -10, tMax = 10;
    const tStep = (tMax - tMin) / (numPoints - 1);
    
    const x = [];
    const y = [];
    const z = [];
    
    // Parse expressions
    const xExpr = expressions.x || 't';
    const yExpr = expressions.y || '0';
    const zExpr = expressions.z || '0';
    
    for (let i = 0; i < numPoints; i++) {
      const t = tMin + i * tStep;
      
      try {
        const xVal = math.evaluate(xExpr, { t, ...variables });
        const yVal = math.evaluate(yExpr, { t, ...variables });
        const zVal = math.evaluate(zExpr, { t, ...variables });
        
        if (typeof xVal === 'number' && typeof yVal === 'number' && typeof zVal === 'number' &&
            isFinite(xVal) && isFinite(yVal) && isFinite(zVal)) {
          x.push(xVal);
          y.push(yVal);
          z.push(zVal);
        }
      } catch (error) {
        // Skip invalid points
      }
    }
    
    return { x, y, z };
  }, [variables]);

  // Generate point cloud data
  const generatePointCloud = useCallback((expression, numPoints = 1000) => {
    const { xMin, xMax, yMin, yMax, zMin, zMax } = graphSettings;
    const x = [];
    const y = [];
    const z = [];
    
    for (let i = 0; i < numPoints; i++) {
      const xVal = Math.random() * (xMax - xMin) + xMin;
      const yVal = Math.random() * (yMax - yMin) + yMin;
      const zVal = Math.random() * (zMax - zMin) + zMin;
      
      try {
        // Evaluate condition for point inclusion
        const condition = math.evaluate(expression, { x: xVal, y: yVal, z: zVal, ...variables });
        
        if (condition) {
          x.push(xVal);
          y.push(yVal);
          z.push(zVal);
        }
      } catch (error) {
        // Skip invalid points
      }
    }
    
    return { x, y, z };
  }, [graphSettings, variables]);

  // Parse different expression types
  const parseExpression = useCallback((expression, type) => {
    if (type === 'parametric_surface' || type === 'curve') {
      const parts = expression.split(',').map(part => part.trim());
      const result = {};
      
      parts.forEach(part => {
        if (part.includes('x =')) {
          result.x = part.replace(/x\s*=\s*/i, '').trim();
        } else if (part.includes('y =')) {
          result.y = part.replace(/y\s*=\s*/i, '').trim();
        } else if (part.includes('z =')) {
          result.z = part.replace(/z\s*=\s*/i, '').trim();
        }
      });
      
      return result;
    }
    
    return expression;
  }, []);

  // Process each graph object
  const processGraphObject = useCallback((obj) => {
    try {
      let data = {};
      
      switch (obj.type) {
        case 'surface':
          data = generateSurfaceData(obj.expression);
          return {
            ...data,
            type: 'surface',
            name: obj.expression,
            colorscale: [[0, obj.color + '20'], [1, obj.color]],
            opacity: obj.opacity,
            visible: obj.visible,
            showscale: false,
            contours: {
              z: { show: true, usecolormap: true, highlightcolor: "limegreen", project: { z: true } }
            }
          };
          
        case 'parametric_surface':
          const surfaceExpressions = parseExpression(obj.expression, 'parametric_surface');
          data = generateParametricSurface(surfaceExpressions);
          return {
            ...data,
            type: 'surface',
            name: obj.expression,
            colorscale: [[0, obj.color + '20'], [1, obj.color]],
            opacity: obj.opacity,
            visible: obj.visible,
            showscale: false
          };
          
        case 'curve':
          const curveExpressions = parseExpression(obj.expression, 'curve');
          data = generateSpaceCurve(curveExpressions);
          return {
            ...data,
            type: 'scatter3d',
            mode: 'lines',
            name: obj.expression,
            line: { color: obj.color, width: 4 },
            visible: obj.visible
          };
          
        case 'points':
          data = generatePointCloud(obj.expression);
          return {
            ...data,
            type: 'scatter3d',
            mode: 'markers',
            name: obj.expression,
            marker: { 
              color: obj.color, 
              size: 3,
              opacity: obj.opacity || 0.8
            },
            visible: obj.visible
          };
          
        default:
          return null;
      }
    } catch (error) {
      console.error('Error processing graph object:', error);
      return null;
    }
  }, [generateSurfaceData, generateParametricSurface, generateSpaceCurve, generatePointCloud, parseExpression]);

  // Extract variables from expressions
  useEffect(() => {
    const extractedVars = { ...variables };
    let updated = false;
    
    const allObjects = [...surfaces, ...curves, ...points];
    
    allObjects.forEach(obj => {
      try {
        const node = math.parse(obj.expression);
        node.filter(node => node.isSymbolNode).forEach(symbolNode => {
          const name = symbolNode.name;
          if (!['x', 'y', 'z', 't', 'u', 'v', 'e', 'pi', 'sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'].includes(name) &&
              !extractedVars.hasOwnProperty(name)) {
            extractedVars[name] = 1;
            updated = true;
          }
        });
      } catch (error) {
        // Skip parsing errors
      }
    });
    
    if (updated) {
      setVariables(extractedVars);
    }
  }, [surfaces, curves, points, variables]);

  // Animation loop
  useEffect(() => {
    if (animation.enabled) {
      const animate = () => {
        setVariables(prev => ({
          ...prev,
          [animation.parameter]: prev[animation.parameter] + 0.1 * animation.speed
        }));
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animation]);

  const addGraphObject = () => {
    if (newExpression.trim()) {
      const newObj = {
        id: nextId,
        expression: newExpression.trim(),
        type: activeTab,
        color: colors[(nextId - 1) % colors.length],
        visible: true,
        opacity: activeTab === 'surface' ? 0.8 : 0.9
      };
      
      if (activeTab === 'surface' || activeTab === 'parametric_surface') {
        setSurfaces([...surfaces, newObj]);
      } else if (activeTab === 'curve') {
        setCurves([...curves, newObj]);
      } else if (activeTab === 'points') {
        setPoints([...points, newObj]);
      }
      
      setNewExpression('');
      setNextId(nextId + 1);
    }
  };

  const updateGraphObject = (id, field, value, type) => {
    if (type === 'surface' || type === 'parametric_surface') {
      setSurfaces(surfaces.map(obj => obj.id === id ? { ...obj, [field]: value } : obj));
    } else if (type === 'curve') {
      setCurves(curves.map(obj => obj.id === id ? { ...obj, [field]: value } : obj));
    } else if (type === 'points') {
      setPoints(points.map(obj => obj.id === id ? { ...obj, [field]: value } : obj));
    }
  };

  const deleteGraphObject = (id, type) => {
    if (type === 'surface' || type === 'parametric_surface') {
      setSurfaces(surfaces.filter(obj => obj.id !== id));
    } else if (type === 'curve') {
      setCurves(curves.filter(obj => obj.id !== id));
    } else if (type === 'points') {
      setPoints(points.filter(obj => obj.id !== id));
    }
  };

  const toggleVisibility = (id, type) => {
    const obj = [...surfaces, ...curves, ...points].find(o => o.id === id);
    if (obj) {
      updateGraphObject(id, 'visible', !obj.visible, type);
    }
  };

  const resetView = () => {
    setGraphSettings(prev => ({
      ...prev,
      xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5,
      cameraPosition: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
    }));
  };

  const toggleAnimation = () => {
    setAnimation(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  // Prepare plot data
  const allObjects = [...surfaces, ...curves, ...points];
  const plotData = allObjects.map(processGraphObject).filter(Boolean);

  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e5e7eb', family: 'Inter, sans-serif' },
    scene: {
      bgcolor: graphSettings.backgroundColor,
      xaxis: {
        range: [graphSettings.xMin, graphSettings.xMax],
        showgrid: graphSettings.showGrid,
        gridcolor: 'rgba(139, 92, 246, 0.3)',
        showline: graphSettings.showAxes,
        linecolor: 'rgba(139, 92, 246, 0.5)',
        title: { text: 'X', font: { color: '#e5e7eb' } },
        tickcolor: 'rgba(139, 92, 246, 0.4)',
        color: '#e5e7eb'
      },
      yaxis: {
        range: [graphSettings.yMin, graphSettings.yMax],
        showgrid: graphSettings.showGrid,
        gridcolor: 'rgba(139, 92, 246, 0.3)',
        showline: graphSettings.showAxes,
        linecolor: 'rgba(139, 92, 246, 0.5)',
        title: { text: 'Y', font: { color: '#e5e7eb' } },
        tickcolor: 'rgba(139, 92, 246, 0.4)',
        color: '#e5e7eb'
      },
      zaxis: {
        range: [graphSettings.zMin, graphSettings.zMax],
        showgrid: graphSettings.showGrid,
        gridcolor: 'rgba(139, 92, 246, 0.3)',
        showline: graphSettings.showAxes,
        linecolor: 'rgba(139, 92, 246, 0.5)',
        title: { text: 'Z', font: { color: '#e5e7eb' } },
        tickcolor: 'rgba(139, 92, 246, 0.4)',
        color: '#e5e7eb'
      },
      camera: graphSettings.cameraPosition
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: [
      'zoom3d', 'pan3d', 'orbitRotation', 'tableRotation', 'handleDrag3d',
      'resetCameraDefault3d', 'resetCameraLastSave3d', 'hoverClosest3d'
    ],
    displaylogo: false
  };

  const getPlaceholderForType = (type) => {
    switch (type) {
      case 'surface': return 'z = sin(x) * cos(y)';
      case 'parametric_surface': return 'x = u*cos(v), y = u*sin(v), z = u';
      case 'curve': return 'x = cos(t), y = sin(t), z = t';
      case 'points': return 'x^2 + y^2 + z^2 < 1';
      default: return 'Enter equation...';
    }
  };

  const getExamplesForType = (type) => {
    switch (type) {
      case 'surface':
        return [
          'z = x^2 + y^2',
          'z = sin(x) * cos(y)',
          'z = x*y',
          'z = cos(sqrt(x^2 + y^2))'
        ];
      case 'parametric_surface':
        return [
          'x = u*cos(v), y = u*sin(v), z = u',
          'x = cos(u)*cos(v), y = cos(u)*sin(v), z = sin(u)',
          'x = u, y = v, z = u^2 + v^2'
        ];
      case 'curve':
        return [
          'x = cos(t), y = sin(t), z = t',
          'x = t, y = t^2, z = t^3',
          'x = sin(t), y = cos(t), z = sin(2*t)'
        ];
      case 'points':
        return [
          'x^2 + y^2 + z^2 < 1',
          'abs(x) + abs(y) + abs(z) < 1',
          'sin(x*y*z) > 0'
        ];
      default:
        return [];
    }
  };

  return (
    <div className="graphing-calculator-3d">
      <div className="sidebar-3d">
        <div className="header-3d">
          <h1>3D Graphing Calculator</h1>
          <div className="controls-3d">
            <button onClick={() => setShowSettings(!showSettings)} className="control-btn-3d">
              <Settings size={18} />
            </button>
            <button onClick={toggleAnimation} className={`control-btn-3d ${animation.enabled ? 'active' : ''}`}>
              {animation.enabled ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={resetView} className="control-btn-3d">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="settings-panel-3d">
            <h3>Graph Settings</h3>
            <div className="setting-grid">
              <div className="setting-group-3d">
                <label>X Range:</label>
                <div className="range-inputs-3d">
                  <input
                    type="number"
                    value={graphSettings.xMin}
                    onChange={(e) => setGraphSettings(prev => ({ ...prev, xMin: parseFloat(e.target.value) }))}
                    step="0.5"
                  />
                  <input
                    type="number"
                    value={graphSettings.xMax}
                    onChange={(e) => setGraphSettings(prev => ({ ...prev, xMax: parseFloat(e.target.value) }))}
                    step="0.5"
                  />
                </div>
              </div>
              <div className="setting-group-3d">
                <label>Y Range:</label>
                <div className="range-inputs-3d">
                  <input
                    type="number"
                    value={graphSettings.yMin}
                    onChange={(e) => setGraphSettings(prev => ({ ...prev, yMin: parseFloat(e.target.value) }))}
                    step="0.5"
                  />
                  <input
                    type="number"
                    value={graphSettings.yMax}
                    onChange={(e) => setGraphSettings(prev => ({ ...prev, yMax: parseFloat(e.target.value) }))}
                    step="0.5"
                  />
                </div>
              </div>
              <div className="setting-group-3d">
                <label>Z Range:</label>
                <div className="range-inputs-3d">
                  <input
                    type="number"
                    value={graphSettings.zMin}
                    onChange={(e) => setGraphSettings(prev => ({ ...prev, zMin: parseFloat(e.target.value) }))}
                    step="0.5"
                  />
                  <input
                    type="number"
                    value={graphSettings.zMax}
                    onChange={(e) => setGraphSettings(prev => ({ ...prev, zMax: parseFloat(e.target.value) }))}
                    step="0.5"
                  />
                </div>
              </div>
            </div>
            <div className="setting-group-3d">
              <label>Resolution: {graphSettings.resolution}</label>
              <input
                type="range"
                min="20"
                max="100"
                value={graphSettings.resolution}
                onChange={(e) => setGraphSettings(prev => ({ ...prev, resolution: parseInt(e.target.value) }))}
              />
            </div>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={graphSettings.showGrid}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, showGrid: e.target.checked }))}
                />
                Show Grid
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={graphSettings.showAxes}
                  onChange={(e) => setGraphSettings(prev => ({ ...prev, showAxes: e.target.checked }))}
                />
                Show Axes
              </label>
            </div>
          </div>
        )}

        <div className="tabs-3d">
          {surfaceTypes.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => setActiveTab(type.value)}
                className={`tab-btn-3d ${activeTab === type.value ? 'active' : ''}`}
                title={type.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <div className="expressions-section-3d">
          <h3>{surfaceTypes.find(t => t.value === activeTab)?.label}</h3>
          
          <div className="add-expression-3d">
            <textarea
              value={newExpression}
              onChange={(e) => setNewExpression(e.target.value)}
              placeholder={getPlaceholderForType(activeTab)}
              rows={3}
            />
            <button onClick={addGraphObject} className="add-btn-3d">
              <Plus size={18} />
            </button>
          </div>

          <div className="expressions-list-3d">
            {allObjects.map((obj) => (
              <div key={obj.id} className="expression-item-3d">
                <div className="expression-color-3d" style={{ backgroundColor: obj.color }}></div>
                <textarea
                  value={obj.expression}
                  onChange={(e) => updateGraphObject(obj.id, 'expression', e.target.value, obj.type)}
                  className="expression-input-3d"
                  rows={2}
                />
                <div className="expression-controls">
                  {(obj.type === 'surface' || obj.type === 'parametric_surface' || obj.type === 'points') && (
                    <div className="opacity-control">
                      <label>Opacity</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={obj.opacity}
                        onChange={(e) => updateGraphObject(obj.id, 'opacity', parseFloat(e.target.value), obj.type)}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => toggleVisibility(obj.id, obj.type)}
                    className={`visibility-btn-3d ${obj.visible ? 'visible' : 'hidden'}`}
                  >
                    {obj.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => deleteGraphObject(obj.id, obj.type)}
                    className="delete-btn-3d"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(variables).length > 0 && (
          <div className="variables-section-3d">
            <h3>Variables & Animation</h3>
            {Object.keys(variables).map((varName) => (
              <div key={varName} className="variable-slider-3d">
                <div className="variable-header">
                  <label>{varName}: {variables[varName].toFixed(2)}</label>
                  <button
                    onClick={() => setAnimation(prev => ({ ...prev, parameter: varName }))}
                    className={`animate-btn ${animation.parameter === varName ? 'active' : ''}`}
                    title="Animate this variable"
                  >
                    <RotateCw size={12} />
                  </button>
                </div>
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
            {animation.parameter && (
              <div className="animation-controls">
                <label>Animation Speed: {animation.speed.toFixed(1)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={animation.speed}
                  onChange={(e) => setAnimation(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                />
              </div>
            )}
          </div>
        )}

        <div className="examples-3d">
          <h3>Examples</h3>
          <div className="example-buttons-3d">
            {getExamplesForType(activeTab).map((example, index) => (
              <button
                key={index}
                onClick={() => setNewExpression(example)}
                className="example-btn-3d"
              >
                {example.length > 25 ? example.substring(0, 25) + '...' : example}
              </button>
            ))}
          </div>
        </div>

        <div className="learning-tips-3d">
          <h3>Learning Tips</h3>
          <div className="tips-content">
            <p>🎯 <strong>Surfaces:</strong> Use z = f(x,y) for height maps</p>
            <p>🌟 <strong>Parametric:</strong> Great for complex 3D shapes</p>
            <p>📍 <strong>Curves:</strong> Perfect for 3D trajectories</p>
            <p>🎨 <strong>Animation:</strong> Click ⟲ next to variables to animate</p>
          </div>
        </div>
      </div>

      <div className="graph-container-3d">
        <div className="graph-overlay">
          <div className="graph-info">
            <span>Objects: {allObjects.length}</span>
            <span>Resolution: {graphSettings.resolution}×{graphSettings.resolution}</span>
            {animation.enabled && (
              <span className="animation-indicator">
                🎬 Animating {animation.parameter}
              </span>
            )}
          </div>
        </div>
        
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          onRelayout={(event) => {
            if (event['scene.camera']) {
              setGraphSettings(prev => ({
                ...prev,
                cameraPosition: event['scene.camera']
              }));
            }
          }}
        />
        
        <div className="quick-controls">
          <button onClick={() => {
            setGraphSettings(prev => ({
              ...prev,
              cameraPosition: { eye: { x: 2, y: 0, z: 0 } }
            }));
          }} className="view-btn" title="Front View">
            Front
          </button>
          <button onClick={() => {
            setGraphSettings(prev => ({
              ...prev,
              cameraPosition: { eye: { x: 0, y: 2, z: 0 } }
            }));
          }} className="view-btn" title="Side View">
            Side
          </button>
          <button onClick={() => {
            setGraphSettings(prev => ({
              ...prev,
              cameraPosition: { eye: { x: 0, y: 0, z: 2 } }
            }));
          }} className="view-btn" title="Top View">
            Top
          </button>
          <button onClick={() => {
            setGraphSettings(prev => ({
              ...prev,
              cameraPosition: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
            }));
          }} className="view-btn" title="Isometric View">
            ISO
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphingCalculator3D;