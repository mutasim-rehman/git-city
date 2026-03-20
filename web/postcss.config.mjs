const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Limit Tailwind's class-candidate scanning to source code.
      // This prevents binaries in `public/` (e.g. `.glb`) from producing corrupted
      // "arbitrary property" utilities that break CSS parsing.
      base: "src",
    },
  },
};

export default config;
