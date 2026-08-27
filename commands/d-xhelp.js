const {
    SlashCommandBuilder
} = require("discord.js");

const {
    HINT_COOLDOWN_SECONDS,
    HINT_TOP_LIMIT
} = require(
    "../games/wordconnect/playerStore"
);

function getHelpMessage() {
    return [
        "**Danh sách lệnh**",
        "",
        "`/wordconnect start`",
        "Bắt đầu ván tại kênh hiện tại bằng một từ ngẫu nhiên.",
        "",
        "`/wordconnect end`",
        "Kết thúc ván hiện tại.",
        "",
        "`/wordconnect hint`",
        `Gợi ý một từ nối tiếp. Người ngoài Top ${HINT_TOP_LIMIT} bị cooldown ${HINT_COOLDOWN_SECONDS} giây.`,
        "",
        "`/wordconnect add`",
        "Thêm từ mới vào từ điển bot. Chỉ chủ bot dùng được.",
        "",
        "`/voiceconnect join`",
        "Cho bot tham gia voice hiện tại của bạn.",
        "",
        "`/voiceconnect out`",
        "Cho bot rời voice. Chỉ người đã thêm bot mới dùng được.",
        "",
        "`/qr`",
        "Gửi mã QR thanh toán ngân hàng (chọn người nhận và chế độ Public / Private).",
        "",
        "`/d-xhelp`",
        "Hiện danh sách lệnh và tác dụng.",
        "",
        "**Luật chơi nhanh**",
        "Người chơi sau dùng tiếng cuối của từ trước để bắt đầu một từ mới có 2 tiếng.",
        "Từ mới phải có nghĩa. Từ đã dùng trong 20 lượt gần nhất không được lặp lại."
    ].join("\n");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("d-xhelp")
        .setDescription(
            "Xem danh sách lệnh của bot nối từ"
        ),

    async execute(interaction) {
        return interaction.reply({
            content: getHelpMessage(),
            ephemeral: true
        });
    }
};
