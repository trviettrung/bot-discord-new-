const {
    existsSync
} = require("fs");

const path =
    require("path");

const {
    spawn
} = require("child_process");

const MIN_NODE_VERSION =
    [22, 12, 0];

function parseVersion(version) {

    return version
        .replace(/^v/, "")
        .split(".")
        .map(part => Number(part));
}

function isOlderThanMinVersion(version) {

    const parts =
        parseVersion(version);

    for (
        let index = 0;
        index < MIN_NODE_VERSION.length;
        index += 1
    ) {

        const current =
            parts[index] || 0;

        const minimum =
            MIN_NODE_VERSION[index];

        if (current < minimum) return true;
        if (current > minimum) return false;
    }

    return false;
}

function getLocalNodePath() {

    return path.join(
        __dirname,
        "node_modules",
        "node",
        "bin",
        process.platform === "win32"
            ? "node.exe"
            : "node"
    );
}

function runWithLocalNode() {

    const localNodePath =
        getLocalNodePath();

    if (
        !existsSync(localNodePath)
    ) {

        console.error(
            "Local Node 22 runtime is missing. Run npm install before starting the bot."
        );

        process.exit(1);
    }

    const child =
        spawn(
            localNodePath,
            [
                path.join(__dirname, "bot.js"),
                ...process.argv.slice(2)
            ],
            {
                stdio:
                    "inherit",
                env: {
                    ...process.env,
                    NOITU_LOCAL_NODE:
                        "1"
                }
            }
        );

    for (
        const signal of ["SIGINT", "SIGTERM"]
    ) {

        process.on(
            signal,
            () => {

                child.kill(signal);
            }
        );
    }

    child.on(
        "error",
        error => {

            console.error(error);
            process.exit(1);
        }
    );

    child.on(
        "exit",
        (code, signal) => {

            if (signal === "SIGINT") {

                process.exit(130);
            }

            if (signal === "SIGTERM") {

                process.exit(143);
            }

            process.exit(
                code ?? 1
            );
        }
    );
}

if (
    process.env.NOITU_LOCAL_NODE !== "1" &&
    isOlderThanMinVersion(process.version)
) {

    runWithLocalNode();

} else {

    require("./bot");
}
