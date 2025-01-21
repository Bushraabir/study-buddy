import { evaluate, parse } from 'mathjs';

// Parse the equation and return the evaluated result (or an error message)
export const parseEquation = (equation) => {
    try {
        // Use math.js to evaluate the equation
        const result = evaluate(equation);
        return result; // Return the result (can be used for display or further calculations)
    } catch (error) {
        console.error("Error parsing equation:", error);
        return null; // Return null if there's an error parsing
    }
};

// Validate if the equation is syntactically correct using math.js
export const isValidEquation = (equation) => {
    try {
        // Try to parse the equation
        parse(equation);
        return true; // Return true if valid
    } catch (error) {
        return false; // Return false if invalid
    }
};