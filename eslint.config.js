import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

export default tseslint.config(
  // 全局忽略
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/pack/**", "**/backup/**", "**/*.cjs", "**/*.min.js", "pnpm-lock.yaml"],
  },

  // JS 推荐基础规则
  js.configs.recommended,

  // TypeScript 推荐规则（覆盖所有 TS/TSX/Vue 文件）
  ...tseslint.configs.recommended,

  // TypeScript 文件中禁用 no-undef（TypeScript 本身已校验）
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
    rules: {
      "no-undef": "off",
    },
  },

  // Vue 3 文件配置（web 前端）
  {
    files: ["packages/web/src/**/*.vue", "packages/web/src/**/*.ts"],
    extends: [...pluginVue.configs["flat/recommended"]],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      // 允许单词组件名称（项目中存在）
      "vue/multi-word-component-names": "off",
      // 放宽 prop 类型要求（TypeScript 类型已有保障）
      "vue/require-default-prop": "off",
      // 允许 v-html（项目内部使用）
      "vue/no-v-html": "warn",
      // 不限制每行属性数量
      "vue/max-attributes-per-line": "off",
      // 不强制属性顺序
      "vue/attributes-order": "off",
      // 不强制属性名连字符
      "vue/attribute-hyphenation": "off",
      // 不强制闭合括号换行
      "vue/html-closing-bracket-newline": "off",
      // 不强制自闭合标签
      "vue/html-self-closing": "off",
      // 不强制单行元素内容换行
      "vue/singleline-html-element-content-newline": "off",
      // 不强制多行元素内容换行
      "vue/multiline-html-element-content-newline": "off",
    },
  },

  // Node.js 后端和脚本
  {
    files: ["packages/app/src/**/*.ts", "packages/app/scripts/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Electron/Node 脚本允许 require()
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // 通用 TypeScript 规则调整
  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      //允许单行控制
      "no-useless-assignment": "off",
      "no-debugger": "off",
      // 允许 any
      "@typescript-eslint/no-explicit-any": "off",
      // 允许非空断言
      "@typescript-eslint/no-non-null-assertion": "off",
      // 允许空函数
      "@typescript-eslint/no-empty-function": "warn",
      // 未使用变量以 _ 开头可忽略
      "@typescript-eslint/no-unused-vars": [
        "off",
        {
          args: "none", // 完全不检查未使用的参数
          varsIgnorePattern: "^_", // 变量仍然检查，_ 开头可忽略
        },
      ],
    },
  },
);
