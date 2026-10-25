// Lets `node --test` resolve the "@shared/..." alias the Vite apps use.
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
