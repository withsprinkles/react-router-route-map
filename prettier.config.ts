import type { Config } from "prettier";

export default {
    plugins: ["prettier-plugin-pkg", "prettier-plugin-toml"],

    printWidth: 100,
    tabWidth: 4,
    arrowParens: "avoid",

    // MARK: Defaults
    // useTabs: false,
    // semi: true,
    // singleQuote: false,
    // trailingComma: "all",
    // proseWrap: "preserve",
} satisfies Config;
