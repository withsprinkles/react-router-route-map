#!/usr/bin/env bun
//MISE description="Run the development bundler"

import { watch } from "node:fs/promises";
import { pipe } from "iter-ops";
import { build } from "./build/build.ts";
import { merge } from "./build/merge.ts";

console.log("[dev] watching...");

await build();

const src = watch("src", { recursive: true });
const buildSrc = watch(".mise/tasks/build", { recursive: true });

const watcher = pipe(src, merge(buildSrc));

for await (let event of watcher) {
    if (event.eventType === "change" || event.eventType === "rename") {
        console.log(`[dev] detected ${event.eventType} in ${event.filename}`);
        await build();
    }
}
