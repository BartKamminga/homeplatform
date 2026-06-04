// landing/vite.config.js
import { createConfig } from "../../vite.base.js";
const isProd = process.env.NODE_ENV === "production";
export default createConfig("landing", 5172, {
  base: isProd ? "/landing/" : "/",
});
