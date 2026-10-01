/**
 * Reset stale VS Code workspace state.
 *
 * VS Code keeps deleted files in its workspace `state.vscdb`
 * (recently-opened editors + hot-exit buffers). When a file is deleted while
 * its tab is open, the editor keeps showing phantom diagnostics for it even
 * though nothing on disk references it.
 *
 * This removes the cached state for THIS workspace only, so it reopens clean.
 *
 *   npm run reset:editor
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WORKSPACE_MARKER = path
  .resolve(".")
  .replace(/\\/g, "/")
  .replace(/\/$/, "")
  .toLowerCase();

function storageRoots(): string[] {
  const home = homedir();
  const appData =
    process.env.APPDATA ?? path.join(home, ".config");
  return [
    path.join(appData, "Code", "User", "workspaceStorage"),
    path.join(appData, "Code - Insiders", "User", "workspaceStorage"),
    path.join(appData, "VSCodium", "User", "workspaceStorage"),
    path.join(home, ".vscode-server", "data", "User", "workspaceStorage"),
  ];
}

/** VS Code stores the folder as a percent-encoded `file://` URI, so it must
 * be decoded before it can be compared with a filesystem path. */
function normalisePath(value: string): string {
  let decoded = value;
  if (decoded.startsWith("file://")) {
    try {
      decoded = fileURLToPath(decoded);
    } catch {
      decoded = decodeURIComponent(decoded.replace(/^file:\/\//, ""));
    }
  }
  return decoded.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}

function isWorkspaceDir(dir: string): boolean {
  const marker = path.join(dir, "workspace.json");
  if (!existsSync(marker)) return false;
  try {
    const raw = readFileSync(marker, "utf8");
    const folder = JSON.parse(raw)?.folder ?? "";
    return normalisePath(String(folder)) === WORKSPACE_MARKER;
  } catch {
    return false;
  }
}

function main() {
  console.log("\nFillMate - reset editor workspace state\n" + "=".repeat(52));

  const roots = storageRoots().filter((r) => existsSync(r));
  if (roots.length === 0) {
    console.log("\n  No VS Code workspace storage found. Nothing to do.\n");
    return;
  }

  let removed = 0;
  const staleDirs: string[] = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      if (!isWorkspaceDir(dir)) continue;

      const db = path.join(dir, "state.vscdb");
      if (!existsSync(db)) continue;

      // VS Code holds an exclusive lock on state.vscdb while it runs, so a
      // failed read still means "stale state we could not verify".
      let mentionsStale = false;
      let readable = true;
      for (const encoding of ["latin1", "utf8"] as const) {
        try {
          const raw = readFileSync(db, encoding);
          mentionsStale = /lib[/\\]utils[/\\]time-extra\.ts/.test(raw);
          break;
        } catch {
          readable = false;
        }
      }
      if (!readable) {
        staleDirs.push(dir);
        console.log(`  locked by a running editor: ${entry.name}`);
        continue;
      }
      if (!mentionsStale) {
        console.log(`  workspace storage is clean, left untouched: ${entry.name}`);
        continue;
      }

      try {
        rmSync(dir, { recursive: true, force: true });
        removed++;
        console.log(`  removed stale state: ${entry.name}`);
      } catch (err) {
        staleDirs.push(dir);
        console.log(
          `  could not remove ${entry.name}: ${(err as Error).message}`,
        );
      }
    }
  }

  console.log("=".repeat(52));
  if (removed === 0 && staleDirs.length > 0) {
    console.log("\n  Stale state is still cached for this workspace in:");
    for (const d of staleDirs) console.log(`    ${d}`);
    console.log("\n  Quit VS Code completely (File > Exit, all windows), then run:");
    console.log("    npm run reset:editor");
    console.log("\n  Or delete the folder(s) above by hand.");
  }
  if (removed > 0) {
    console.log("\n  Removed cached editor state for this workspace.");
    console.log("  Reload VS Code (Ctrl+Shift+P > Developer: Reload Window).");
    console.log("  The phantom time-extra.ts diagnostics will be gone.\n");
  } else if (staleDirs.length === 0) {
    console.log("\n  Nothing stale found - workspace state is already clean.\n");
  }
}

main();