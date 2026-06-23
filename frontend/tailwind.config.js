/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#0d1117',
          subtle:  '#161b22',
          inset:   '#010409',
        },
        border: {
          DEFAULT: '#30363d',
          muted:   '#21262d',
        },
        fg: {
          DEFAULT: '#e6edf3',
          muted:   '#8b949e',
          subtle:  '#6e7681',
        },
        accent: {
          DEFAULT: '#58a6ff',
          muted:   '#388bfd26',
        },
        success: '#3fb950',
        danger:  '#f85149',
        warning: '#d29922',
      },
    },
  },
  plugins: [],
}
