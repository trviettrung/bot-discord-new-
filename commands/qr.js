const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType
} = require("discord.js");

const googleSheets = require("../services/googleSheets");

const QR_STORAGE_CHANNEL_ID = process.env.QR_STORAGE_CHANNEL_ID || "1552752936252346420";

async function getFreshImageUrl(client, qr) {
    if (!qr.messageId) return qr.imageUrl;

    try {
        const channel = await client.channels.fetch(QR_STORAGE_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(qr.messageId).catch(() => null);
            if (message && message.attachments.size > 0) {
                return message.attachments.first().url;
            }
        }
    } catch (err) {
        console.error(`Không thể lấy fresh URL cho message ${qr.messageId}:`, err.message);
    }

    return qr.imageUrl;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("qr")
        .setDescription("Xem mã QR thanh toán của thành viên trong server")
        .addUserOption(option =>
            option
                .setName("nguoi")
                .setDescription("Chọn người muốn lấy mã QR (để trống để lấy của chính bạn)")
                .setRequired(false)
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
        // Defer ngay lập tức để tránh lỗi 10062 Unknown Interaction (3 giây timeout)
        const mode = interaction.options.getString("che_do") || "public";
        const isEphemeral = mode === "private";

        await interaction.deferReply({ ephemeral: isEphemeral });

        if (!interaction.guild) {
            return interaction.editReply({
                content: "❌ Lệnh này chỉ dùng được trong Server Discord."
            });
        }

        const targetUser = interaction.options.getUser("nguoi") || interaction.user;

        // 1. Tìm QR của người này trong Server hiện tại trên Google Sheets
        const userQRs = await googleSheets.getQRList({
            guildId: interaction.guild.id,
            userId: targetUser.id
        });

        if (userQRs.length === 0) {
            const isSelf = targetUser.id === interaction.user.id;

            const responseText = isSelf
                ? "❌ Bạn chưa có mã QR nào được lưu trong server này.\n👉 Dùng lệnh `/add qr` để thêm mã QR mới!"
                : `❌ Thành viên **${targetUser.displayName || targetUser.username}** chưa có mã QR nào trong server này.`;

            return interaction.editReply({ content: responseText });
        }

        // 2. Nếu người dùng chỉ có 1 mã QR
        if (userQRs.length === 1) {
            const qr = userQRs[0];
            const imageUrl = await getFreshImageUrl(interaction.client, qr);

            const embed = new EmbedBuilder()
                .setDescription(`Mã QR của **${targetUser.displayName || targetUser.username}**:`)
                .setImage(imageUrl);

            return interaction.editReply({ embeds: [embed] });
        }

        // 3. Nếu người dùng có nhiều mã QR (ví dụ nhiều ngân hàng)
        let currentQR = userQRs[0];
        let imageUrl = await getFreshImageUrl(interaction.client, currentQR);

        const selectOptions = userQRs.map(q => ({
            label: q.name.length > 100 ? q.name.substring(0, 97) + "..." : q.name,
            description: `Mã số: #${q.id}`,
            value: String(q.id),
            default: q.id === currentQR.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`qr_select_${interaction.id}`)
            .setPlaceholder("Chọn loại mã QR muốn xem...")
            .addOptions(selectOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setDescription(`Mã QR của **${targetUser.displayName || targetUser.username}** (${currentQR.name}):`)
            .setImage(imageUrl);

        const replyMessage = await interaction.editReply({
            embeds: [embed],
            components: [row]
        });

        // Tạo collector lắng nghe lựa chọn menu trong 60 giây
        const collector = replyMessage.createMessageComponentCollector({
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

            const selectedId = i.values[0];
            const selectedQR = userQRs.find(q => String(q.id) === selectedId) || userQRs[0];
            const updatedImageUrl = await getFreshImageUrl(interaction.client, selectedQR);

            const updatedOptions = userQRs.map(q => ({
                label: q.name.length > 100 ? q.name.substring(0, 97) + "..." : q.name,
                description: `Mã số: #${q.id}`,
                value: String(q.id),
                default: q.id === selectedQR.id
            }));

            const updatedMenu = new StringSelectMenuBuilder()
                .setCustomId(`qr_select_${interaction.id}`)
                .setPlaceholder("Chọn loại mã QR muốn xem...")
                .addOptions(updatedOptions);

            const updatedRow = new ActionRowBuilder().addComponents(updatedMenu);

            const updatedEmbed = new EmbedBuilder()
                .setDescription(`Mã QR của **${targetUser.displayName || targetUser.username}** (${selectedQR.name}):`)
                .setImage(updatedImageUrl);

            await i.update({
                embeds: [updatedEmbed],
                components: [updatedRow]
            });
        });

        collector.on("end", async () => {
            try {
                const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
                await interaction.editReply({
                    components: [disabledRow]
                });
            } catch {
                // Ignore if message was deleted
            }
        });
    }
};
