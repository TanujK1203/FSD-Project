import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "storage/**", "next-env.d.ts"],
  },
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
