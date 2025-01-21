import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import * as math from "mathjs";
import './PlotGraph.css';

const PlotGraph = () => {
  // State for user input equations
  const [equations, setEquations] = useState([]);
  const [parsedEquations, setParsedEquations] = useState([]);
  const [error, setError] = useState(null);

  // Graph options and styles
  const [graphOptions, setGraphOptions] = useState({
    grid: true,
    axisTitles: true,
    zoom: true,
    equalAspect: false,
    xAxisScale: "linear",
    yAxisScale: "linear",
    graphType: "lines",
  });

  // Advanced features toggle
  const [advancedFeatures, setAdvancedFeatures] = useState({
    showDerivative: false,
    showIntegral: false,
    findRoots: false,
    findAsymptotes: false,
  });

  const [inputEquation, setInputEquation] = useState("");
  const [variables, setVariables] = useState({}); // Dynamic variables for sliders

  // Instructions for users
  const instructions = (
    <p>
      <strong>Supported Equation Types:</strong>
      <ul>
        <li>Explicit: <code>y = f(x)</code></li>
        <li>Implicit: <code>x^2 + y^2 = r^2</code></li>
        <li>Parametric: <code>x = f(t), y = g(t)</code></li>
        <li>Polar: <code>r = f(θ)</code></li>
      </ul>
    </p>
  );

  // Parse equations on input or addition
  useEffect(() => {
    parseEquations();
  }, [equations]);

  const handleEquationChange = (e) => {
    setInputEquation(e.target.value);
    setError(null);
  };

  const addEquation = () => {
    if (inputEquation.trim()) {
      setEquations([...equations, inputEquation]);
      setInputEquation("");
    } else {
      setError("Please enter a valid equation.");
    }
  };

  const parseEquations = () => {
    try {
      const parsed = equations.map((eq) => math.parse(eq));
      setParsedEquations(parsed);
      setError(null);
    } catch (err) {
      setError("Invalid equation format. Ensure syntax is correct.");
    }
  };

  const generatePlotData = (equation) => {
    // Check for the type of equation
    if (equation.includes("=")) {
      // Handle implicit equations
      return generateImplicitData(equation);
    } else if (equation.includes("x") && equation.includes("y")) {
      // Handle explicit equations
      return generateExplicitData(equation);
    } else if (equation.includes("t") && equation.includes(",")) {
      // Handle parametric equations
      return generateParametricData(equation);
    } else if (equation.includes("θ") || equation.includes("r")) {
      // Handle polar equations
      return generatePolarData(equation);
    } else {
      setError("Unsupported equation format.");
      return { x: [], y: [] };
    }
  };

  const generateExplicitData = (equation) => {
    const xValues = Array.from({ length: 500 }, (_, i) => -10 + i * 0.04);
    const yValues = xValues.map((x) => {
      try {
        return math.evaluate(equation.replace("y =", "").trim(), { x });
      } catch {
        return null;
      }
    });
    return { x: xValues, y: yValues };
  };

  const generateImplicitData = (equation) => {
    const xValues = Array.from({ length: 100 }, (_, i) => -10 + i * 0.2);
    const yValues = Array.from({ length: 100 }, (_, i) => -10 + i * 0.2);
    const points = { x: [], y: [] };

    xValues.forEach((x) => {
      yValues.forEach((y) => {
        const result = math.evaluate(equation.replace("=", "-"), { x, y });
        if (Math.abs(result) < 0.1) {
          points.x.push(x);
          points.y.push(y);
        }
      });
    });

    return points;
  };

  const generateParametricData = (equation) => {
    const [xEq, yEq] = equation.split(",");
    const tValues = Array.from({ length: 500 }, (_, i) => -10 + i * 0.04);
    const xValues = tValues.map((t) => math.evaluate(xEq.replace("x =", "").trim(), { t }));
    const yValues = tValues.map((t) => math.evaluate(yEq.replace("y =", "").trim(), { t }));
    return { x: xValues, y: yValues };
  };

  const generatePolarData = (equation) => {
    const thetaValues = Array.from({ length: 500 }, (_, i) => (i * 2 * Math.PI) / 500);
    const rValues = thetaValues.map((theta) =>
      math.evaluate(equation.replace("r =", "").trim(), { θ: theta })
    );
    const xValues = rValues.map((r, i) => r * Math.cos(thetaValues[i]));
    const yValues = rValues.map((r, i) => r * Math.sin(thetaValues[i]));
    return { x: xValues, y: yValues };
  };

  const handleDerivative = (equation) => {
    const xValues = Array.from({ length: 500 }, (_, i) => -10 + i * 0.04);
    const derivative = math.derivative(equation.replace("y =", "").trim(), "x");
    const yValues = xValues.map((x) => derivative.evaluate({ x }));
    return { x: xValues, y: yValues };
  };

  const handleIntegral = (equation) => {
    const xValues = Array.from({ length: 500 }, (_, i) => -10 + i * 0.04);
    const integral = math.compile(`integrate(${equation.replace("y =", "").trim()}, x)`);
    const yValues = xValues.map((x) => integral.evaluate({ x }));
    return { x: xValues, y: yValues };
  };

  const findRoots = (equation) => {
    try {
      const compiled = math.compile(equation.replace("y =", "").trim());
      const xValues = Array.from({ length: 500 }, (_, i) => -10 + i * 0.04);
      return xValues.filter((x) => Math.abs(compiled.evaluate({ x })) < 0.1);
    } catch {
      return [];
    }
  };

  const findAsymptotes = (equation) => {
    const xValues = Array.from({ length: 500 }, (_, i) => -10 + i * 0.04);
    const yValues = xValues.map((x) => math.evaluate(equation.replace("y =", "").trim(), { x }));
    const asymptotes = xValues.filter((_, i) => !isFinite(yValues[i]));
    return asymptotes;
  };

  return (
    <div className="equation-visualizer">
      {instructions}

      {/* Input Section */}
      <div className="input-section" style={{ marginBottom: "20px" }}>
        <textarea
          value={inputEquation}
          onChange={handleEquationChange}
          placeholder="Enter your equation (e.g., y = x^2, or x^2 + y^2 = 16)"
          style={{
            width: "100%",
            height: "50px",
            fontSize: "16px",
            marginBottom: "10px",
          }}
        />
        <button
          onClick={addEquation}
          style={{
            padding: "10px",
            fontSize: "16px",
            marginRight: "10px",
          }}
        >
          Add Equation
        </button>
        {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
      </div>

      {/* Graph Options */}
      <div className="options-section" style={{ marginBottom: "20px" }}>
        <label>
          <input
            type="checkbox"
            checked={graphOptions.grid}
            onChange={() =>
              setGraphOptions({ ...graphOptions, grid: !graphOptions.grid })
            }
          />
          Show Grid
        </label>
        <label style={{ marginLeft: "20px" }}>
          <input
            type="checkbox"
            checked={graphOptions.axisTitles}
            onChange={() =>
              setGraphOptions({
                ...graphOptions,
                axisTitles: !graphOptions.axisTitles,
              })
            }
          />
          Show Axis Titles
        </label>
        <label style={{ marginLeft: "20px" }}>
          Equal Aspect Ratio
          <input
            type="checkbox"
            checked={graphOptions.equalAspect}
            onChange={() =>
              setGraphOptions({
                ...graphOptions,
                equalAspect: !graphOptions.equalAspect,
              })
            }
          />
        </label>
        <label style={{ marginLeft: "20px" }}>
          X-Axis Scale:
          <select
            value={graphOptions.xAxisScale}
            onChange={(e) =>
              setGraphOptions({ ...graphOptions, xAxisScale: e.target.value })
            }
          >
            <option value="linear">Linear</option>
            <option value="log">Logarithmic</option>
          </select>
        </label>
        <label style={{ marginLeft: "20px" }}>
          Y-Axis Scale:
          <select
            value={graphOptions.yAxisScale}
            onChange={(e) =>
              setGraphOptions({ ...graphOptions, yAxisScale: e.target.value })
            }
          >
            <option value="linear">Linear</option>
            <option value="log">Logarithmic</option>
          </select>
        </label>
      </div>

      {/* Sliders for Variables */}
      <div className="slider-section" style={{ marginBottom: "20px" }}>
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
                onChange={(e) =>
                  setVariables({ ...variables, [key]: parseFloat(e.target.value) })
                }
              />
              {variables[key]}
            </label>
          </div>
        ))}
      </div>

      {/* Graph Section */}
      <div className="graph-section">
        <Plot
          data={[
            ...equations.map((equation) => ({
              x: generatePlotData(equation).x,
              y: generatePlotData(equation).y,
              type: graphOptions.graphType,
              mode: "lines",
              name: equation,
            })),
            ...(advancedFeatures.showDerivative
              ? equations.map((equation) => ({
                  x: handleDerivative(equation).x,
                  y: handleDerivative(equation).y,
                  type: graphOptions.graphType,
                  line: { dash: "dot" },
                  name: `Derivative of ${equation}`,
                }))
              : []),
            ...(advancedFeatures.showIntegral
              ? equations.map((equation) => ({
                  x: handleIntegral(equation).x,
                  y: handleIntegral(equation).y,
                  type: graphOptions.graphType,
                  line: { dash: "dashdot" },
                  name: `Integral of ${equation}`,
                }))
              : []),
          ]}
          layout={{
            title: "Graphing Calculator",
            autosize: true,
            xaxis: {
              title: graphOptions.axisTitles ? "x" : "",
              type: graphOptions.xAxisScale,
              showgrid: graphOptions.grid,
            },
            yaxis: {
              title: graphOptions.axisTitles ? "y" : "",
              type: graphOptions.yAxisScale,
              showgrid: graphOptions.grid,
            },
            aspectratio: graphOptions.equalAspect ? { x: 1, y: 1 } : undefined,
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ["zoom2d", "pan2d"],
          }}
        />
      </div>
    </div>
  );
};

export default PlotGraph;
