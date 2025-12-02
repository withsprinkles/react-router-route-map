import path from "node:path";
import type { BunPlugin, PluginBuilder } from "bun";
import { spawn, which } from "bun";
import { getTsconfig } from "get-tsconfig";

export interface DtsOptions {
    /**
     * Path to the tsgo binary.
     * Defaults to whatever Bun.which("tsgo") finds, or "tsgo" if not found.
     */
    tsgoPath?: string;

    /**
     * Optional override for the tsconfig path.
     * If omitted, getTsconfig() is used.
     */
    project?: string;

    /**
     * Where to put .d.ts files. Defaults to build.config.outdir or "dist".
     */
    outDir?: string;

    /**
     * Extra CLI flags to pass to tsgo.
     */
    extraArgs?: string[];
}

export function dts(options: DtsOptions = {}): BunPlugin {
    return {
        name: "dts-tsgo",

        async setup(build: PluginBuilder) {
            const tsconfig = options.project != null ? getTsconfig(options.project) : getTsconfig();

            if (!tsconfig) {
                console.warn("No tsconfig.json found; skipping dts generation");
                return;
            }

            const projectPath = tsconfig.path;
            const outDir =
                options.outDir ?? build.config.outdir ?? path.join(process.cwd(), "dist");

            // Try to find tsgo on PATH; fall back to literal "tsgo"
            const tsgo = options.tsgoPath ?? which("tsgo") ?? "tsgo";

            console.info(
                "[dts] Generating .d.ts with tsgo",
                "\n  tsconfig:",
                projectPath,
                "\n  outDir:  ",
                outDir,
            );

            const proc = spawn({
                cmd: [
                    tsgo,
                    "--project",
                    projectPath,
                    "--emitDeclarationOnly",
                    "--declaration",
                    "--outDir",
                    outDir,
                    "--declarationMap",
                    ...(options.extraArgs ?? []),
                ],
                stdout: "inherit",
                stderr: "inherit",
            });

            const exitCode = await proc.exited;

            if (exitCode !== 0) {
                throw new Error(`[dts] tsgo exited with code ${exitCode}. See logs above.`);
            }

            console.log("[dts] Declaration emit complete");
        },
    };
}
