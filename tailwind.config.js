// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      height: { logo: '4rem' },
      width:  { logo: 'auto' },
    },
  },
  // bez sekcji plugins
};
