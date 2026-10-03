const {
    Events
} = require("discord.js");

const botStatus =
    require("../config/status");

const {
    syncWordsFromGoogleSheet
} = require("../games/wordconnect/wordGraph");

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

        // Đồng bộ từ điển từ Google Sheet
        syncWordsFromGoogleSheet().catch(err => {
            console.error("Lỗi đồng bộ Google Sheet:", err);
        });

        // Đồng bộ danh sách Servers lên Google Sheet
        const googleSheets = require("../services/googleSheets");
        for (const guild of client.guilds.cache.values()) {
            googleSheets.upsertServer({
                guildId: guild.id,
                guildName: guild.name,
                ownerId: guild.ownerId,
                joinedAt: guild.joinedTimestamp,
                enabled: true
            }).catch(err => console.error(`Lỗi cập nhật Server ${guild.name} lên Sheet:`, err.message));
        }

        // Set lại presence định kỳ mỗi 30 phút
        setInterval(() => applyPresence(client), PRESENCE_REFRESH_MS);

        // Set lại presence mỗi khi bot reconnect sau mất mạng thoáng qua
        client.on(Events.ShardResume, () => {
            console.log("Shard resumed — refreshing presence...");
            applyPresence(client);
        });
    }
};
