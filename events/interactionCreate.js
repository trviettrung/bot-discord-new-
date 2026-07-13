const {
    PermissionFlagsBits
} = require("discord.js");

const {
    createGame,
    getGame,
    deleteGame
} = require(
    "../games/wordconnect/gameManager"
);

const {
    getRandomWord,
    getNextWords,
    isDeadWord,
    saveKnownWord
} = require(
    "../games/wordconnect/wordGraph"
);

const {
    getHintStatus,
    recordHint,
    HINT_COOLDOWN_SECONDS,
    HINT_TOP_LIMIT
} = require(
    "../games/wordconnect/playerStore"
);

const {
    handleVoiceConnectInteraction
} = require(
    "../games/voiceconnect/voiceManager"
);

const WORDCONNECT_ADD_ALLOWED_USER_IDS = new Set([
    "772059345990189066"
]);

function stopGame(guildId) {

    const oldGame =
        getGame(guildId);

    deleteGame(guildId);

    return Boolean(oldGame);
}

async function getPlayChannel(interaction) {

    const channel =
        await interaction.guild
            .channels
            .fetch(interaction.channel.id);

    if (
        !channel ||
        !channel.isTextBased()
    ) return null;

    return channel;
}

function startGame(
    guildId,
    channel,
    word
) {

    stopGame(guildId);

    const game = {
        channelId:
            channel.id,
        initialWord:
            word,
        currentWord:
            word,
        usedWords: [
            word
        ],
        lastPlayer:
            null,
        turnCount:
            0
    };

    createGame(
        guildId,
        game
    );

    return game;
}

function getHelpMessage() {

    return [
        "**Danh sách lệnh**",
        "",
        "`/wordconnect start`",
        "Bắt đầu ván tại kênh hiện tại bằng một từ ngẫu nhiên.",
        "",
        "`/wordconnect end`",
        "Kết thúc ván hiện tại.",
        "",
        "`/wordconnect hint`",
        `Gợi ý một từ nối tiếp. Người ngoài Top ${HINT_TOP_LIMIT} bị cooldown ${HINT_COOLDOWN_SECONDS} giây.`,
        "",
        "`/wordconnect add`",
        "Thêm từ mới vào từ điển bot. Chỉ chủ bot dùng được.",
        "",
        "`/voiceconnect join`",
        "Cho bot tham gia voice hiện tại của bạn.",
        "",
        "`/voiceconnect out`",
        "Cho bot rời voice. Chỉ người đã thêm bot mới dùng được.",
        "",
        "`/d-xhelp`",
        "Hiện danh sách lệnh và tác dụng.",
        "",
        "**Luật chơi nhanh**",
        "Người chơi sau dùng tiếng cuối của từ trước để bắt đầu một từ mới có 2 tiếng.",
        "Từ mới phải có nghĩa. Từ đã dùng trong 20 lượt gần nhất không được lặp lại.",
        "",
        "**Điểm số**",
        "Nối đúng: +2 đến +12 điểm theo độ khó của từ.",
        "Chốt hạ từ lượt nối thứ 3 trở đi: +20 điểm.",
        "Lặp từ: -1 điểm. Nối liên tiếp hoặc dùng từ ngoài từ điển: -2 điểm."
    ].join("\n");
}

function canManageServer(interaction) {

    return interaction.memberPermissions
        ?.has(
            PermissionFlagsBits.ManageGuild
        );
}

