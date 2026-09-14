const {
    normalizeWord,
    isKnownWord,
    isDeadWord,
    isTwoWord,
    getRandomWord,
    getNextWords,
    getNextWordCount,
    checkConnect
} = require(
    "../games/wordconnect/wordGraph"
);

const fs = require("fs");
const path = require("path");

const {
    getGame,
    saveGame,
    deleteGame
} = require(
    "../games/wordconnect/gameManager"
);

const {
    getWordPoints,
    addScore
} = require(
    "../games/wordconnect/playerStore"
);

const {
    handleVoiceMessageCommand
} = require(
    "../games/voiceconnect/voiceManager"
);

const {
    PermissionFlagsBits
} = require("discord.js");

const OWNER_ID = "772059345990189066";

function react(
    message,
    emoji
) {

    return message
        .react(emoji)
        .catch(console.error);
}

const rejectedWordsFile = path.join(
    __dirname,
    "..",
    "data",
    "rejected-player-words.txt"
);

function logRejectedWord(
    message,
    word,
    reason
) {

    fs.mkdirSync(
        path.dirname(rejectedWordsFile),
        {
            recursive: true
        }
    );

    const line = [
        new Date().toISOString(),
        message.guild.id,
        message.channel.id,
        message.author.id,
        reason,
        word
    ].join("\t");

    fs.appendFile(
        rejectedWordsFile,
        `${line}\n`,
        "utf8",
        error => {
            if (error) console.error(error);
        }
    );
}

function rejectWord(
    message,
    word,
    reason,
    penalty = 0,
    scoreReason = null
) {

    logRejectedWord(
        message,
        word,
        reason
    );

    if (
        penalty !== 0
    ) {

        addScore(
            message.guild.id,
            message.author,
            penalty,
            scoreReason || reason
        );
    }

    return react(
        message,
        "❌"
    );
}

