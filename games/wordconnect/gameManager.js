const fs = require("fs");
const path = require("path");

const dataDir = path.join(
    __dirname,
    "..",
    "..",
    "data"
);

const channelsFile = path.join(
    dataDir,
    "wordconnect-channels.json"
);

const gamesFile = path.join(
    dataDir,
    "wordconnect-games.json"
);

const games = loadGames();
const channels = loadChannels();

function normalizeGuildId(guildId) {

    return String(guildId || "");
}

function loadChannels() {

    try {

        if (
            !fs.existsSync(channelsFile)
        ) return {};

        return JSON.parse(
            fs.readFileSync(
                channelsFile,
                "utf8"
            )
        );

    } catch (err) {

        console.error(
            "Không đọc được file lưu kênh wordconnect:",
            err
        );

        return {};
    }
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

function saveChannels() {

    fs.mkdirSync(
        dataDir,
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        channelsFile,
        JSON.stringify(
            channels,
            null,
            4
        )
    );
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

function setChannel(
    guildId,
    channelId
) {

    channels[normalizeGuildId(guildId)] = channelId;

    saveChannels();
}

function getChannel(guildId) {

    return channels[normalizeGuildId(guildId)];
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
    setChannel,
    getChannel,
    createGame,
    getGame,
    saveGame,
    deleteGame
};
