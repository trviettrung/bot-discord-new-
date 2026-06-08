const botStatus =
    require("../config/status");

module.exports = {

    name: "ready",

    async execute(client) {

        client.user.setPresence(
            botStatus
        );

        console.log(
            `Bot ready: ${client.user.tag}`
        );
    }
};
