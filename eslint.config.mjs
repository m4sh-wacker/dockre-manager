import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react/no-unescaped-entities": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    
    // General JavaScript rules
    "no-unused-vars": "off",
    "no-console": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "upload/**"]
}];

export default eslintConfig;
