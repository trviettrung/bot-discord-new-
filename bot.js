require("dotenv").config();

const {
    Client,
    GatewayIntentBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.log("❌ Thiếu TOKEN trong file .env");
    process.exit(1);
}

/*
========================
GLOBAL CRASH GUARD
========================
*/
process.on("unhandledRejection", (reason, promise) => {
    console.error("[Crash Guard] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err, origin) => {
    console.error("[Crash Guard] Uncaught Exception:", err, "origin:", origin);
});

/*
========================
CLIENT
========================
*/

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

/*
========================
LOAD EVENTS
========================
*/

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith(".js"));

for (const file of eventFiles) {

    const event = require(`./events/${file}`);

    client.on(
        event.name,

        (...args) => {

            Promise
                .resolve(
                    event.execute(
                        ...args,
                        client
                    )
                )
                .catch(console.error);
        }
    );
}

/*
========================
LOGIN
========================
*/

console.log("⏳ Đang kết nối tới Discord...");

client.login(TOKEN).catch(err => {
    console.error("❌ Lỗi khi đăng nhập bot vào Discord:", err);
});

