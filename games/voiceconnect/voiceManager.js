const {
    PermissionsBitField
} = require("discord.js");

const {
    joinVoiceChannel,
    getVoiceConnection,
    entersState,
    VoiceConnectionStatus
} = require("@discordjs/voice");

const sessions =
    new Map();

const watchedConnections =
    new WeakSet();

const READY_TIMEOUT_MS =
    15_000;

const RECONNECT_DELAY_MS =
    5_000;

function getMemberVoiceChannel(interaction) {

    return interaction.member
        ?.voice
        ?.channel || null;
}

function botCanUseVoice(channel) {

    const permissions =
        channel.permissionsFor(
            channel.guild.members.me
        );

    if (!permissions) return false;

    return permissions.has([
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.Connect
    ]);
}

function getConnectedVoiceChannelId(guildId) {

    const connection =
        getVoiceConnection(guildId);

    return connection
        ?.joinConfig
        ?.channelId || null;
}

function isAbortError(error) {

    return error?.code === "ABORT_ERR" ||
        error?.name === "AbortError" ||
        error?.cause?.code === "ABORT_ERR" ||
        error?.cause?.name === "AbortError";
}

function getVoiceConnectErrorMessage(error) {

    if (
        isAbortError(error)
    ) {

        return "Bot đã gửi yêu cầu vào voice nhưng Discord chưa xác nhận kịp. Nếu bot chưa vào, hãy thử lại `/voiceconnect join`.";
    }

    return "Bot chưa kết nối được vào voice. Kiểm tra quyền voice rồi thử lại.";
}

function logVoiceConnectError(error) {

    if (
        isAbortError(error)
    ) {

        console.warn(
            "Voice ready check aborted; keeping passive connection."
        );

        return;
    }

    const reason =
        error?.code ||
        error?.name ||
        error?.message ||
        "unknown";

    console.warn(
        `Voice connect failed: ${reason}`
    );
}

function destroyConnection(connection) {

    if (!connection) return;

    try {

        connection.destroy();

    } catch {

        // Connection may already be destroyed by Discord.
    }
}

function clearReconnectTimer(session) {

    if (!session?.reconnectTimer) return;

    clearTimeout(
        session.reconnectTimer
    );

    session.reconnectTimer =
        null;
}

async function getSessionChannel(session) {

    const cachedChannel =
        session.guild.channels.cache.get(
            session.voiceChannelId
        );

    if (cachedChannel) return cachedChannel;

    return session.guild.channels
        .fetch(session.voiceChannelId)
        .catch(() => null);
}

function watchConnection(
    connection,
    guildId
) {

    if (
        watchedConnections.has(connection)
    ) return;

    watchedConnections.add(
        connection
    );

    connection.on(
        "stateChange",
        (_oldState, newState) => {

            if (
                newState.status ===
                    VoiceConnectionStatus.Disconnected ||
                newState.status ===
                    VoiceConnectionStatus.Destroyed
            ) {

                scheduleReconnect(
                    guildId,
                    newState.status
                );
            }
        }
    );
}

async function waitUntilReady(connection) {

    try {

        await entersState(
            connection,
            VoiceConnectionStatus.Ready,
            READY_TIMEOUT_MS
        );

    } catch (error) {

        logVoiceConnectError(
            error
        );
    }
}

async function reconnectSession(guildId) {

    const session =
        sessions.get(guildId);

    if (!session) return;

    clearReconnectTimer(
        session
    );

    const channel =
        await getSessionChannel(
            session
        );

    if (
        !channel ||
        !channel.isVoiceBased?.() ||
        !botCanUseVoice(channel)
    ) {

        sessions.delete(guildId);

        return;
    }

    try {

        await connectToVoiceChannel(
            channel,
            session.joinOwnerId
        );

    } catch (error) {

        logVoiceConnectError(
            error
        );

        scheduleReconnect(
            guildId,
            "retry"
        );
    }
}

function scheduleReconnect(
    guildId,
    reason
) {

    const session =
        sessions.get(guildId);

    if (
        !session ||
        session.reconnectTimer
    ) return;

    console.warn(
        `Voice connection dropped (${reason}); reconnecting...`
    );

    session.reconnectTimer =
        setTimeout(
            () => {

                reconnectSession(
                    guildId
                ).catch(console.error);
            },
            RECONNECT_DELAY_MS
        );

    session.reconnectTimer.unref?.();
}

