const {
    Readable
} = require("stream");

const {
    PermissionsBitField
} = require("discord.js");

const {
    joinVoiceChannel,
    getVoiceConnection,
    entersState,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    StreamType,
    NoSubscriberBehavior,
    AudioPlayerStatus
} = require("@discordjs/voice");

const sessions =
    new Map();

const watchedConnections =
    new WeakSet();

const stoppedPlayers =
    new WeakSet();

const OPUS_SILENCE_FRAME =
    Buffer.from([0xf8, 0xff, 0xfe]);

const READY_TIMEOUT_MS =
    20_000;

const RECOVER_TIMEOUT_MS =
    5_000;

const RECONNECT_DELAY_MS =
    2_000;

class SilenceStream extends Readable {

    _read() {

        this.push(
            OPUS_SILENCE_FRAME
        );
    }
}

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

        return "Kết nối voice bị Discord hoặc host hủy giữa chừng. Bạn thử dùng lại `/voiceconnect join`.";
    }

    return "Bot chưa kết nối được vào voice. Kiểm tra quyền voice rồi thử lại.";
}

function logVoiceConnectError(error) {

    if (
        isAbortError(error)
    ) {

        console.warn(
            "Voice ready check aborted; keeping connection alive."
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

function createSilenceResource() {

    return createAudioResource(
        new SilenceStream(),
        {
            inputType:
                StreamType.Opus
        }
    );
}

function createKeepAlivePlayer(guildId) {

    const player =
        createAudioPlayer({
            behaviors: {
                noSubscriber:
                    NoSubscriberBehavior.Play
            }
        });

    player.on(
        AudioPlayerStatus.Idle,
        () => {

            if (
                stoppedPlayers.has(player)
            ) return;

            player.play(
                createSilenceResource()
            );
        }
    );

    player.on(
        "error",
        error => {

            const reason =
                error?.message ||
                error?.code ||
                "unknown";

            console.warn(
                `Voice keepalive failed (${guildId}): ${reason}`
            );

            if (
                stoppedPlayers.has(player)
            ) return;

            player.play(
                createSilenceResource()
            );
        }
    );

    player.play(
        createSilenceResource()
    );

    return player;
}

function ensurePlayerPlaying(player) {

    if (
        player.state.status ===
        AudioPlayerStatus.Idle
    ) {

        player.play(
            createSilenceResource()
        );
    }
}

function stopPlayer(player) {

    if (!player) return;

    stoppedPlayers.add(player);

    try {

        player.stop(true);

    } catch {

        // Player may already be stopped.
    }
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

    if (cachedChannel) {

        return cachedChannel;
    }

    return session.guild.channels
        .fetch(session.voiceChannelId)
        .catch(() => null);
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

        stopPlayer(
            session.player
        );

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
            "reconnect failed"
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
}

async function recoverDisconnectedConnection(
    connection,
    guildId
) {

    const session =
        sessions.get(guildId);

    if (
        !session ||
        session.connection !== connection ||
        session.recovering
    ) return;

    session.recovering =
        true;

    try {

        await Promise.race([
            entersState(
                connection,
                VoiceConnectionStatus.Signalling,
                RECOVER_TIMEOUT_MS
            ),
            entersState(
                connection,
                VoiceConnectionStatus.Connecting,
                RECOVER_TIMEOUT_MS
            )
        ]);

    } catch {

        const currentSession =
            sessions.get(guildId);

        if (
            currentSession?.connection ===
            connection
        ) {

            scheduleReconnect(
                guildId,
                "disconnected"
            );
        }

    } finally {

        const currentSession =
            sessions.get(guildId);

        if (
            currentSession?.connection ===
            connection
        ) {

            currentSession.recovering =
                false;
        }
    }
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
        (oldState, newState) => {

            if (
                newState.status ===
                VoiceConnectionStatus.Disconnected
            ) {

                recoverDisconnectedConnection(
                    connection,
                    guildId
                ).catch(console.error);
            }

            if (
                newState.status ===
                VoiceConnectionStatus.Destroyed
            ) {

                const session =
                    sessions.get(guildId);

                if (
                    session?.connection ===
                    connection
                ) {

                    scheduleReconnect(
                        guildId,
                        "destroyed"
                    );
                }
            }
        }
    );
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
    let player;

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

        player =
            currentSession?.player ||
            createKeepAlivePlayer(guildId);

    } else {

        clearReconnectTimer(
            currentSession
        );

        stopPlayer(
            currentSession?.player
        );

        sessions.delete(guildId);

        if (currentConnection) {

            destroyConnection(
                currentConnection
            );
        }

        connection =
            joinVoiceChannel({
                channelId:
                    channel.id,
                guildId:
                    channel.guild.id,
                adapterCreator:
                    channel.guild.voiceAdapterCreator,
                selfDeaf:
                    true
            });

        player =
            createKeepAlivePlayer(
                guildId
            );
    }

    const session = {
        guild:
            channel.guild,
        connection,
        player,
        voiceChannelId:
            channel.id,
        joinOwnerId:
            joinOwnerId ||
            previousJoinOwnerId ||
            null,
        reconnectTimer:
            null,
        recovering:
            false
    };

    sessions.set(
        guildId,
        session
    );

    watchConnection(
        connection,
        guildId
    );

    ensurePlayerPlaying(
        player
    );

    connection.subscribe(
        player
    );

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

    return connection;
}

function disconnectSession(guildId) {

    const session =
        sessions.get(guildId);

    sessions.delete(guildId);

    clearReconnectTimer(
        session
    );

    stopPlayer(
        session?.player
    );

    destroyConnection(
        session?.connection
    );

    const connection =
        getVoiceConnection(guildId);

    destroyConnection(
        connection
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

        const session =
            sessions.get(guild.id);

        if (session) {

            scheduleReconnect(
                guild.id,
                "voice state left"
            );
        }
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
