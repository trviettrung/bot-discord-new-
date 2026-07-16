const {
    Events
} = require("discord.js");

const botStatus =
    require("../config/status");

const { startStatusLoop } = require("../utils/statusMonitor");

module.exports = {

    name: Events.ClientReady,

    async execute(client) {

        client.user.setPresence(
            botStatus
        );

        console.log(
            `Bot ready: ${client.user.tag}`
        );

        // Khởi chạy vòng lặp báo cáo trạng thái
        startStatusLoop(client);
    }
};