async function connectToVoiceChannel(
    channel,
    joinOwnerId
) {

    const guildId =
        channel.guild.id;

    const currentConnection =
        getVoiceConnection(guildId);

    const currentSession =
        sessions.get(guildId);

    const previousJoinOwnerId =
        currentSession?.joinOwnerId ||
        null;

    let connection;

    if (
        currentConnection &&
        currentConnection.state.status !==
            VoiceConnectionStatus.Destroyed &&
        currentConnection.state.status !==
            VoiceConnectionStatus.Disconnected &&
        currentConnection.joinConfig.channelId === channel.id
    ) {

        connection =
            currentConnection;

    } else {

        clearReconnectTimer(
            currentSession
        );

        sessions.delete(guildId);

        destroyConnection(
            currentConnection
        );

        connection =
            joinVoiceChannel({
                channelId:
                    channel.id,
                guildId:
                    guildId,
                adapterCreator:
                    channel.guild.voiceAdapterCreator,
                selfDeaf:
                    true,
                selfMute:
                    true
            });
    }

    sessions.set(
        guildId,
        {
            guild:
                channel.guild,
            connection,
            voiceChannelId:
                channel.id,
            joinOwnerId:
                joinOwnerId ||
                previousJoinOwnerId ||
                null,
            reconnectTimer:
                null
        }
    );

    watchConnection(
        connection,
        guildId
    );

    await waitUntilReady(
        connection
    );

    return connection;
}

function disconnectSession(guildId) {

    const session =
        sessions.get(guildId);

    sessions.delete(guildId);

    clearReconnectTimer(
        session
    );

    destroyConnection(
        session?.connection
    );

    destroyConnection(
        getVoiceConnection(guildId)
    );
}

async function handleVoiceConnectInteraction(interaction) {

    // 1. Không xử lý cùng 1 interaction nhiều lần
    if (!interaction || interaction._processing) return;
    interaction._processing = true;

    // 2. Defer ngay lập tức ở đầu hàm, không để bất kỳ tác vụ await nào chạy trước
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }
    } catch (deferErr) {
        // Nếu defer lỗi (ví dụ Unknown interaction 10062), thoát luôn
        return;
    }

    // Helper kiểm tra trạng thái interaction trước khi phản hồi
    const sendResponse = async (payload) => {
        try {
            const content = typeof payload === "string" ? { content: payload } : payload;
            if (interaction.deferred) {
                return await interaction.editReply(content);
            } else if (interaction.replied) {
                return await interaction.followUp(content);
            } else {
                return await interaction.reply(content);
            }
        } catch (replyErr) {
            if (replyErr?.code === 10062 || replyErr?.code === 40060 || replyErr?.code === 10008) {
                // Nếu tin nhắn tạm bị xóa (10008), thử gửi tin nhắn mới qua channel/followUp
                if (replyErr?.code === 10008) {
                    try {
                        return await interaction.followUp(content);
                    } catch {
                        // Bỏ qua nếu followUp cũng không gửi được
                    }
                }
                return;
            }
            console.error("Lỗi khi phản hồi interaction:", replyErr);
        }
    };

    // 3. Bao toàn bộ hàm trong try...catch
    try {

        const sub =
            interaction.options.getSubcommand();

        if (sub === "join") {

            const voiceChannel =
                getMemberVoiceChannel(interaction);

            if (!voiceChannel) {
                return await sendResponse("Bạn phải ở trong 1 voice để bot nhận diện.");
            }

            if (!botCanUseVoice(voiceChannel)) {
                return await sendResponse("Bot thiếu quyền vào voice này.");
            }

            const session =
                sessions.get(interaction.guild.id);

            const connectedVoiceId =
                getConnectedVoiceChannelId(interaction.guild.id) ||
                session?.voiceChannelId;

            if (
                connectedVoiceId &&
                connectedVoiceId === voiceChannel.id &&
                session?.joinOwnerId &&
                session.joinOwnerId !== interaction.user.id
            ) {
                return await sendResponse("Bot đang ở voice này rồi. Chỉ người đã thêm bot mới dùng được lệnh out.");
            }

            await connectToVoiceChannel(
                voiceChannel,
                interaction.user.id
            );

            return await sendResponse(`Bot đã tham gia voice **${voiceChannel.name}**.`);
        }

        if (sub === "out") {

            const session =
                sessions.get(interaction.guild.id);

            const connectedVoiceId =
                getConnectedVoiceChannelId(interaction.guild.id) ||
                session?.voiceChannelId;

            if (!connectedVoiceId) {
                return await sendResponse("Bot hiện không ở trong voice.");
            }

            if (
                session?.joinOwnerId &&
                session.joinOwnerId !== interaction.user.id
            ) {
                return await sendResponse("Chỉ người đã thêm bot vào voice mới có thể dùng lệnh này.");
            }

            disconnectSession(interaction.guild.id);

            return await sendResponse("Bot đã rời voice.");
        }

        return await sendResponse("Subcommand voiceconnect không hợp lệ.");

    } catch (error) {

        logVoiceConnectError(error);

        return await sendResponse(getVoiceConnectErrorMessage(error));
    }
}

