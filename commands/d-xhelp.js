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
        "`/add word`",
        "Thêm từ mới 2 âm tiết vào từ điển Nối Từ (Chủ bot / Quản lý server).",
        "",
        "`/add qr`",
        "Thêm mã QR thanh toán cá nhân vào Data Server và Google Sheets.",
        "",
        "`/add birthday`",
        "Thêm / cập nhật ngày sinh nhật của bạn hoặc thành viên.",
        "`/qr`",
        "Xem mã QR thanh toán của bạn hoặc thành viên trong server.",
        "",
        "`/delete qr`",
        "Xóa mã QR thanh toán của chính bạn khỏi hệ thống.",
        "",
        "`/delete birthday`",
        "Xóa ngày sinh nhật khỏi hệ thống (Chỉ tự xóa của mình; Admin/Owner xóa được của người khác).",
        "",
        "`/voiceconnect join`",
        "Cho bot tham gia voice hiện tại của bạn.",
        "",
        "`/voiceconnect out`",
        "Cho bot rời voice.",
        "",
        "`/d-xhelp`",
        "Hiện danh sách lệnh và hướng dẫn.",
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
