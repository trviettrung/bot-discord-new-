const {
    SlashCommandBuilder
} = require("discord.js");

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName("wordconnect")
            .setDescription("Game nối từ")
            .addSubcommand(sub =>
                sub
                    .setName("start")
                    .setDescription(
                        "Bắt đầu game bằng từ ngẫu nhiên"
                    )
            )
            .addSubcommand(sub =>
                sub
                    .setName("end")
                    .setDescription(
                        "Kết thúc ván hiện tại"
                    )
            )
            .addSubcommand(sub =>
                sub
                    .setName("hint")
                    .setDescription(
                        "Nhận gợi ý từ nối tiếp"
                    )
            )
            .addSubcommand(sub =>
                sub
                    .setName("add")
                    .setDescription(
                        "Thêm từ mới vào từ điển bot"
                    )
                    .addStringOption(option =>
                        option
                            .setName("word")
                            .setDescription(
                                "Từ 2 âm tiết muốn thêm"
                            )
                            .setRequired(true)
                    )
            )
};
