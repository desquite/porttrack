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
  ]),
  {
    rules: {
      // App 100 % en français : les apostrophes dans le texte JSX sont
      // innombrables et parfaitement valides au rendu. Cette règle générait
      // ~40 faux positifs et se redéclencherait à chaque nouvelle chaîne FR.
      "react/no-unescaped-entities": "off",
      // Pattern volontaire dans nos filtres / combobox : resynchroniser un état
      // local (champ de recherche) depuis l'URL, ou le réinitialiser à
      // l'ouverture. Bénin ici ; la règle (react-hooks v6) est trop stricte pour
      // ce cas précis. À réactiver si on refactore ces composants.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
