const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const googleSheets = require("../services/googleSheets");
const { saveKnownWord } = require("../games/wordconnect/wordGraph");

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || "772059345990189066";
const QR_STORAGE_CHANNEL_ID = process.env.QR_STORAGE_CHANNEL_ID || "1552752936252346420";
const BOT_LOGS_CHANNEL_ID = process.env.BOT_LOGS_CHANNEL_ID || "1552752985010864178";

function isBotOwner(userId) {
    return userId === BOT_OWNER_ID;
}

function hasAdminPermission(interaction) {
    if (isBotOwner(interaction.user.id)) return true;
    const permissions = interaction.memberPermissions;
    if (!permissions) return false;
    return (
        permissions.has(PermissionFlagsBits.Administrator) ||
        permissions.has(PermissionFlagsBits.ManageGuild)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add")
        .setDescription("Thêm dữ liệu cho bot (Từ nối, QR, Ngày sinh)")
        // Subcommand: WORD
        .addSubcommand(sub =>
            sub
                .setName("word")
                .setDescription("Thêm từ 2 âm tiết vào từ điển Nối Từ")
                .addStringOption(opt =>
                    opt
                        .setName("word")
                        .setDescription("Từ tiếng Việt 2 âm tiết (vd: học sinh)")
                        .setRequired(true)
                )
        )
        // Subcommand: QR
        .addSubcommand(sub =>
            sub
                .setName("qr")
                .setDescription("Thêm mã QR thanh toán của chính bạn")
                .addStringOption(opt =>
                    opt
                        .setName("name")
                        .setDescription("Tên / mô tả mã QR (vd: MBBank, Vietcombank, MoMo...)")
                        .setRequired(true)
                )
                .addAttachmentOption(opt =>
                    opt
                        .setName("image")
                        .setDescription("Ảnh mã QR của bạn")
                        .setRequired(true)
                )
        )
        // Subcommand: BIRTHDAY
        .addSubcommand(sub =>
            sub
                .setName("birthday")
                .setDescription("Thêm / cập nhật ngày sinh nhật")
                .addUserOption(opt =>
                    opt
                        .setName("user")
                        .setDescription("Người có ngày sinh")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt
                        .setName("date")
                        .setDescription("Ngày sinh theo định dạng ngày/tháng (vd: 15/08 hoặc 15/08/2000)")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Lệnh này chỉ có thể sử dụng bên trong Server Discord.",
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();

        /*
        =====================================================
        1. /ADD WORD
        =====================================================
        */
        if (sub === "word") {
            if (!hasAdminPermission(interaction)) {
                return interaction.reply({
                    content: "❌ Bạn cần có quyền **Quản lý máy chủ** hoặc là **Chủ bot** để thêm từ vựng mới.",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const rawWord = interaction.options.getString("word", true);
            const result = await saveKnownWord(rawWord, interaction.user.id);

            if (!result.ok) {
                return interaction.editReply({
                    content: `❌ Từ **"${rawWord}"** không hợp lệ! Từ phải gồm đúng 2 âm tiết và chỉ chứa chữ cái tiếng Việt.`
                });
            }

            if (result.existed) {
                return interaction.editReply({
                    content: `ℹ️ Từ **"${result.word}"** đã có sẵn trong từ điển của bot rồi.`
                });
            }

            return interaction.editReply({
                content: `✅ Đã thêm thành công từ **"${result.word}"** vào Google Sheets và từ điển bot!`
            });
        }

        /*
        =====================================================
        2. /ADD QR
        =====================================================
        */
        if (sub === "qr") {
            const targetUser = interaction.user;
            const targetMember = interaction.member;
            const qrName = interaction.options.getString("name", true).trim();
            const attachment = interaction.options.getAttachment("image", true);

            // Kiểm tra tệp đính kèm có phải là ảnh không
            const isImage = (
                attachment.contentType?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif)$/i.test(attachment.name || "")
            );
            if (!isImage) {
                return interaction.reply({
                    content: "❌ Tệp tải lên không phải là định dạng hình ảnh hợp lệ (chỉ hỗ trợ PNG, JPG, WEBP, GIF).",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            // Tìm Storage Channel trên Data Server
            let storageChannel = null;
            try {
                storageChannel = await interaction.client.channels.fetch(QR_STORAGE_CHANNEL_ID).catch(() => null);
            } catch (err) {
                console.error("Lỗi khi tìm kênh QR Storage:", err);
            }

            if (!storageChannel || !storageChannel.isTextBased()) {
                return interaction.editReply({
                    content: "❌ Không thể kết nối tới kênh lưu trữ ảnh của Data Server. Vui lòng liên hệ chủ bot để kiểm tra quyền hạn."
                });
            }

            try {
                // 1. Gửi ảnh vào Data Server (#qr-images)
                const storageMessage = await storageChannel.send({
                    content: `💳 **LƯU TRỮ QR**\n` +
                             `• **Server nguồn:** ${interaction.guild.name} (\`${interaction.guild.id}\`)\n` +
                             `• **Chủ sở hữu QR:** <@${targetUser.id}> (${targetMember.displayName} - \`${targetUser.id}\`)\n` +
                             `• **Tên QR:** **${qrName}**\n` +
                             `• **Người thêm:** <@${interaction.user.id}> (\`${interaction.user.id}\`)\n` +
                             `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`,
                    files: [
                        {
                            attachment: attachment.url,
                            name: attachment.name || "qr_code.png"
                        }
                    ]
                });

                const permanentImageUrl = storageMessage.attachments.first()?.url || attachment.url;
                const messageId = storageMessage.id;

                // 2. Lưu Metadata vào Google Sheet (Tab: QR)
                await googleSheets.addQRToSheet({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    name: qrName,
                    messageId: messageId,
                    imageUrl: permanentImageUrl
                });

                // 3. Ghi log vào kênh #bot-log nếu có
                try {
                    const logsChannel = await interaction.client.channels.fetch(BOT_LOGS_CHANNEL_ID).catch(() => null);
                    if (logsChannel && logsChannel.isTextBased()) {
                        logsChannel.send({
                            content: `📝 \`[LOG /add qr]\` | Server: **${interaction.guild.name}** (\`${interaction.guild.id}\`) | Thực hiện: <@${interaction.user.id}> | Chủ QR: <@${targetUser.id}> | Tên: **${qrName}** | Message ID: \`${messageId}\``
                        }).catch(() => null);
                    }
                } catch (logErr) {
                    console.error("Lỗi gửi log:", logErr);
                }

                // 4. Phản hồi cho người dùng
                const embed = new EmbedBuilder()
                    .setTitle("✅ Thêm mã QR thành công!")
                    .setColor(0x00FF88)
                    .addFields(
                        { name: "👤 Người sở hữu", value: `<@${targetUser.id}> (${targetMember.displayName})`, inline: true },
                        { name: "🏷️ Tên / Loại QR", value: `**${qrName}**`, inline: true },
                        { name: "📌 Server", value: `${interaction.guild.name}`, inline: true }
                    )
                    .setImage(permanentImageUrl)
                    .setFooter({ text: `Người thực hiện: ${interaction.user.tag}` })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });

            } catch (err) {
                console.error("Lỗi khi xử lý /add qr:", err);
                return interaction.editReply({
                    content: `❌ Đã có lỗi xảy ra khi lưu mã QR: ${err.message || err}`
                });
            }
        }

        /*
        =====================================================
        3. /ADD BIRTHDAY
        =====================================================
        */
        if (sub === "birthday") {
            const targetUser = interaction.options.getUser("user", true);
            const rawDate = interaction.options.getString("date", true).trim();

            // Phân quyền
            if (targetUser.id !== interaction.user.id && !hasAdminPermission(interaction)) {
                return interaction.reply({
                    content: "❌ Bạn chỉ có thể tự đặt ngày sinh cho chính mình. Để đặt ngày sinh cho người khác, bạn cần có quyền **Quản lý máy chủ** hoặc quyền **Administrator**.",
                    ephemeral: true
                });
            }

            // Kiểm tra người dùng có trong server không
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                return interaction.reply({
                    content: `❌ Người dùng **${targetUser.tag}** không có mặt trong server này.`,
                    ephemeral: true
                });
            }

            // Kiểm tra định dạng ngày sinh: dd/mm hoặc dd/mm/yyyy
            const dateRegex = /^([0-2]?[0-9]|3[01])\/(0?[1-9]|1[0-2])(\/\d{4})?$/;
            if (!dateRegex.test(rawDate)) {
                return interaction.reply({
                    content: "❌ Định dạng ngày sinh không hợp lệ. Vui lòng nhập theo dạng **ngày/tháng** (vd: `15/08`) hoặc **ngày/tháng/năm** (vd: `15/08/2000`).",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const saveResult = await googleSheets.saveBirthdayToSheet({
                    guildId: interaction.guild.id,
                    userId: targetUser.id,
                    birthday: rawDate
                });

                return interaction.editReply({
                    content: `🎂 Đã ${saveResult.updated ? "cập nhật" : "lưu"} ngày sinh của <@${targetUser.id}>: **${rawDate}** vào hệ thống!`
                });
            } catch (err) {
                console.error("Lỗi lưu birthday:", err);
                return interaction.editReply({
                    content: `❌ Lỗi khi lưu ngày sinh vào Google Sheets: ${err.message || err}`
                });
            }
        }

        return interaction.reply({
            content: "Lệnh không hợp lệ.",
            ephemeral: true
        });
    }
};
