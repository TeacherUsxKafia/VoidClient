// Makes the zip you give to players: target/<exeName>-x86_64-portable.zip
// Run after the release build:  bun run portable
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const branding = JSON.parse(fs.readFileSync(new URL("./branding.json", import.meta.url), "utf8"));
const exe = branding.exeName;
const folder = String(branding.name).replace(/ /g, "");

const releaseDir = path.join(process.cwd(), "target", "release");
const stageDir = path.join(process.cwd(), "target", "portable");
const appDir = path.join(stageDir, folder);
const zipPath = path.join(process.cwd(), "target", `${exe}-x86_64-portable.zip`);

try {
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });

    fs.cpSync(path.join(releaseDir, "dist"), appDir, { recursive: true });
    fs.copyFileSync(path.join(releaseDir, `${exe}.exe`), path.join(appDir, `${exe}.exe`));
    // the .pdb only helps debugging, so it is optional
    if (fs.existsSync(path.join(releaseDir, `${exe}.pdb`))) fs.copyFileSync(path.join(releaseDir, `${exe}.pdb`), path.join(appDir, `${exe}.pdb`));
    // must match constants::PORTABLE_MARKER, the exe then never tries to run an installer
    fs.writeFileSync(path.join(appDir, "portable.flag"), "");

    // windows' own bsdtar, git's gnu tar earlier in PATH can't write zip
    const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    const result = spawnSync(tar, ["-a", "-c", "-f", zipPath, "-C", stageDir, folder], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`tar exited with ${result.status ?? result.error}`);

    console.log(`Wrote ${zipPath}`);
}
catch (error){
    console.error("cannot build the portable zip", error);
    process.exitCode = 1;
}
