const {
    SlashCommandBuilder
} = require("discord.js");

module.exports = {
    data:
        new SlashCommandBuilder()
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
            )
};
