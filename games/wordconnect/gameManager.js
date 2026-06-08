const fs = require("fs");
const path = require("path");

const dataDir = path.join(
    __dirname,
    "..",
    "..",
    "data"
);

const gamesFile = path.join(
    dataDir,
    "wordconnect-games.json"
);

const games = loadGames();

function normalizeGuildId(guildId) {

    return String(guildId || "");
}

function loadGames() {

    try {

        if (
            !fs.existsSync(gamesFile)
        ) return new Map();

        const data =
            JSON.parse(
                fs.readFileSync(
                    gamesFile,
                    "utf8"
                )
            );

        return new Map(
            Object.entries(data)
        );

    } catch (err) {

        console.error(
            "Không đọc được file lưu ván wordconnect:",
            err
        );

        return new Map();
    }
}

function saveGames() {

    fs.mkdirSync(
        dataDir,
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        gamesFile,
        JSON.stringify(
            Object.fromEntries(games),
            null,
            4
        )
    );
}

function createGame(
    guildId,
    data
) {

    const key =
        normalizeGuildId(guildId);

    if (!key) return;

    games.set(
        key,
        {
            ...data,
            guildId:
                key
        }
    );

    saveGames();
}

function getGame(guildId) {

    return games.get(
        normalizeGuildId(guildId)
    );
}

function saveGame(guildId) {

    if (
        games.has(
            normalizeGuildId(guildId)
        )
    ) {

        saveGames();
    }
}

function deleteGame(guildId) {

    const deleted =
        games.delete(
            normalizeGuildId(guildId)
        );

    if (deleted) {

        saveGames();
    }
}

module.exports = {
    createGame,
    getGame,
    saveGame,
    deleteGame
};
