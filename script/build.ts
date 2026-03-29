import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// esbuild plugin: intercept relative imports that resolve to dev-only modules
// (e.g. ./vite -> server/vite.ts -> vite.config.ts -> @tanstack/react-query client graph)
// These are dead code in production (guarded by NODE_ENV check) but esbuild
// still resolves dynamic imports before tree-shaking, pulling in the full client bundle.
const excludeDevModulesPlugin = {
  name: "exclude-dev-modules",
  setup(build: any) {
    // Match any import path that ends with /vite or is exactly ./vite
    build.onResolve({ filter: /(\/vite|vite\.config)/ }, (args: any) => {
      // Only externalize relative imports (local files), not the 'vite' npm package
      // which is already in externals via the deps list
      if (args.path.startsWith(".") || args.path.includes("vite.config")) {
        return { path: args.path, external: true };
      }
    });
  },
};

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    plugins: [excludeDevModulesPlugin],
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