async function handleVoiceStateUpdate(
    oldState,
    newState,
    client
) {

    const guild =
        newState.guild || oldState.guild;

    if (!guild) return;

    if (
        oldState.id === client.user.id &&
        oldState.channelId &&
        !newState.channelId
    ) {

        scheduleReconnect(
            guild.id,
            "voice state left"
        );
    }

    if (
        newState.id === client.user.id &&
        newState.channelId
    ) {

        const session =
            sessions.get(guild.id);

        if (session) {

            session.voiceChannelId =
                newState.channelId;
        }
    }
}

async function handleVoiceMessageCommand(message) {
    const content = message.content.trim();
    const parts = content.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const sub = (parts[1] || "").toLowerCase();

    let action = null;
    if (cmd === "?join" || cmd === "#join") {
        action = "join";
    } else if (cmd === "?out" || cmd === "?leave" || cmd === "#out" || cmd === "#leave") {
        action = "out";
    } else if (cmd === "?voice" || cmd === "?voiceconnect" || cmd === "#voice" || cmd === "#voiceconnect") {
        if (sub === "join") action = "join";
        else if (sub === "out" || sub === "leave") action = "out";
        else action = "help";
    } else if (cmd === "?help" || cmd === "#help") {
        action = "help";
    } else {
        return false;
    }

    if (action === "help") {
        return message.reply(
            "**Lệnh Voice:**\n" +
            "• `?join` (hoặc `/voiceconnect join`): Cho bot tham gia voice của bạn\n" +
            "• `?out` (hoặc `/voiceconnect out`): Cho bot rời voice (người thêm bot hoặc Quản lý server)"
        );
    }

    if (action === "join") {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return message.reply("Bạn phải ở trong 1 kênh voice để bot nhận diện.");
        }

        if (!botCanUseVoice(voiceChannel)) {
            return message.reply("Bot thiếu quyền vào kênh voice này.");
        }

        const session = sessions.get(message.guild.id);
        const connectedVoiceId = getConnectedVoiceChannelId(message.guild.id) || session?.voiceChannelId;

        if (
            connectedVoiceId &&
            connectedVoiceId === voiceChannel.id &&
            session?.joinOwnerId &&
            session.joinOwnerId !== message.author.id
        ) {
            return message.reply("Bot đang ở voice này rồi. Chỉ người đã thêm bot mới dùng được lệnh out.");
        }

        try {
            await connectToVoiceChannel(voiceChannel, message.author.id);
            return message.reply(`Bot đã tham gia voice **${voiceChannel.name}**.`);
        } catch (error) {
            logVoiceConnectError(error);
            return message.reply(getVoiceConnectErrorMessage(error));
        }
    }

    if (action === "out") {
        const session = sessions.get(message.guild.id);
        const connectedVoiceId = getConnectedVoiceChannelId(message.guild.id) || session?.voiceChannelId;

        if (!connectedVoiceId) {
            return message.reply("Bot hiện không ở trong voice.");
        }

        const isOwner = session?.joinOwnerId === message.author.id;
        const canManage = message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
        if (!isOwner && !canManage && message.author.id !== "772059345990189066") {
            return message.reply("Chỉ người đã thêm bot vào voice (hoặc Quản lý máy chủ) mới có thể dùng lệnh này.");
        }

        disconnectSession(message.guild.id);
        return message.reply("Bot đã rời voice.");
    }

    return true;
}

module.exports = {
    handleVoiceConnectInteraction,
    handleVoiceStateUpdate,
    handleVoiceMessageCommand
};
