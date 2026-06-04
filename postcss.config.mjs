/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {}, // 👈 关键修改：使用了 v4 的专有插件包
    autoprefixer: {},
  },
};

export default config;