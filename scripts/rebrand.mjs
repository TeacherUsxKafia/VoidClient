// Applies branding.json to the project. Safe to run as often as you like.
//
//   1. edit branding.json (name, exeName, developer)
//   2. run:  bun run rebrand        (or:  node scripts/rebrand.mjs)
//
// It rewrites the name in: src/constants.rs, src/modules/nvidia.rs, build.rs, resources/version_resource.rs (the developer
// shown in the exe's properties), resources/installer_script.wxs, Cargo.toml (the exe name), package.json. The JS bundle reads branding.json by itself when it is built.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, text) => fs.writeFileSync(path.join(root, file), text);

const branding = JSON.parse(read("branding.json"));
const { name, exeName, developer } = branding;

// the values end up inside Rust string literals and file names, so keep them boring
const problems = [];
if (typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,29}$/.test(name)) problems.push('"name": letters, numbers, spaces, - and _ only (max 30 characters, must start with a letter or number)');
if (typeof exeName !== "string" || !/^[a-z0-9][a-z0-9_-]{0,29}$/.test(exeName)) problems.push('"exeName": lowercase letters, numbers, - and _ only, no spaces and no ".exe" (example: "myclient")');
if (typeof developer !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/.test(developer)) problems.push('"developer": letters, numbers, spaces, . - and _ only (max 40 characters)');
if (problems.length){
    console.error("branding.json has a problem:\n - " + problems.join("\n - "));
    process.exit(1);
}
const folder = name.replace(/ /g, "");   // the Documents folder: no spaces, easier to type

/**
 * @param {string} file
 * @param {Array<[RegExp, string]>} rules each regex must match exactly once
 */
function patch(file, rules){
    let text = read(file);
    for (const [regex, replacement] of rules){
        const matches = text.match(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`)) ?? [];
        if (matches.length !== 1){
            console.error(`${file}: expected 1 match for ${regex}, found ${matches.length}. The file was changed by hand? Nothing written for this file.`);
            process.exitCode = 1;
            return;
        }
        text = text.replace(regex, () => replacement);
    }
    write(file, text);
    console.log(`updated ${file}`);
}

patch("src/constants.rs", [
    [/^pub const CLIENT_NAME: &str = ".*";$/m, `pub const CLIENT_NAME: &str = "${name}";`],
    [/^pub const CLIENT_FOLDER: &str = ".*";$/m, `pub const CLIENT_FOLDER: &str = "${folder}";`],
]);

patch("src/modules/nvidia.rs", [
    [/^const PROFILE_NAME: &str = ".*";$/m, `const PROFILE_NAME: &str = "${name}";`],
    [/^const APP_NAME: &str = ".*";$/m, `const APP_NAME: &str = "${exeName}.exe";`],
    [/application\.user_friendly_name = unicode\(".*"\);/, `application.user_friendly_name = unicode("${name}");`],
]);

patch("resources/version_resource.rs", [
    [/^const COMPANY: &str = ".*";$/m, `const COMPANY: &str = "${developer}";`],
]);

patch("resources/installer_script.wxs", [
    [/Manufacturer="[^"]*"/, `Manufacturer="${developer}"`],
    [/Name="[^"]*" Manufacturer/, `Name="${name}" Manufacturer`],
]);

patch("build.rs", [
    [/embed_version_resource\(package_version, ".*", description, ".*", VFT_APP\);/, `embed_version_resource(package_version, "${name}", description, "${exeName}.exe", VFT_APP);`],
]);

// the exe file name is the Cargo package name (no [[bin]] block, that gave a duplicate name error).
// Cargo.lock names the root package too, so both are changed together
{
    const file = "Cargo.toml";
    let text = read(file);
    const oldName = text.match(/^\[package\]\r?\nname = "([^"]+)"/m)?.[1];
    if (!oldName){
        console.error(`${file}: could not find the [package] name. Nothing written for this file.`);
        process.exitCode = 1;
    }
    else {
        text = text.replace(/^(\[package\]\r?\nname = )"[^"]+"/m, (_, start) => `${start}"${exeName}"`);
        text = text.replace(/^description = ".*"$/m, `description = "${name}, a lightweight Krunker client"`);
        text = text.replace(/^authors = \[.*\]$/m, `authors = ["${developer}"]`);
        write(file, text);
        console.log(`updated ${file}`);

        if (oldName !== exeName){
            const lock = read("Cargo.lock");
            const entry = new RegExp(`^name = "${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"$`, "gm");
            const count = (lock.match(entry) ?? []).length;
            if (count !== 1){
                console.error(`Cargo.lock: expected 1 package called "${oldName}", found ${count}. Cargo.lock was not changed, cargo will fix it on the next build.`);
            }
            else {
                write("Cargo.lock", lock.replace(entry, () => `name = "${exeName}"`));
                console.log("updated Cargo.lock");
            }
        }
    }
}

{
    const file = "package.json";
    const pkg = JSON.parse(read(file));
    pkg.name = exeName;
    pkg.description = `${name}, a lightweight Krunker client`;
    pkg.author = developer;
    for (const [key, value] of Object.entries(pkg.scripts)) pkg.scripts[key] = value.replace(/\.\/target\/release\/[a-z0-9_-]+\.exe/g, `./target/release/${exeName}.exe`);
    write(file, `${JSON.stringify(pkg, null, 4)}\n`);
    console.log(`updated ${file}`);
}

console.log(`\nDone. Client name: ${name} | exe: ${exeName}.exe | data folder: Documents\\${folder}`);
console.log("Now build again (see README).");
