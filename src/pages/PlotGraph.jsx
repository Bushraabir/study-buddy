import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import * as math from "mathjs";
import "./PlotGraph.css";

const PlotGraph = () => {
  const [equations, setEquations] = useState([]);
  const [inputEquation, setInputEquation] = useState("");
  const [error, setError] = useState("");
  const [graphOptions, setGraphOptions] = useState({
    showGrid: true,
    showAxisTitles: true,
    xAxisScale: "linear",
    yAxisScale: "linear",
    graphType: "lines",
    xRange: [-10, 10],
    yRange: [-10, 10],
    equalAspect: false,
  });
  const [advancedFeatures, setAdvancedFeatures] = useState({
    showDerivative: false,
    showIntegral: false,
    showRoots: false,
    showAsymptotes: false,
  });
  const [variables, setVariables] = useState({});

  const instructions = (
    <div className="instructions">
      <h3>Supported Equation Types</h3>
      <ul>
        <li>
          Explicit: <code>y = f(x)</code>
        </li>
        <li>
          Implicit: <code>F(x,y)=0</code>
        </li>
        <li>
          Parametric: <code>x = f(t), y = g(t)</code>
        </li>
        <li>
          Polar: <code>r = f(θ)</code>
        </li>
      </ul>
      <div>
        <p>
          Custom variables (e.g., <code>a</code>, <code>b</code>) will appear as sliders.
        </p>
      </div>
    </div>
  );

  const detectEquationType = (equation) => {
    if (/^\s*y\s*=\s*/.test(equation)) return "explicit";
    if (equation.includes(",") && equation.includes("x=") && equation.includes("y="))
      return "parametric";
    if (/^\s*r\s*=\s*/.test(equation)) return "polar";
    if (equation.includes("=")) return "implicit";
    return "unknown";
  };

  const generateXValues = (num = 500) => {
    const [min, max] = graphOptions.xRange;
    const step = (max - min) / (num - 1);
    return Array.from({ length: num }, (_, i) => min + i * step);
  };

  const generateTValues = (num = 500) => {
    const step = 20 / (num - 1);
    return Array.from({ length: num }, (_, i) => -10 + i * step);
  };

  const generateExplicitData = (equation) => {
    const xValues = generateXValues();
    const expr = equation.replace(/^\s*y\s*=\s*/, "");
    const yValues = xValues.map((x) => {
      try {
        return math.evaluate(expr, { x, ...variables });
      } catch (e) {
        return null;
      }
    });
    return { x: xValues, y: yValues };
  };

  const generateImplicitData = (equation) => {
    const [minX, maxX] = graphOptions.xRange;
    const [minY, maxY] = graphOptions.yRange;
    const xValues = Array.from({ length: 200 }, (_, i) => minX + ((maxX - minX) * i) / 199);
    const yValues = Array.from({ length: 200 }, (_, i) => minY + ((maxY - minY) * i) / 199);
    const points = { x: [], y: [] };
    const expr = equation.replace("=", "-");
    xValues.forEach((x) => {
      yValues.forEach((y) => {
        try {
          const result = math.evaluate(expr, { x, y, ...variables });
          if (Math.abs(result) < 0.1) {
            points.x.push(x);
            points.y.push(y);
          }
        } catch (e) {}
      });
    });
    return points;
  };

  const generateParametricData = (equation) => {
    const parts = equation.split(",");
    if (parts.length < 2) return { x: [], y: [] };
    const xPart = parts.find((p) => /x\s*=/.test(p));
    const yPart = parts.find((p) => /y\s*=/.test(p));
    if (!xPart || !yPart) return { x: [], y: [] };
    const exprX = xPart.replace(/^\s*x\s*=\s*/, "");
    const exprY = yPart.replace(/^\s*y\s*=\s*/, "");
    const tValues = generateTValues();
    const xValues = tValues.map((t) => {
      try {
        return math.evaluate(exprX, { t, ...variables });
      } catch (e) {
        return null;
      }
    });
    const yValues = tValues.map((t) => {
      try {
        return math.evaluate(exprY, { t, ...variables });
      } catch (e) {
        return null;
      }
    });
    return { x: xValues, y: yValues };
  };

  const generatePolarData = (equation) => {
    const thetaValues = Array.from({ length: 500 }, (_, i) => (i * 2 * Math.PI) / 499);
    const expr = equation.replace(/^\s*r\s*=\s*/, "");
    const rValues = thetaValues.map((theta) => {
      try {
        return math.evaluate(expr, { θ: theta, theta, ...variables });
      } catch (e) {
        return null;
      }
    });
    const xValues = rValues.map((r, i) => (r ? r * Math.cos(thetaValues[i]) : null));
    const yValues = rValues.map((r, i) => (r ? r * Math.sin(thetaValues[i]) : null));
    return { x: xValues, y: yValues };
  };

  const computeDerivativeData = (equation) => {
    const expr = equation.replace(/^\s*y\s*=\s*/, "");
    let derivative;
    try {
      derivative = math.derivative(expr, "x");
    } catch (e) {
      return { x: [], y: [] };
    }
    const xValues = generateXValues();
    const yValues = xValues.map((x) => {
      try {
        return derivative.evaluate({ x, ...variables });
      } catch (e) {
        return null;
      }
    });
    return { x: xValues, y: yValues };
  };

  const computeIntegralData = (equation) => {
    const expr = equation.replace(/^\s*y\s*=\s*/, "");
    const f = (x) => {
      try {
        return math.evaluate(expr, { x, ...variables });
      } catch (e) {
        return 0;
      }
    };
    const xValues = generateXValues();
    const yValues = [];
    let sum = 0;
    for (let i = 1; i < xValues.length; i++) {
      const dx = xValues[i] - xValues[i - 1];
      sum += ((f(xValues[i - 1]) || 0) + (f(xValues[i]) || 0)) * dx / 2;
      yValues.push(sum);
    }
    yValues.unshift(0);
    return { x: xValues, y: yValues };
  };

  const computeRoots = (equation) => {
    const expr = equation.replace(/^\s*y\s*=\s*/, "");
    const f = (x) => {
      try {
        return math.evaluate(expr, { x, ...variables });
      } catch (e) {
        return NaN;
      }
    };
    const xValues = generateXValues();
    const roots = [];
    for (let i = 1; i < xValues.length; i++) {
      const y1 = f(xValues[i - 1]);
      const y2 = f(xValues[i]);
      if (y1 * y2 < 0) {
        const root = xValues[i - 1] - y1 * (xValues[i] - xValues[i - 1]) / (y2 - y1);
        roots.push(root);
      }
    }
    return roots;
  };

  const computeAsymptotes = (equation) => {
    const expr = equation.replace(/^\s*y\s*=\s*/, "");
    const f = (x) => {
      try {
        return math.evaluate(expr, { x, ...variables });
      } catch (e) {
        return NaN;
      }
    };
    const xValues = generateXValues();
    const asymptotes = [];
    for (let i = 1; i < xValues.length; i++) {
      const y1 = f(xValues[i - 1]);
      const y2 = f(xValues[i]);
      if ((!isFinite(y1) || !isFinite(y2)) && isFinite(f((xValues[i - 1] + xValues[i]) / 2))) {
        const xAsym = (xValues[i - 1] + xValues[i]) / 2;
        asymptotes.push(xAsym);
      }
    }
    return asymptotes;
  };

  useEffect(() => {
    let customVars = { ...variables };
    let updated = false;
    equations.forEach((eq) => {
      try {
        const node = math.parse(eq);
        node.filter((n) => n.isSymbolNode).forEach((n) => {
          if (!["x", "y", "t", "θ", "theta"].includes(n.name) && customVars[n.name] === undefined) {
            customVars[n.name] = 1;
            updated = true;
          }
        });
      } catch (e) {}
    });
    if (updated) setVariables(customVars);
  }, [equations]);

  const getGraphData = () => {
    let data = [];
    equations.forEach((equation) => {
      const type = detectEquationType(equation);
      let trace = { name: equation, mode: "lines", type: "scatter" };
      if (type === "explicit") {
        trace = { ...trace, ...generateExplicitData(equation) };
        data.push(trace);
        if (advancedFeatures.showDerivative)
          data.push({
            x: computeDerivativeData(equation).x,
            y: computeDerivativeData(equation).y,
            mode: "lines",
            line: { dash: "dot" },
            name: `Derivative: ${equation}`,
          });
        if (advancedFeatures.showIntegral)
          data.push({
            x: computeIntegralData(equation).x,
            y: computeIntegralData(equation).y,
            mode: "lines",
            line: { dash: "dashdot" },
            name: `Integral: ${equation}`,
          });
        if (advancedFeatures.showRoots) {
          const roots = computeRoots(equation);
          data.push({
            x: roots,
            y: roots.map(() => 0),
            mode: "markers",
            marker: { color: "red", size: 8 },
            name: `Roots: ${equation}`,
          });
        }
      } else if (type === "implicit") {
        trace = { ...trace, ...generateImplicitData(equation) };
        data.push(trace);
      } else if (type === "parametric") {
        trace = { ...trace, ...generateParametricData(equation) };
        data.push(trace);
      } else if (type === "polar") {
        trace = { ...trace, ...generatePolarData(equation) };
        data.push(trace);
      }
    });
    return data;
  };

  const getLayout = () => {
    const layout = {
      title: "Advanced 2D Graphing Calculator",
      autosize: true,
      xaxis: {
        title: graphOptions.showAxisTitles ? "x" : "",
        type: graphOptions.xAxisScale,
        showgrid: graphOptions.showGrid,
        range: graphOptions.xRange,
      },
      yaxis: {
        title: graphOptions.showAxisTitles ? "y" : "",
        type: graphOptions.yAxisScale,
        showgrid: graphOptions.showGrid,
        range: graphOptions.yRange,
      },
      shapes: [],
    };
    if (advancedFeatures.showAsymptotes) {
      equations.forEach((equation) => {
        if (detectEquationType(equation) === "explicit") {
          const asymptotes = computeAsymptotes(equation);
          asymptotes.forEach((xAsym) => {
            layout.shapes.push({
              type: "line",
              x0: xAsym,
              x1: xAsym,
              y0: graphOptions.yRange[0],
              y1: graphOptions.yRange[1],
              line: { dash: "dot", width: 2, color: "gray" },
            });
          });
        }
      });
    }
    if (graphOptions.equalAspect) layout.aspectratio = { x: 1, y: 1 };
    return layout;
  };

  const handleInputChange = (e) => {
    setInputEquation(e.target.value);
    setError("");
  };

  const addEquation = () => {
    if (inputEquation.trim()) {
      setEquations([...equations, inputEquation]);
      setInputEquation("");
    } else {
      setError("Please enter a valid equation.");
    }
  };

  const removeEquation = (index) => {
    setEquations(equations.filter((_, i) => i !== index));
  };

  const toggleAdvancedFeature = (feature) => {
    setAdvancedFeatures({ ...advancedFeatures, [feature]: !advancedFeatures[feature] });
  };

  const updateGraphOption = (option, value) => {
    setGraphOptions({ ...graphOptions, [option]: value });
  };

  return (
    <div className="advanced-equation-visualizer">
      <h2>Advanced 2D Graphing Calculator</h2>
      {instructions}
      <div className="input-section">
        <textarea
          value={inputEquation}
          onChange={handleInputChange}
          placeholder="Enter your equation (e.g., y = x^2, x^2+y^2-16=0, x = cos(t), y = sin(t), or r = sin(θ))"
          rows={3}
          style={{ width: "100%", fontSize: "16px" }}
        />
        <button onClick={addEquation}>Add Equation</button>
        {error && <div className="error-message" style={{ color: "red" }}>{error}</div>}
      </div>
      {equations.length > 0 && (
        <div className="equation-list">
          <h3>Equations</h3>
          <ul>
            {equations.map((eq, index) => (
              <li key={index}>
                {eq} <button onClick={() => removeEquation(index)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="options-section">
        <h3>Graph Options</h3>
        <label>
          <input type="checkbox" checked={graphOptions.showGrid} onChange={() => updateGraphOption("showGrid", !graphOptions.showGrid)} />
          Show Grid
        </label>
        <label style={{ marginLeft: "20px" }}>
          <input type="checkbox" checked={graphOptions.showAxisTitles} onChange={() => updateGraphOption("showAxisTitles", !graphOptions.showAxisTitles)} />
          Show Axis Titles
        </label>
        <label style={{ marginLeft: "20px" }}>
          <input type="checkbox" checked={graphOptions.equalAspect} onChange={() => updateGraphOption("equalAspect", !graphOptions.equalAspect)} />
          Equal Aspect Ratio
        </label>
        <br />
        <label>
          X-Axis Scale:
          <select value={graphOptions.xAxisScale} onChange={(e) => updateGraphOption("xAxisScale", e.target.value)} style={{ marginLeft: "10px" }}>
            <option value="linear">Linear</option>
            <option value="log">Logarithmic</option>
          </select>
        </label>
        <label style={{ marginLeft: "20px" }}>
          Y-Axis Scale:
          <select value={graphOptions.yAxisScale} onChange={(e) => updateGraphOption("yAxisScale", e.target.value)} style={{ marginLeft: "10px" }}>
            <option value="linear">Linear</option>
            <option value="log">Logarithmic</option>
          </select>
        </label>
        <br />
        <label>
          X Range:
          <input
            type="number"
            value={graphOptions.xRange[0]}
            onChange={(e) => updateGraphOption("xRange", [parseFloat(e.target.value), graphOptions.xRange[1]])}
            style={{ width: "80px", marginLeft: "10px" }}
          />
          to
          <input
            type="number"
            value={graphOptions.xRange[1]}
            onChange={(e) => updateGraphOption("xRange", [graphOptions.xRange[0], parseFloat(e.target.value)])}
            style={{ width: "80px", marginLeft: "10px" }}
          />
        </label>
        <br />
        <label>
          Y Range:
          <input
            type="number"
            value={graphOptions.yRange[0]}
            onChange={(e) => updateGraphOption("yRange", [parseFloat(e.target.value), graphOptions.yRange[1]])}
            style={{ width: "80px", marginLeft: "10px" }}
          />
          to
          <input
            type="number"
            value={graphOptions.yRange[1]}
            onChange={(e) => updateGraphOption("yRange", [graphOptions.yRange[0], parseFloat(e.target.value)])}
            style={{ width: "80px", marginLeft: "10px" }}
          />
        </label>
      </div>
      <div className="advanced-features">
        <h3>Advanced Features</h3>
        <label>
          <input type="checkbox" checked={advancedFeatures.showDerivative} onChange={() => toggleAdvancedFeature("showDerivative")} />
          Show Derivative (Explicit equations only)
        </label>
        <br />
        <label>
          <input type="checkbox" checked={advancedFeatures.showIntegral} onChange={() => toggleAdvancedFeature("showIntegral")} />
          Show Integral (Explicit equations only)
        </label>
        <br />
        <label>
          <input type="checkbox" checked={advancedFeatures.showRoots} onChange={() => toggleAdvancedFeature("showRoots")} />
          Show Roots (Explicit equations only)
        </label>
        <br />
        <label>
          <input type="checkbox" checked={advancedFeatures.showAsymptotes} onChange={() => toggleAdvancedFeature("showAsymptotes")} />
          Show Asymptotes (Explicit equations only)
        </label>
      </div>
      <div className="variables-section">
        <h3>Variables (Interactive Sliders)</h3>
        {Object.keys(variables).length === 0 && (
          <p>No variables defined. Use custom variables in your equations (e.g., a, b) to generate sliders.</p>
        )}
        {Object.keys(variables).map((key) => (
          <div key={key}>
            <label>
              {key}:
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={variables[key]}
                onChange={(e) => setVariables({ ...variables, [key]: parseFloat(e.target.value) })}
              />
              {variables[key]}
            </label>
          </div>
        ))}
      </div>
      <div className="graph-section">
        <Plot
          data={getGraphData()}
          layout={getLayout()}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ["zoom2d", "pan2d"],
          }}
          style={{ width: "100%", height: "600px" }}
        />
      </div>
    </div>
  );
};

export default PlotGraph;
