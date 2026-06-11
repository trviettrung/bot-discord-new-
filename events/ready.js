const {
    Events
} = require("discord.js");

const botStatus =
    require("../config/status");

module.exports = {

    name: Events.ClientReady,

    async execute(client) {

        client.user.setPresence(
            botStatus
        );

        console.log(
            `Bot ready: ${client.user.tag}`
        );
    }
};
