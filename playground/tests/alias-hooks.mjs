import { fileURLToPath, pathToFileURL } from "node:url";
const shared = fileURLToPath(new URL("../../shared/", import.meta.url));
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@shared/")) return next(pathToFileURL(shared + specifier.slice("@shared/".length)).href, context);
  return next(specifier, context);
}
