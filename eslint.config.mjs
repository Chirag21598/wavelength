import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This app intentionally uses the standard "fetch on mount, poll on an
      // interval" effect pattern throughout (real-time location + now-playing
      // polling). react-hooks 7's brand-new set-state-in-effect rule flags
      // that idiom broadly; downgraded to a warning rather than rearchitecting
      // well-understood data-fetching effects around a rule still this new.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
