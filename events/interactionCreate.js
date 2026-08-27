module.exports = {
    name: "interactionCreate",

    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`Lỗi khi thực thi lệnh /${interaction.commandName}:`, error);

            const payload = {
                content: "Bot bị lỗi khi xử lý lệnh.",
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    }
};
