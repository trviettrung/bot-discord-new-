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

    const reason =
        error?.code ||
        error?.name ||
        error?.message ||
        "unknown";

    console.warn(
        `Voice connect failed: ${reason}`
    );
}

async function connectToVoiceChannel(
    channel,
    joinOwnerId
) {

    const currentConnection =
        getVoiceConnection(channel.guild.id);

    const currentSession =
        sessions.get(channel.guild.id);

    let connection;

    if (
        currentConnection &&
        currentConnection.joinConfig.channelId === channel.id
    ) {

        connection =
            currentConnection;

    } else {

        if (currentConnection) {

            currentConnection.destroy();
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
    }

    try {

        await entersState(
            connection,
            VoiceConnectionStatus.Ready,
            20_000
        );

    } catch (error) {

        try {

            connection.destroy();

        } catch {

            // Connection may already be destroyed by Discord.
        }

        sessions.delete(
            channel.guild.id
        );

        throw error;
    }

    sessions.set(
        channel.guild.id,
        {
            connection,
            voiceChannelId:
                channel.id,
            joinOwnerId:
                joinOwnerId ||
                currentSession?.joinOwnerId ||
                null
        }
    );

    return connection;
}

function disconnectSession(guildId) {

    const session =
        sessions.get(guildId);

    if (session?.connection) {

        try {

            session.connection.destroy();

        } catch {

            // Connection may already be destroyed by Discord.
        }
    }

    const connection =
        getVoiceConnection(guildId);

    if (connection) {

        try {

            connection.destroy();

        } catch {

            // Connection may already be destroyed by Discord.
        }
    }

    sessions.delete(guildId);
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
            );

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

        const connectedVoiceId =
            getConnectedVoiceChannelId(
                interaction.guild.id
            );

        const session =
            sessions.get(interaction.guild.id);

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

        sessions.delete(guild.id);
    }
}

module.exports = {
    handleVoiceConnectInteraction,
    handleVoiceStateUpdate
};
