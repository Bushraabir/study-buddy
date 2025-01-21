import React from 'react';
import './Keyboard.css'; // Optional: External CSS for the keyboard layout

const Keyboard = ({ onKeyPress }) => {
  // Define the keys for the advanced keyboard
  const keyRows = [
    ['sin', 'cos', 'tan', 'log', 'sqrt', 'pi', 'e'],
    ['x', 'y', 'z', '(', ')', '^', '+', '-'],
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['exp', 'ln', 'sqrt', 'integral', 'sum', '(', ')', '='],
    ['alpha', 'beta', 'gamma', 'delta', 'lambda', 'theta'],
  ];

  // Handle button clicks
  const handleButtonClick = (symbol) => {
    onKeyPress(symbol);
  };

  return (
    <div className="keyboard-container">
      {keyRows.map((row, index) => (
        <div key={index} className="keyboard-row">
          {row.map((key, idx) => (
            <button
              key={idx}
              className="keyboard-key"
              onClick={() => handleButtonClick(key)}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Keyboard;
