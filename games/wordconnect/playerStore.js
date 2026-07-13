const fs = require("fs");
const path = require("path");

const rootDir = path.join(
    __dirname,
    "..",
    ".."
);

const playersDir = path.join(
    rootDir,
    "data",
    "wordconnect-players"
);

const HINT_TOP_LIMIT = 100;
const configuredHintCooldownSeconds =
    Number.parseInt(
        process.env.WORDCONNECT_HINT_COOLDOWN_SECONDS ||
        "60",
        10
    );
const HINT_COOLDOWN_SECONDS =
    Number.isFinite(configuredHintCooldownSeconds) &&
    configuredHintCooldownSeconds > 0
        ? configuredHintCooldownSeconds
        : 60;

const guildCache = new Map();

function getGuildFile(guildId) {

    return path.join(
        playersDir,
        `${guildId}.json`
    );
}

function createGuildData() {

    return {
        players: {}
    };
}

function loadGuildData(guildId) {

    if (
        guildCache.has(guildId)
    ) {

        return guildCache.get(guildId);
    }

    const file =
        getGuildFile(guildId);

    try {

        if (
            !fs.existsSync(file)
        ) {

            const data =
                createGuildData();

            guildCache.set(
                guildId,
                data
            );

            return data;
        }

        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );

        if (
            !data.players ||
            typeof data.players !== "object"
        ) {

            data.players = {};
        }

        guildCache.set(
            guildId,
            data
        );

        return data;

    } catch (err) {

        console.error(
            "Không đọc được dữ liệu người chơi:",
            err
        );

        const data =
            createGuildData();

        guildCache.set(
            guildId,
            data
        );

        return data;
    }
}

const saveTimeouts = new Map();
const isSavingGuild = new Map();
const needsSaveGuild = new Map();

async function executeSaveGuild(guildId) {

    if (isSavingGuild.get(guildId)) return;
    isSavingGuild.set(guildId, true);
    needsSaveGuild.set(guildId, false);

    try {
        await fs.promises.mkdir(playersDir, { recursive: true });
        const data = loadGuildData(guildId);
        await fs.promises.writeFile(
            getGuildFile(guildId),
            JSON.stringify(data, null, 4),
            "utf8"
        );
    } catch (err) {
        console.error(`Lỗi ghi data guild ${guildId}:`, err);
    } finally {
        isSavingGuild.set(guildId, false);
        if (needsSaveGuild.get(guildId)) {
            saveGuildData(guildId);
        }
    }
}

function saveGuildData(guildId) {

    needsSaveGuild.set(guildId, true);
    if (isSavingGuild.get(guildId)) return;

    if (saveTimeouts.has(guildId)) {
        clearTimeout(saveTimeouts.get(guildId));
    }

    saveTimeouts.set(
        guildId,
        setTimeout(() => executeSaveGuild(guildId), 1000)
    );
}

function getUserId(user) {

    return typeof user === "string"
        ? user
        : user.id;
}

function getDisplayName(user) {

    if (
        typeof user === "string"
    ) return null;

    return (
        user.globalName ||
        user.username ||
        null
    );
}

function ensurePlayer(
    guildId,
    user
) {

    const data =
        loadGuildData(guildId);

    const userId =
        getUserId(user);

    if (
        !data.players[userId]
    ) {

        data.players[userId] = {
            score: 0,
            correctWords: 0,
            deadWins: 0,
            repeatWords: 0,
            consecutiveTurns: 0,
            unknownWords: 0,
            hintsUsed: 0,
            lastHintAt: 0,
            updatedAt: null
        };
    }

    const displayName =
        getDisplayName(user);

    if (displayName) {

        data.players[userId].displayName =
            displayName;
    }

    return data.players[userId];
}

function getWordPoints(nextWordCount) {

    return Math.max(
        12 - nextWordCount,
        2
    );
}

function addScore(
    guildId,
    user,
    amount,
    reason
) {

    const player =
        ensurePlayer(
            guildId,
            user
        );

    player.score =
        (player.score || 0) +
        amount;

    player.updatedAt =
        new Date().toISOString();

    if (
        reason === "correct_word"
    ) {

        player.correctWords =
            (player.correctWords || 0) +
            1;
    }

    if (
        reason === "dead_win"
    ) {

        player.deadWins =
            (player.deadWins || 0) +
            1;
    }

    if (
        reason === "repeat_word"
    ) {

        player.repeatWords =
            (player.repeatWords || 0) +
            1;
    }

    if (
        reason === "consecutive_turn"
    ) {

        player.consecutiveTurns =
            (player.consecutiveTurns || 0) +
            1;
    }

    if (
        reason === "unknown_word"
    ) {

        player.unknownWords =
            (player.unknownWords || 0) +
            1;
    }

    saveGuildData(guildId);

    return {
        score:
            player.score,
        delta:
            amount,
        player
    };
}

function getLeaderboard(
    guildId,
    limit = HINT_TOP_LIMIT
) {

    const data =
        loadGuildData(guildId);

    return Object
        .entries(data.players)
        .filter(([, player]) =>
            (player.score || 0) > 0
        )
        .sort(([, left], [, right]) =>
            (right.score || 0) -
            (left.score || 0)
        )
        .slice(0, limit)
        .map(([userId, player], index) => ({
            userId,
            rank:
                index + 1,
            ...player
        }));
}

function getRank(
    guildId,
    userId
) {

    return getLeaderboard(
        guildId,
        Number.MAX_SAFE_INTEGER
    ).find(player =>
        player.userId === userId
    ) || null;
}

function isTopPlayer(
    guildId,
    userId
) {

    const rank =
        getRank(
            guildId,
            userId
        );

    return Boolean(
        rank &&
        rank.rank <= HINT_TOP_LIMIT
    );
}

function getHintStatus(
    guildId,
    user
) {

    const userId =
        getUserId(user);

    const topPlayer =
        isTopPlayer(
            guildId,
            userId
        );

    if (topPlayer) {

        return {
            canUse: true,
            topPlayer,
            remainingSeconds: 0
        };
    }

    const player =
        ensurePlayer(
            guildId,
            user
        );

    const lastHintAt =
        player.lastHintAt || 0;

    const elapsedSeconds =
        Math.floor(
            (
                Date.now() -
                lastHintAt
            ) / 1000
        );

    const remainingSeconds =
        Math.max(
            HINT_COOLDOWN_SECONDS -
            elapsedSeconds,
            0
        );

    return {
        canUse:
            remainingSeconds <= 0,
        topPlayer,
        remainingSeconds
    };
}

function recordHint(
    guildId,
    user
) {

    const player =
        ensurePlayer(
            guildId,
            user
        );

    player.hintsUsed =
        (player.hintsUsed || 0) +
        1;

    player.lastHintAt =
        Date.now();

    player.updatedAt =
        new Date().toISOString();

    saveGuildData(guildId);

    return player;
}

module.exports = {
    HINT_COOLDOWN_SECONDS,
    HINT_TOP_LIMIT,
    getWordPoints,
    addScore,
    getLeaderboard,
    getHintStatus,
    recordHint
};
