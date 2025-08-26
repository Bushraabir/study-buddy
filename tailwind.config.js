/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: '#1a1a1a',
                premiumLight: '#e4e4e7',
                bluePurple: '#5A67D8',
                hoverBlue: '#434190',
                shadowLight: 'rgba(0, 0, 0, 0.1)',
                hoverDark: '#222222',
                cardBackground: '#2d2d2d',
                inputFocusBorder: '#5A67D8',
            },
            fontFamily: {
                handwritten: ['Dancing Script', 'cursive'],
                body: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                light: '0 4px 8px rgba(0, 0, 0, 0.1)',
                elegant: '0 4px 6px rgba(0, 0, 0, 0.1)',
            },
            spacing: {
                20: '20px',
                12: '12px',
                24: '24px',
                10: '10px',
                8: '8px',
                1: '1px',
            },
            borderRadius: {
                '8': '8px',
                '10': '10px',
            },
        },
    },
    plugins: [],
}
