import { resolve, relative } from "path";

// The directory where the CLI was invoked becomes the immutable root.
export const ROOT_DIR = resolve(process.cwd());

/**
 * Resolves a user-supplied path, always treating it as relative to ROOT_DIR first.
 * Absolute paths (e.g. "/src/index.ts") are stripped of their leading slash and
 * resolved from ROOT_DIR, so the agent cannot escape the sandbox.
 * Throws if the resolved path would still escape the root (e.g. "../../etc").
 */
export function safePath(input: string): string {
  // Strip leading slashes so absolute paths are forced to be ROOT-relative
  const normalized = input.replace(/^\/+/, "");
  const abs = resolve(ROOT_DIR, normalized);
  const rel = relative(ROOT_DIR, abs);

  // relative() returns paths starting with ".." when escaping the root
  if (rel.startsWith("..") || rel === "..") {
    throw new Error(
      `상위 디렉토리는 접근할 수 없습니다(${input}, ${ROOT_DIR})`,
    );
  }
  return abs;
}

export function rootDescription(): string {
  return ROOT_DIR;
}
