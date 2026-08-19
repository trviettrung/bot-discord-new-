const {
    normalizeWord,
    isKnownWord,
    isDeadWord,
    isTwoWord,
    getRandomWord,
    getNextWords,
    checkConnect,
    saveKnownWord
} = require(
    "../games/wordconnect/wordGraph"
);

const fs = require("fs");
const path = require("path");

const {
    getGame,
    saveGame,
    startGame,
    stopGame
} = require(
    "../games/wordconnect/gameManager"
);

const {
    handleVoiceMessageCommand
} = require(
    "../games/voiceconnect/voiceManager"
);

const { PermissionsBitField } = require("discord.js");

const ADMIN_ID = "772059345990189066";
const lastHintMap = new Map();

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

    try {
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
    } catch (err) {
        console.error(err);
    }
}

function getHintWord(game) {

    const recentWords =
        new Set(
            (game.usedWords || [])
                .slice(-20)
        );

    const nextWords =
        getNextWords(game.currentWord)
            .filter(word =>
                !recentWords.has(word)
            );

    const safeWords =
        nextWords.filter(word =>
            !isDeadWord(word)
        );

    const pool =
        safeWords.length > 0
            ? safeWords
            : nextWords;

    if (
        pool.length === 0
    ) return null;

    const index =
        Math.floor(
            Math.random() *
            pool.length
        );

    return pool[index];
}

function getHelpMessage() {

    return [
        "**Danh sách lệnh Bot**",
        "",
        "🎤 **Lệnh Voice (Dùng tiền tố `#`)**",
        "• `#join` (hoặc `#voiceconnect join`): Cho bot tham gia voice của bạn.",
        "• `#out` (hoặc `#voiceconnect out`): Cho bot rời voice.",
        "",
        "🔤 **Lệnh Nối Từ (Dùng tiền tố `!`)**",
        "• `!start` (hoặc `!wordconnect start`): Bắt đầu ván nối từ tại kênh hiện tại.",
        "• `!end` (hoặc `!wordconnect end`): Kết thúc ván nối từ hiện tại.",
        "• `!hint` (hoặc `!wordconnect hint`): Nhận gợi ý từ nối tiếp.",
        "• `!add <từ>`: Thêm từ mới vào từ điển bot (chỉ chủ bot).",
        "• `!qrTrung`: Xem mã QR thanh toán của Trung.",
        "• `!help`: Xem bảng hướng dẫn này.",
        "",
        "📖 **Luật chơi nối từ:**",
        "1. Dùng tiếng cuối của từ trước để bắt đầu từ mới có 2 tiếng.",
        "2. Từ phải có nghĩa trong từ điển tiếng Việt.",
        "3. Không lặp lại từ đã dùng trong 20 lượt gần nhất.",
        "4. Không được tự nối 2 lần liên tiếp."
    ].join("\n");
}

