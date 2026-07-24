const {
    Events
} = require("discord.js");

const botStatus =
    require("../config/status");

const { startStatusLoop } = require("../utils/statusMonitor");

// Tự động set lại presence sau mỗi 30 phút
// vì Discord định kỳ xóa trắng status sau khi reconnect
const PRESENCE_REFRESH_MS = 30 * 60 * 1000;

function applyPresence(client) {
    try {
        client.user.setPresence(botStatus);
    } catch (err) {
        console.error("Lỗi set presence:", err);
    }
}

module.exports = {

    name: Events.ClientReady,

    once: true,

    async execute(client) {

        applyPresence(client);

        console.log(
            `Bot ready: ${client.user.tag}`
        );

        // Khởi chạy vòng lặp báo cáo trạng thái
        startStatusLoop(client);

        // Set lại presence định kỳ mỗi 30 phút
        setInterval(() => applyPresence(client), PRESENCE_REFRESH_MS);

        // Set lại presence mỗi khi bot reconnect sau mất mạng thoáng qua
        client.on(Events.ShardResume, () => {
            console.log("Shard resumed — refreshing presence...");
            applyPresence(client);
        });
    }
};
