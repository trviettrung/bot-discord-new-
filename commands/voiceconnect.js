const {
    SlashCommandBuilder
} = require("discord.js");

const {
    handleVoiceConnectInteraction
} = require(
    "../games/voiceconnect/voiceManager"
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("voiceconnect")
        .setDescription("Treo bot trong voice")
        .addSubcommand(sub =>
            sub
                .setName("join")
                .setDescription(
                    "Cho bot tham gia voice hiện tại của bạn"
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("out")
                .setDescription(
                    "Cho bot rời voice nếu bạn là người đã thêm bot"
                )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "Lệnh này chỉ dùng được trong server.",
                ephemeral: true
            });
        }

        return handleVoiceConnectInteraction(interaction);
    }
};
