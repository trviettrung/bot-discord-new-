module.exports = {

    name: "interactionCreate",

    async execute(interaction) {

        if (!interaction.isChatInputCommand())
            return;

        try {
            await interaction.reply({
                content:
                    "📌 **Bot đã chuyển sang dùng lệnh dạng tin nhắn (Prefix):**\n\n" +
                    "🎤 **Lệnh Voice:** Dùng dấu `#` (ví dụ: `#join`, `#out`)\n" +
                    "🔤 **Lệnh Nối Từ:** Dùng dấu `!` (ví dụ: `!start`, `!end`, `!hint`, `!help`)\n\n" +
                    "Gõ `!help` để xem đầy đủ hướng dẫn!",
                ephemeral: true
            }).catch(() => {});
        } catch {
            // Bỏ qua nếu interaction hết hạn
        }
    }
};
