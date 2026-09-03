import { cpSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = join(projectRoot, "node_modules");
const outputRoot = join(projectRoot, ".turso-deps", "node_modules");

const seeds = ["@libsql/client", "@prisma/adapter-libsql", "dotenv"];

function packageDir(name: string): string {
  if (name.startsWith("@")) {
    const [scope, pkg] = name.split("/");
    return join(nodeModules, scope, pkg);
  }
  return join(nodeModules, name);
}

function collect(name: string, seen: Set<string>) {
  if (seen.has(name)) return;

  const dir = packageDir(name);
  const manifest = join(dir, "package.json");
  if (!existsSync(manifest)) return;

  seen.add(name);
  const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };

  for (const dep of Object.keys({
    ...pkg.dependencies,
    ...pkg.optionalDependencies,
  })) {
    collect(dep, seen);
  }
}

function copyPackage(name: string) {
  const src = packageDir(name);
  const dest = name.startsWith("@")
    ? join(outputRoot, ...name.split("/"))
    : join(outputRoot, name);

  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

const packages = new Set<string>();
for (const seed of seeds) {
  collect(seed, packages);
}

mkdirSync(outputRoot, { recursive: true });
for (const name of [...packages].sort()) {
  copyPackage(name);
}

console.log(`Collected ${packages.size} Turso runtime packages.`);
