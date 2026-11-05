import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,   
  ...nextTs,  
  // Override default ignores of eslint-config-next.   
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",  
    "out/**",  
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // React Compiler-oriented rules; surfaced as warnings so they can be
    // worked through incrementally without changing component behavior.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
