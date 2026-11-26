// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Export del handoff de diseño (referencia, no código de la app: no se
    // importa ni se deploya). Lintearlo sólo ensuciaba `npm run lint`.
    // (Un "#" inicial en un glob es comentario: se matchea la carpeta interna.)
    "**/design_handoff_metricas/**",
  ]),
]);

export default eslintConfig;
