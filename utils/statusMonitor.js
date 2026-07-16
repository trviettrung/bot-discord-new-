const os = require("os");
const { getVoiceConnections } = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");

const TARGET_CHANNEL_ID = "1317178116111597663";
const ADMIN_ID = "772059345990189066";
const DATA_DIR = path.join(__dirname, "..", "data");
const MESSAGE_ID_FILE = path.join(DATA_DIR, "status_message_id.txt");

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d} ngày ${h} giờ ${m} phút ${s} giây`;
}

let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

function getProcessCpuUsage() {
    const currentCpuUsage = process.cpuUsage();
    const currentTime = Date.now();
    const timeDelta = currentTime - lastCpuTime || 1;

    const userDelta = currentCpuUsage.user - lastCpuUsage.user;
    const systemDelta = currentCpuUsage.system - lastCpuUsage.system;

    const cpuPercent = ((userDelta + systemDelta) / 1000 / timeDelta) * 100;
    
    lastCpuUsage = currentCpuUsage;
    lastCpuTime = currentTime;

    return cpuPercent.toFixed(2);
}

function generateStatusEmbed() {
    const voiceCount = getVoiceConnections().size;
    const uptime = formatUptime(process.uptime());
    const memory = process.memoryUsage();
    
    const ramBot = (memory.rss / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeRam = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedRam = (totalRam - freeRam).toFixed(2);
    const cpuUsage = getProcessCpuUsage();

    return {
        color: 0x00FF00,
        title: "📊 Bảng Trạng Thái Bot",
        fields: [
            { name: "⏱ Thời gian hoạt động", value: uptime, inline: false },
            { name: "🎤 Số kênh Voice đang kết nối", value: `${voiceCount} kênh`, inline: false },
            { name: "⚙️ CPU Bot Sử Dụng", value: `${cpuUsage}%`, inline: true },
            { name: "🧠 RAM Bot Sử Dụng", value: `${ramBot} MB`, inline: true },
            { name: "🖥️ RAM Máy chủ", value: `${usedRam} GB / ${totalRam} GB`, inline: false }
        ],
        footer: { text: "Cập nhật tự động mỗi 5 phút" },
        timestamp: new Date().toISOString()
    };
}

let savedMessageId = null;

function loadSavedMessageId() {
    try {
        if (fs.existsSync(MESSAGE_ID_FILE)) {
            savedMessageId = fs.readFileSync(MESSAGE_ID_FILE, "utf8").trim();
        }
    } catch (e) {
        console.error("Lỗi đọc MESSAGE_ID_FILE:", e);
    }
}

function saveMessageId(id) {
    savedMessageId = id;
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(MESSAGE_ID_FILE, id, "utf8");
    } catch (e) {
        console.error("Lỗi ghi MESSAGE_ID_FILE:", e);
    }
}

async function updateStatusMessage(client) {
    try {
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = generateStatusEmbed();

        if (savedMessageId) {
            try {
                const message = await channel.messages.fetch(savedMessageId);
                if (message) {
                    await message.edit({ embeds: [embed] });
                    return;
                }
            } catch (err) {
                // Message might be deleted, ignore error and send new
                savedMessageId = null;
            }
        }

        const newMessage = await channel.send({ embeds: [embed] });
        saveMessageId(newMessage.id);
    } catch (err) {
        console.error("Lỗi cập nhật bảng trạng thái:", err);
    }
}

let intervalTimer = null;

function startStatusLoop(client) {
    loadSavedMessageId();
    // Update immediately on start, then every 5 minutes
    updateStatusMessage(client);
    
    if (intervalTimer) clearInterval(intervalTimer);
    intervalTimer = setInterval(() => {
        updateStatusMessage(client);
    }, 5 * 60 * 1000);
}

async function handleStatusCommand(message) {
    if (message.content.trim() !== "!status") return false;
    
    if (message.author.id !== ADMIN_ID) {
        await message.reply("Bạn không có quyền sử dụng lệnh này.");
        return true;
    }
    
    try {
        const embed = generateStatusEmbed();
        embed.footer = { text: "Kiểm tra thủ công" };
        await message.reply({ embeds: [embed] });
    } catch (err) {
        console.error("Lỗi gửi lệnh !status:", err);
    }
    return true;
}

module.exports = {
    startStatusLoop,
    handleStatusCommand
};