module.exports = {

    name: "messageCreate",

    async execute(message) {

        /*
        ============================================================
        BỎ QUA TIN NHẮN TỪ BOT & TIN NHẮN NGOÀI SERVER
        ============================================================
        */
        if (message.author.bot)
            return;

        if (!message.guild)
            return;

        const rawContent =
            message.content.trim();

        if (!rawContent)
            return;

        /*
        ============================================================
        1. XỬ LÝ LỆNH VOICE (TIỀN TỐ #)
        ============================================================
        */
        if (rawContent.startsWith("#")) {

            const handled =
                await handleVoiceMessageCommand(message);

            if (handled)
                return;
        }

        /*
        ============================================================
        2. XỬ LÝ LỆNH NỐI TỪ & TIỆN ÍCH (TIỀN TỐ !)
        ============================================================
        */
        if (rawContent.startsWith("!")) {

            const parts =
                rawContent.split(/\s+/);

            const cmd =
                parts[0].toLowerCase();

            const sub =
                (parts[1] || "").toLowerCase();

            // Lệnh !qrTrung
            if (cmd === "!qrtrung") {

                const qrImagePath =
                    path.join(__dirname, "..", "assets", "qr_trung.jpg");

                if (fs.existsSync(qrImagePath)) {

                    return message.reply({
                        files: [qrImagePath]
                    }).catch(console.error);
                }

                return message.reply("Không tìm thấy file ảnh QR.");
            }

            // Lệnh !help / !dxhelp
            if (
                cmd === "!help" ||
                cmd === "!dxhelp" ||
                (cmd === "!noitu" && sub === "help") ||
                (cmd === "!wordconnect" && sub === "help")
            ) {

                return message.reply(
                    getHelpMessage()
                );
            }

            // Lệnh !start / !wordconnect start / !noitu start
            if (
                cmd === "!start" ||
                ((cmd === "!wordconnect" || cmd === "!noitu") && sub === "start")
            ) {

                const word =
                    getRandomWord();

                if (!word) {

                    return message.reply(
                        "Không thể bốc từ ngẫu nhiên vì từ điển nối từ đang trống."
                    );
                }

                startGame(
                    message.guild.id,
                    message.channel,
                    word
                );

                return message.channel.send(
                    `🎮 Game nối từ bắt đầu tại ${message.channel}. Từ hiện tại: **${word}**`
                );
            }

            // Lệnh !end / !stop / !wordconnect end / !noitu end
            if (
                cmd === "!end" ||
                cmd === "!stop" ||
                ((cmd === "!wordconnect" || cmd === "!noitu") && sub === "end")
            ) {

                const canManage =
                    message.member?.permissions?.has(
                        PermissionsBitField.Flags.ManageGuild
                    ) ||
                    message.author.id === ADMIN_ID;

                if (!canManage) {

                    return message.reply(
                        "Chỉ người có quyền Quản lý máy chủ mới dùng được lệnh này."
                    );
                }

                const hadGame =
                    stopGame(
                        message.guild.id
                    );

                return message.channel.send(
                    hadGame
                        ? "Đã kết thúc ván nối từ hiện tại."
                        : "Hiện không có ván nối từ nào đang chạy."
                );
            }

            // Lệnh !hint / !goiy / !wordconnect hint
            if (
                cmd === "!hint" ||
                cmd === "!goiy" ||
                ((cmd === "!wordconnect" || cmd === "!noitu") && sub === "hint")
            ) {

                const game =
                    getGame(
                        message.guild.id
                    );

                if (!game) {

                    return message.reply(
                        "Chưa có ván nối từ nào đang chạy. Hãy dùng `!start` để bắt đầu."
                    );
                }

                if (
                    game.channelId &&
                    message.channel.id !== game.channelId
                ) {

                    return message.reply(
                        `Ván hiện tại đang chơi ở <#${game.channelId}>.`
                    );
                }

                // Cooldown chống spam 5s
                const lastHint =
                    lastHintMap.get(message.author.id) || 0;

                const now =
                    Date.now();

                if (now - lastHint < 5000) {

                    const remain =
                        Math.ceil((5000 - (now - lastHint)) / 1000);

                    return message.reply(
                        `Vui lòng chờ ${remain} giây nữa để nhận gợi ý tiếp.`
                    );
                }

                lastHintMap.set(message.author.id, now);

                const hintWord =
                    getHintWord(game);

                if (!hintWord) {

                    return message.reply(
                        `Không tìm được gợi ý hợp lệ cho từ **${game.currentWord}**.`
                    );
                }

                return message.reply(
                    `💡 Gợi ý cho **${game.currentWord}**: **${hintWord}**`
                );
            }

            // Lệnh !add <từ> / !wordconnect add <từ>
            if (
                cmd === "!add" ||
                ((cmd === "!wordconnect" || cmd === "!noitu") && sub === "add")
            ) {

                if (
                    message.author.id !== ADMIN_ID
                ) {

                    return message.reply(
                        "Chỉ chủ bot mới dùng được lệnh này."
                    );
                }

                const wordToAdd = (
                    cmd === "!add"
                        ? parts.slice(1).join(" ")
                        : parts.slice(2).join(" ")
                ).trim();

                if (!wordToAdd) {

                    return message.reply(
                        "Vui lòng nhập từ 2 tiếng cần thêm. Ví dụ: `!add con mèo`"
                    );
                }

                const result =
                    saveKnownWord(wordToAdd);

                if (!result.ok) {

                    return message.reply(
                        "Từ cần thêm phải gồm đúng 2 âm tiết và chỉ chứa chữ cái tiếng Việt."
                    );
                }

                if (result.existed) {

                    return message.reply(
                        `Từ **${result.word}** đã có sẵn trong từ điển.`
                    );
                }

                return message.reply(
                    `Đã thêm **${result.word}** vào từ điển bot.`
                );
            }

            return;
        }

        /*
        ============================================================
        3. GAMEPLAY NỐI TỪ (KHÔNG TÍNH ĐIỂM)
        ============================================================
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

        const input =
            normalizeWord(
                message.content
            );

        if (!input)
            return;

        if (
            !isTwoWord(input)
        ) return;

        // Chặn cùng 1 người nối 2 lần liên tiếp
        if (
            game.lastPlayer ===
            message.author.id
        ) {

            return react(
                message,
                "⏰"
            );
        }

        // Kiểm tra lặp trong 20 từ gần nhất
        if (
            game.usedWords
                .slice(-20)
                .includes(input)
        ) {

            return message.channel.send(
                `Từ **${input}** đã lặp trong 20 từ gần đây.`
            );
        }

        // Kiểm tra từ điển
        if (
            !isKnownWord(input)
        ) {

            logRejectedWord(
                message,
                input,
                "not_in_dictionary"
            );

            return react(
                message,
                "❌"
            );
        }

        // Kiểm tra nối tiếng đầu
        if (
            !checkConnect(
                game.currentWord,
                input
            )
        ) {

            return react(
                message,
                "❌"
            );
        }

        // NỐI HỢP LỆ
        game.turnCount =
            (game.turnCount || 0) + 1;

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

        // Kiểm tra từ chốt hạ / từ bí
        if (
            isDeadWord(input)
        ) {

            const nextWord =
                getRandomWord();

            if (!nextWord) {

                saveGame(
                    message.guild.id
                );

                return message.channel.send(
                    `🏆 ${message.author} đã chiến thắng với từ chốt hạ: **${input}**!\nKhông thể bắt đầu vòng mới vì từ điển trống.`
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
                `🏆 ${message.author} đã chiến thắng với từ chốt hạ: **${input}**!\nVòng mới bắt đầu với từ: **${nextWord}**`
            );
        }

        saveGame(
            message.guild.id
        );

        return null;
    }
};
