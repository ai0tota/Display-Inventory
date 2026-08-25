/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Chrome — jaan boojh kar neutral. Rang sirf data ke liye bachaya hai.
        // Dark surface (#0B1030) par light-on-dark remap: har purana
        // text-ink-45 / border-line apne aap palat jaata hai.
        ink:   { DEFAULT: '#FFFFFF',
                 70: 'rgba(255,255,255,.86)',  // body text, labels
                 45: 'rgba(255,255,255,.68)',  // captions, codes, hints
                 20: 'rgba(255,255,255,.42)' }, // disabled only
        line:  { DEFAULT: 'rgba(255,255,255,.12)', strong: 'rgba(255,255,255,.24)' },
        paper: { DEFAULT: '#0B1030', raised: 'rgba(255,255,255,.06)',
                 sunk: 'rgba(255,255,255,.10)' },

        // Pigment palette — har status ka apna rang, dhande ki bhasha me
        neel:   '#2E4EA8', // indigo — primary action
        gulal:  '#D1345B', // missing
        haldi:  '#E8A317', // short
        mehndi: '#4C7A3F', // ok
        kesar:  '#C25A1F', // excess
        raakh:  '#8C8898', // extra / inactive
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.14em' }],
      },
      borderRadius: { card: '10px' },
      boxShadow: {
        card: '0 1px 2px rgba(20,18,26,.05), 0 1px 12px rgba(20,18,26,.04)',
        pop:  '0 12px 40px rgba(20,18,26,.16)',
      },
    },
  },
  plugins: [],
}