function formatSeconds(seconds) {

    if (
        seconds < 60
    ) return `${seconds} giây`;

    const minutes =
        Math.floor(seconds / 60);

    const rest =
        seconds % 60;

    if (
        rest === 0
    ) return `${minutes} phút`;

    return `${minutes} phút ${rest} giây`;
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

module.exports = {

    name: "interactionCreate",

    async execute(interaction) {

        if (
            !interaction.isChatInputCommand()
        ) return;

        if (
            interaction.commandName !==
            "wordconnect" &&
            interaction.commandName !==
            "voiceconnect" &&
            interaction.commandName !==
            "d-xhelp"
        ) {

            return;
        }

        try {

            if (
                interaction.commandName ===
                "d-xhelp"
            ) {

                return interaction.reply({
                    content:
                        getHelpMessage(),
                    ephemeral: true
                });
            }

            if (!interaction.guild) {

                return interaction.reply({
                    content:
                        "Lệnh này chỉ dùng được trong server.",
                    ephemeral: true
                });
            }

            if (
                interaction.commandName ===
                "voiceconnect"
            ) {

                return handleVoiceConnectInteraction(
                    interaction
                );
            }

            const sub =
                interaction.options.getSubcommand();

            if (sub === "add") {

                if (
                    !WORDCONNECT_ADD_ALLOWED_USER_IDS.has(
                        interaction.user.id
                    )
                ) {

                    return interaction.reply({
                        content:
                            "Chỉ chủ bot mới dùng được lệnh này.",
                        ephemeral: true
                    });
                }

                const word =
                    interaction.options.getString(
                        "word",
                        true
                    );

                const result =
                    saveKnownWord(word);

                if (
                    !result.ok
                ) {

                    return interaction.reply({
                        content:
                            "Từ cần thêm phải gồm đúng 2 âm tiết và chỉ chứa chữ cái tiếng Việt.",
                        ephemeral: true
                    });
                }

                if (
                    result.existed
                ) {

                    return interaction.reply({
                        content:
                            `Từ **${result.word}** đã có sẵn trong từ điển.`,
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        `Đã thêm **${result.word}** vào từ điển bot.`,
                    ephemeral: true
                });
            }

            if (sub === "start") {

                const word =
                    getRandomWord();

                if (!word) {

                    return interaction.reply({
                        content:
                            "Không thể bốc từ ngẫu nhiên vì từ điển nối từ đang trống.",
                        ephemeral: true
                    });
                }

                await interaction.deferReply();

                const channel =
                    await getPlayChannel(
                        interaction
                    );

                if (!channel) {

                    return interaction.editReply({
                        content:
                            "Không tìm thấy kênh chơi hợp lệ."
                    });
                }

                startGame(
                    interaction.guild.id,
                    channel,
                    word
                );

                return interaction.editReply(
                    `Game bắt đầu tại ${channel}. Từ hiện tại: **${word}**`
                );
            }

            if (sub === "hint") {

                const game =
                    getGame(
                        interaction.guild.id
                    );

                if (!game) {

                    return interaction.reply({
                        content:
                            "Chưa có ván nối từ nào đang chạy.",
                        ephemeral: true
                    });
                }

                if (
                    game.channelId &&
                    interaction.channel.id !== game.channelId
                ) {

                    return interaction.reply({
                        content:
                            `Ván hiện tại đang chơi ở <#${game.channelId}>.`,
                        ephemeral: true
                    });
                }

                const hintWord =
                    getHintWord(game);

                if (!hintWord) {

                    return interaction.reply({
                        content:
                            `Không tìm được gợi ý hợp lệ cho từ **${game.currentWord}**.`,
                        ephemeral: true
                    });
                }

                const hintStatus =
                    getHintStatus(
                        interaction.guild.id,
                        interaction.user
                    );

                if (
                    !hintStatus.canUse
                ) {

                    return interaction.reply({
                        content:
                            `Bạn chưa nằm trong Top ${HINT_TOP_LIMIT}, hãy chờ ${formatSeconds(hintStatus.remainingSeconds)} nữa để dùng gợi ý.`,
                        ephemeral: true
                    });
                }

                recordHint(
                    interaction.guild.id,
                    interaction.user
                );

                return interaction.reply({
                    content:
                        `Gợi ý cho **${game.currentWord}**: **${hintWord}**`,
                    ephemeral: true
                });
            }

            if (sub === "end") {

                if (
                    !canManageServer(interaction)
                ) {

                    return interaction.reply({
                        content:
                            "Chỉ người có quyền Quản lý máy chủ mới dùng được lệnh này.",
                        ephemeral: true
                    });
                }

                const hadGame =
                    stopGame(
                        interaction.guild.id
                    );

                return interaction.reply(
                    hadGame
                        ? "Đã kết thúc ván nối từ hiện tại."
                        : "Hiện không có ván nối từ nào đang chạy."
                );
            }

            return interaction.reply({
                content:
                    "Subcommand không hợp lệ.",
                ephemeral: true
            });

        } catch (err) {

            console.error(err);

            const payload = {
                content:
                    "Bot bị lỗi khi xử lý lệnh.",
                ephemeral: true
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                return interaction.followUp(
                    payload
                );
            }

            return interaction.reply(
                payload
            );
        }
    }
};
