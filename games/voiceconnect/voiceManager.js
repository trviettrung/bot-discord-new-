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

    const sub =
        interaction.options.getSubcommand();

    if (sub === "join") {

        const voiceChannel =
            getMemberVoiceChannel(interaction);

        if (!voiceChannel) {

            return interaction.reply({
                content:
                    "Bạn phải ở trong 1 voice để bot nhận diện.",
                ephemeral: true
            });
        }

        if (
            !botCanUseVoice(voiceChannel)
        ) {

            return interaction.reply({
                content:
                    "Bot thiếu quyền vào voice này.",
                ephemeral: true
            });
        }

        const session =
            sessions.get(interaction.guild.id);

        const connectedVoiceId =
            getConnectedVoiceChannelId(
                interaction.guild.id
            ) ||
            session?.voiceChannelId;

        if (
            connectedVoiceId &&
            connectedVoiceId === voiceChannel.id &&
            session?.joinOwnerId &&
            session.joinOwnerId !== interaction.user.id
        ) {

            return interaction.reply({
                content:
                    "Bot đang ở voice này rồi. Chỉ người đã thêm bot mới dùng được lệnh out.",
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {

            await connectToVoiceChannel(
                voiceChannel,
                interaction.user.id
            );

            return interaction.editReply(
                `Bot đã tham gia voice **${voiceChannel.name}**.`
            );

        } catch (error) {

            logVoiceConnectError(
                error
            );

            return interaction.editReply(
                getVoiceConnectErrorMessage(
                    error
                )
            );
        }
    }

    if (sub === "out") {

        const session =
            sessions.get(interaction.guild.id);

        const connectedVoiceId =
            getConnectedVoiceChannelId(
                interaction.guild.id
            ) ||
            session?.voiceChannelId;

        if (!connectedVoiceId) {

            return interaction.reply({
                content:
                    "Bot hiện không ở trong voice.",
                ephemeral: true
            });
        }

        if (
            session?.joinOwnerId &&
            session.joinOwnerId !== interaction.user.id
        ) {

            return interaction.reply({
                content:
                    "Chỉ người đã thêm bot vào voice mới có thể dùng lệnh này.",
                ephemeral: true
            });
        }

        disconnectSession(
            interaction.guild.id
        );

        return interaction.reply(
            "Bot đã rời voice."
        );
    }

    return interaction.reply({
        content:
            "Subcommand voiceconnect không hợp lệ.",
        ephemeral: true
    });
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

module.exports = {
    handleVoiceConnectInteraction,
    handleVoiceStateUpdate
};
