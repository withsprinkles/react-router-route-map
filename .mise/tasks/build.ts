#!/usr/bin/env bun
//MISE description="Build the library"
//MISE outputs=["dist"]
//MISE depends=["check"]

import { rm } from "node:fs/promises";
import { build } from "./build/build.ts";

await rm("dist", { recursive: true, force: true });
await build();
