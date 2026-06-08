const {
    SlashCommandBuilder
} = require("discord.js");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName("d-xhelp")
            .setDescription(
                "Xem danh sách lệnh của bot nối từ"
            )
};
