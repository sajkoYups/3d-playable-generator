/**
 * Bundles each engine the way the exporter does and prints the size split.
 *
 * Run after touching the runtime or an engine: a tree-shaking regression shows
 * up here as three.js jumping by a hundred kilobytes, long before anyone
 * notices a network rejecting the build.
 */
import path from "path";
import * as esbuild from "esbuild";

const ENGINES = {
  "stack-tower": ["./engines/stack-tower", "createStackTowerEngine"],
  "triple-match": ["./engines/triple-match", "createTripleMatchEngine"],
  "lane-runner": ["./engines/lane-runner", "createLaneRunnerEngine"],
  "parking-jam": ["./engines/parking-jam", "createParkingJamEngine"],
};

const runtimeDir = path.join(process.cwd(), "src", "playable-runtime");

for (const [id, [module, factory]] of Object.entries(ENGINES)) {
  const entry = `
import { createPlayable } from "./runtime";
import { createNetworkAdapter } from "./networks/adapters";
import { ${factory} } from "${module}";
var config = window.__PLAYABLE_CONFIG__;
createPlayable({
  container: document.getElementById("playable-root"),
  data: config.data,
  templateId: config.templateId,
  engine: ${factory},
  assets: config.assets,
  network: createNetworkAdapter(config.network)
});
`;

  try {
    const result = await esbuild.build({
      stdin: {
        contents: entry,
        resolveDir: runtimeDir,
        sourcefile: "export-entry.js",
        loader: "js",
      },
      bundle: true,
      minify: true,
      format: "iife",
      target: ["es2020"],
      platform: "browser",
      absWorkingDir: process.cwd(),
      write: false,
      metafile: true,
      legalComments: "none",
      define: { "process.env.NODE_ENV": '"production"' },
    });

    const totals = { three: 0, engine: 0, runtime: 0, other: 0 };
    for (const output of Object.values(result.metafile.outputs)) {
      for (const [file, info] of Object.entries(output.inputs)) {
        if (file.includes("node_modules/three")) totals.three += info.bytesInOutput;
        else if (file.includes("playable-runtime/engines"))
          totals.engine += info.bytesInOutput;
        else if (file.includes("playable-runtime"))
          totals.runtime += info.bytesInOutput;
        else totals.other += info.bytesInOutput;
      }
    }

    const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
    const total = result.outputFiles[0].text.length;
    console.log(
      `${id.padEnd(14)} total ${kb(total).padStart(9)}  ` +
        `three ${kb(totals.three).padStart(9)}  ` +
        `engine ${kb(totals.engine).padStart(8)}  ` +
        `runtime ${kb(totals.runtime).padStart(8)}  ` +
        `other ${kb(totals.other).padStart(8)}`,
    );
  } catch (error) {
    console.log(`${id.padEnd(14)} FAILED  ${error.message.split("\n")[0]}`);
  }
}