module.exports = {

    name: "messageCreate",

    async execute(message) {

        /*
        ========================
        IGNORE BOT
        ========================
        */

        if (message.author.bot)
            return;

        if (!message.guild)
            return;

        /*
        ========================
        VOICE COMMANDS (?join, ?out, etc.)
        ========================
        */
        const rawContent = message.content.trim();
        if (rawContent.startsWith("?") || rawContent.startsWith("#")) {
            const handled = await handleVoiceMessageCommand(message);
            if (handled) return;
        }

        /*
        ========================
        COMMAND: !qrTrung
        ========================
        */
        const contentTrimmed = rawContent.toLowerCase();
        if (contentTrimmed === "!qrtrung") {
            const qrImagePath = path.join(__dirname, "..", "assets", "qr_trung.jpg");
            if (fs.existsSync(qrImagePath)) {
                return message.reply({
                    files: [qrImagePath]
                }).catch(console.error);
            }
        }

        /*
        ========================
        OWNER SECRET / QUICK COMMANDS (!hint, !end, ?hint, ?end)
        ========================
        */
        const isOwner = message.author.id === OWNER_ID;

        if (isOwner && (contentTrimmed === "!hint" || contentTrimmed === "?hint")) {
            message.delete().catch(() => {});

            const game = getGame(message.guild.id);
            if (!game) {
                return message.author.send("Chưa có ván nối từ nào đang chạy trong server.").catch(() => {});
            }

            const recentWords = new Set((game.usedWords || []).slice(-20));
            const nextWords = getNextWords(game.currentWord).filter(word => !recentWords.has(word));
            const safeWords = nextWords.filter(word => !isDeadWord(word));
            const pool = safeWords.length > 0 ? safeWords : nextWords;
            const hintWord = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

            if (!hintWord) {
                return message.author.send(`Không tìm được gợi ý hợp lệ cho từ **${game.currentWord}**.`).catch(() => {});
            }

            return message.author.send(`💡 [Gợi ý bí mật] Từ hiện tại: **${game.currentWord}** ➔ Gợi ý: **${hintWord}**`).catch(async () => {
                const tempMsg = await message.channel.send(`💡 Gợi ý cho ${message.author}: **${hintWord}**`);
                setTimeout(() => tempMsg.delete().catch(() => {}), 6000);
            });
        }

        if (contentTrimmed === "!end" || contentTrimmed === "?end") {
            const canManage = message.member?.permissions?.has(PermissionFlagsBits?.ManageGuild || 32n);
            if (isOwner || canManage) {
                const hadGame = getGame(message.guild.id);
                if (hadGame) {
                    deleteGame(message.guild.id);
                    return message.reply("Đã kết thúc ván nối từ hiện tại.");
                } else {
                    return message.reply("Hiện không có ván nối từ nào đang chạy.");
                }
            }
        }

        /*
        ========================
        GET GAME
        ========================
        */

        const game =
            getGame(
                message.guild.id
            );

        if (!game)
            return;

        if (
            game.channelId &&
            message.channel.id !== game.channelId
        ) return;

        /*
        ========================
        INPUT
        ========================
        */

        const input =
            normalizeWord(
                message.content
            );

        if (!input)
            return;

        if (
            !isTwoWord(input)
        ) return;

        if (
            game.lastPlayer ===
            message.author.id
        ) {

            addScore(
                message.guild.id,
                message.author,
                -2,
                "consecutive_turn"
            );

            return react(
                message,
                "⏰"
            );
        }

        /*
        ========================
        CHECK RECENT WORDS
        ========================
        */

        if (
            game.usedWords
                .slice(-20)
                .includes(input)
        ) {

            const score =
                addScore(
                    message.guild.id,
                    message.author,
                    -1,
                    "repeat_word"
                );

            return message.channel.send(
                `Từ **${input}** đã lặp trong 20 từ gần đây. (-1 điểm, còn ${score.score} điểm)`
            );
        }

        /*
        ========================
        CHECK DICTIONARY
        ========================
        */

        if (
            !isKnownWord(input)
        ) {

            return rejectWord(
                message,
                input,
                "not_in_dictionary",
                -2,
                "unknown_word"
            );
        }

        /*
        ========================
        CHECK CONNECT
        ========================
        */

        if (
            !checkConnect(
                game.currentWord,
                input
            )
        ) {

            return rejectWord(
                message,
                input,
                "wrong_connect"
            );
        }

        /*
        ========================
        VALID
        ========================
        */

        const nextWordCount =
            getNextWordCount(input);

        const wordPoints =
            getWordPoints(nextWordCount);

        const score =
            addScore(
                message.guild.id,
                message.author,
                wordPoints,
                "correct_word"
            );

        game.turnCount =
            (
                Number.isInteger(game.turnCount)
                    ? game.turnCount
                    : Math.max(
                        game.usedWords.length - 1,
                        0
                    )
            ) + 1;

        game.currentWord = input;

        game.usedWords.push(input);

        if (
            game.usedWords.length > 20
        ) {

            game.usedWords.shift();
        }

        game.lastPlayer =
            message.author.id;

        await react(
            message,
            "✅"
        );

        if (
            isDeadWord(input)
        ) {

            let totalScore =
                score.score;

            let bonusText =
                "";

            if (
                game.turnCount >= 3
            ) {

                const bonus =
                    addScore(
                        message.guild.id,
                        message.author,
                        20,
                        "dead_win"
                    );

                totalScore =
                    bonus.score;

                bonusText =
                    " +20 điểm chốt hạ";
            }

            const nextWord =
                getRandomWord();

            if (!nextWord) {

                saveGame(
                    message.guild.id
                );

                return message.channel.send(
                    `🏆 ${message.author} đã thắng với từ **${input}**. (+${wordPoints} điểm${bonusText}, tổng ${totalScore} điểm)\nKhông thể bắt đầu vòng mới vì không có từ random.`
                );
            }

            game.currentWord =
                nextWord;

            game.usedWords = [
                nextWord
            ];

            game.lastPlayer =
                null;

            game.turnCount =
                0;

            saveGame(
                message.guild.id
            );

            return message.channel.send(
                `🏆 ${message.author} đã thắng với từ **${input}**! (+${wordPoints} điểm${bonusText}, tổng ${totalScore} điểm)\nVòng mới bắt đầu với từ: **${nextWord}**`
            );
        }

        saveGame(
            message.guild.id
        );

        return null;
    }
};
