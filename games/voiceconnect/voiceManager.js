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

async function connectToVoiceChannel(channel) {

    const currentConnection =
        getVoiceConnection(channel.guild.id);

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

    sessions.set(
        channel.guild.id,
        {
            connection,
            voiceChannelId:
                channel.id
        }
    );

    await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        20_000
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

        await connectToVoiceChannel(
            voiceChannel
        );

        return interaction.reply(
            `Bot đã tham gia voice **${voiceChannel.name}**.`
        );
    }

    if (sub === "out") {

        const connectedVoiceId =
            getConnectedVoiceChannelId(
                interaction.guild.id
            );

        if (!connectedVoiceId) {

            return interaction.reply({
                content:
                    "Bot hiện không ở trong voice.",
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
