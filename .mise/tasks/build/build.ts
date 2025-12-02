import { Glob } from "bun";
import { dts } from "./dts.plugin.ts";

export async function build() {
    const glob = new Glob("**/*.ts");
    const files = await Array.fromAsync(glob.scan("src"));
    const entrypoints = files.map(file => `src/${file}`);

    await Bun.build({
        entrypoints,
        outdir: "dist",
        format: "esm",
        sourcemap: "external",
        target: "node",
        root: "src",
        packages: "external",
        plugins: [dts()],
    });
}
