/**
 * Resolve `relative` under `root`. Returns null when the path escapes the root
 * (absolute paths, `..` segments, etc.).
 */
import path from "node:path";

export const resolveInside = (root, relative) => {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolved;
};
