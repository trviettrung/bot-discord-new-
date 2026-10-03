const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType
} = require("discord.js");

const googleSheets = require("../services/googleSheets");

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

async function deleteStorageMessage(client, messageId) {
    if (!messageId) return;
    try {
        const channel = await client.channels.fetch(QR_STORAGE_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) await msg.delete().catch(() => null);
        }
    } catch (err) {
        console.error("Lỗi xóa message trên Data Server:", err.message);
    }
}

async function sendBotLog(client, content) {
    try {
        const logsChannel = await client.channels.fetch(BOT_LOGS_CHANNEL_ID).catch(() => null);
        if (logsChannel && logsChannel.isTextBased()) {
            logsChannel.send({ content }).catch(() => null);
        }
    } catch (err) {
        console.error("Lỗi gửi log xóa:", err.message);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Xóa dữ liệu (QR, Ngày sinh)")
        // Subcommand: DELETE QR
        .addSubcommand(sub =>
            sub
                .setName("qr")
                .setDescription("Xóa mã QR thanh toán của chính bạn khỏi hệ thống")
                .addStringOption(opt =>
                    opt
                        .setName("qr_id")
                        .setDescription("Mã số ID của QR cần xóa (nếu biết)")
                        .setRequired(false)
                )
        )
        // Subcommand: DELETE BIRTHDAY
        .addSubcommand(sub =>
            sub
                .setName("birthday")
                .setDescription("Xóa ngày sinh nhật khỏi hệ thống")
                .addUserOption(opt =>
                    opt
                        .setName("user")
                        .setDescription("Chọn người muốn xóa ngày sinh (Chỉ Admin / Chủ bot mới được xóa người khác)")
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Lệnh này chỉ dùng được bên trong Server Discord.",
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();

        /*
        =====================================================
        1. /DELETE QR
        =====================================================
        */
        if (sub === "qr") {
            const targetUser = interaction.user;
            const qrId = interaction.options.getString("qr_id")?.trim() || null;

            await interaction.deferReply({ ephemeral: true });

            const deleteResult = await googleSheets.deleteQRFromSheet({
                guildId: interaction.guild.id,
                userId: targetUser.id,
                qrId
            });

            if (deleteResult.notFound) {
                return interaction.editReply({
                    content: "❌ Bạn chưa có mã QR nào được lưu trong server này để xóa."
                });
            }

            // Trường hợp người dùng có nhiều mã QR và không ghi rõ qr_id
            if (deleteResult.multiple) {
                const qrs = deleteResult.qrs;
                const selectOptions = qrs.map(q => ({
                    label: q.name.length > 100 ? q.name.substring(0, 97) + "..." : q.name,
                    description: `ID: #${q.id}`,
                    value: String(q.id)
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`delete_qr_select_${interaction.id}`)
                    .setPlaceholder("Chọn mã QR bạn muốn xóa...")
                    .addOptions(selectOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const promptMsg = await interaction.editReply({
                    content: `ℹ️ Bạn đang có **${qrs.length}** mã QR trong server. Vui lòng chọn mã QR bạn muốn xóa bên dưới:`,
                    components: [row]
                });

                const collector = promptMsg.createMessageComponentCollector({
                    componentType: ComponentType.StringSelect,
                    time: 60000
                });

                collector.on("collect", async i => {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({
                            content: "Chỉ người gõ lệnh mới có thể thao tác menu này.",
                            ephemeral: true
                        });
                    }

                    const selectedQRId = i.values[0];
                    const finalRes = await googleSheets.deleteQRFromSheet({
                        guildId: interaction.guild.id,
                        userId: targetUser.id,
                        qrId: selectedQRId
                    });

                    if (finalRes.ok && finalRes.deletedQR) {
                        await deleteStorageMessage(interaction.client, finalRes.deletedQR.messageId);

                        sendBotLog(
                            interaction.client,
                            `🗑️ \`[LOG /delete qr]\` | Server: **${interaction.guild.name}** (\`${interaction.guild.id}\`) | Thực hiện: <@${interaction.user.id}> | Tên QR: **${finalRes.deletedQR.name}** (ID: #${finalRes.deletedQR.id})`
                        );

                        await i.update({
                            content: `✅ Đã xóa thành công mã QR **"${finalRes.deletedQR.name}"** (ID: #${finalRes.deletedQR.id}) của bạn khỏi hệ thống.`,
                            components: []
                        });
                    } else {
                        await i.update({
                            content: "❌ Không thể xóa mã QR đã chọn (có thể đã bị xóa trước đó).",
                            components: []
                        });
                    }
                });

                collector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        try {
                            const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
                            const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
                            await interaction.editReply({
                                content: "⏳ Đã hết thời gian chọn mã QR để xóa.",
                                components: [disabledRow]
                            });
                        } catch {
                            // Ignore
                        }
                    }
                });

                return;
            }

            // Xóa thành công 1 QR duy nhất
            if (deleteResult.ok && deleteResult.deletedQR) {
                const deletedQR = deleteResult.deletedQR;

                // Xóa ảnh trên storage server
                await deleteStorageMessage(interaction.client, deletedQR.messageId);

                // Ghi log
                sendBotLog(
                    interaction.client,
                    `🗑️ \`[LOG /delete qr]\` | Server: **${interaction.guild.name}** (\`${interaction.guild.id}\`) | Thực hiện: <@${interaction.user.id}> | Tên QR: **${deletedQR.name}** (ID: #${deletedQR.id})`
                );

                return interaction.editReply({
                    content: `✅ Đã xóa thành công mã QR **"${deletedQR.name}"** (ID: #${deletedQR.id}) của bạn khỏi hệ thống.`
                });
            }
        }

        /*
        =====================================================
        2. /DELETE BIRTHDAY
        =====================================================
        */
        if (sub === "birthday") {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const isSelf = targetUser.id === interaction.user.id;

            // Kiểm tra phân quyền
            if (!isSelf && !hasAdminPermission(interaction)) {
                return interaction.reply({
                    content: "❌ Bạn chỉ có thể tự xóa ngày sinh của chính mình. Để xóa ngày sinh của người khác, bạn cần có quyền **Quản lý máy chủ** hoặc quyền **Administrator**.",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const deleteResult = await googleSheets.deleteBirthdayFromSheet({
                guildId: interaction.guild.id,
                userId: targetUser.id
            });

            if (deleteResult.notFound) {
                return interaction.editReply({
                    content: isSelf
                        ? "❌ Bạn chưa có dữ liệu ngày sinh nào được lưu trong server này để xóa."
                        : `❌ Không tìm thấy dữ liệu ngày sinh của <@${targetUser.id}> trong server này.`
                });
            }

            if (deleteResult.ok) {
                sendBotLog(
                    interaction.client,
                    `🗑️ \`[LOG /delete birthday]\` | Server: **${interaction.guild.name}** (\`${interaction.guild.id}\`) | Thực hiện: <@${interaction.user.id}> | Xóa ngày sinh của: <@${targetUser.id}> (${deleteResult.birthday})`
                );

                return interaction.editReply({
                    content: `✅ Đã xóa thông tin ngày sinh (**${deleteResult.birthday}**) của <@${targetUser.id}> khỏi hệ thống.`
                });
            }
        }

        return interaction.reply({
            content: "Lệnh không hợp lệ.",
            ephemeral: true
        });
    }
};
