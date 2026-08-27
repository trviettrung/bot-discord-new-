const {
    SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const qrData = {
    trung: { file: "qr_trung.jpg", name: "Trần Việt Trung (ZaloPay)" },
    quan: { file: "qr_quan.jpg", name: "Nguyễn Mạnh Quân (Techcombank)" },
    duy: { file: "qr_duy.jpg", name: "Dấn Đức Duy (MBBank)" },
    quang: { file: "qr_quang.png", name: "Trần Thanh Quang (Techcombank)" },
    chau: { file: "qr_chau.jpg", name: "Lê Bảo Châu (MBBank)" },
    dat: { file: "qr_dat.png", name: "Nguyễn Thành Đạt (Vietcombank)" },
    anhvu: { file: "qr_anhvu.jpg", name: "Phạm Anh Vũ (MoMo)" },
    trongvu: { file: "qr_trongvu.jpg", name: "Đào Trọng Vũ (MBBank)" },
    ha: { file: "qr_ha.jpg", name: "Ma Thu Hà (MoMo)" },
    duong: { file: "qr_duong.png", name: "Trần Hoàng Dương (MoMo)" }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("qr")
        .setDescription("Lấy mã QR (Của các TV Nghịch Tử)")
        .addStringOption(option =>
            option
                .setName("nguoi")
                .setDescription("Chọn người")
                .setRequired(true)
                .addChoices(
                    { name: "Trung (Trần Việt Trung - ZaloPay)", value: "trung" },
                    { name: "Quân (Nguyễn Mạnh Quân - Techcombank)", value: "quan" },
                    { name: "Duy (Đan Đức Duy - MBBank)", value: "duy" },
                    { name: "Quang (Trần Thanh Quảng - Techcombank)", value: "quang" },
                    { name: "Châu (Lê Bảo Châu - MBBank)", value: "chau" },
                    { name: "Đạt (Nguyễn Thành Đạt - Vietcombank)", value: "dat" },
                    { name: "Anh Vũ (Phạm Anh Vũ - MoMo)", value: "anhvu" },
                    { name: "Trọng Vũ (Đào Trọng Vũ - MBBank)", value: "trongvu" },
                    { name: "Hà (Ma Thu Hà - MoMo)", value: "ha" },
                    { name: "Dương (Trần Hoàng Dương - MoMo)", value: "duong" }
                )
        )
        .addStringOption(option =>
            option
                .setName("che_do")
                .setDescription("Chọn hình thức hiển thị (Public hoặc Private)")
                .setRequired(false)
                .addChoices(
                    { name: "Public (Mọi người cùng thấy)", value: "public" },
                    { name: "Private (Chỉ riêng bạn thấy)", value: "private" }
                )
        ),

    async execute(interaction) {
        const personKey = interaction.options.getString("nguoi", true);
        const mode = interaction.options.getString("che_do") || "public";
        const isEphemeral = mode === "private";

        // 1. Phản hồi defer ngay lập tức để không bị lỗi 10062 (hết hạn 3 giây)
        await interaction.deferReply({ ephemeral: isEphemeral });

        const person = qrData[personKey];
        if (!person) {
            return interaction.editReply({
                content: "Không tìm thấy thông tin mã QR của người này."
            });
        }

        const filePath = path.join(__dirname, "..", "assets", person.file);
        if (!fs.existsSync(filePath)) {
            return interaction.editReply({
                content: `Không tìm thấy file ảnh QR cho **${person.name}**.`
            });
        }

        return interaction.editReply({
            content: `💳 **Mã QR của ${person.name}:**`,
            files: [filePath]
        });
    }
};
