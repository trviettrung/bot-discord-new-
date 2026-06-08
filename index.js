require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
    console.log("❌ Thiếu TOKEN trong file .env");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.log("❌ Thiếu CLIENT_ID trong file .env");
    process.exit(1);
}

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
LOAD COMMANDS
========================
*/

client.commands = new Collection();

const commands = [];
const PRIMARY_ENTRY_POINT_COMMAND_TYPE = 4;

const commandFiles = fs
    .readdirSync("./commands")
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {

    const command = require(`./commands/${file}`);

    client.commands.set(
        command.data.name,
        command
    );

    commands.push(
        command.data.toJSON()
    );
}

/*
========================
REGISTER COMMANDS
========================
*/

const rest = new REST({
    version: "10"
}).setToken(TOKEN);

function keepEntryPointCommand(command) {

    const payload = {
        name: command.name,
        type: command.type
    };

    if (
        typeof command.description === "string"
    ) {

        payload.description =
            command.description;
    }

    if (
        command.name_localizations
    ) {

        payload.name_localizations =
            command.name_localizations;
    }

    if (
        command.description_localizations
    ) {

        payload.description_localizations =
            command.description_localizations;
    }

    if (
        command.default_member_permissions !== undefined
    ) {

        payload.default_member_permissions =
            command.default_member_permissions;
    }

    if (
        Array.isArray(command.contexts)
    ) {

        payload.contexts =
            command.contexts;
    }

    if (
        Array.isArray(command.integration_types)
    ) {

        payload.integration_types =
            command.integration_types;
    }

    if (
        typeof command.nsfw === "boolean"
    ) {

        payload.nsfw =
            command.nsfw;
    }

    if (
        command.handler !== undefined &&
        command.handler !== null
    ) {

        payload.handler =
            command.handler;
    }

    return payload;
}

async function getEntryPointCommands() {

    const currentCommands =
        await rest.get(
            Routes.applicationCommands(CLIENT_ID)
        );

    if (
        !Array.isArray(currentCommands)
    ) return [];

    return currentCommands
        .filter(command =>
            command.type ===
            PRIMARY_ENTRY_POINT_COMMAND_TYPE
        )
        .map(keepEntryPointCommand);
}

(async () => {

    try {

        console.log("Registering commands...");

        const entryPointCommands =
            await getEntryPointCommands();

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: [
                    ...commands,
                    ...entryPointCommands
                ]
            }
        );

        console.log(
            `Commands registered (${commands.length} slash, ${entryPointCommands.length} entry point kept)`
        );

    } catch (err) {

        console.log(err);
    }

})();

/*
========================
LOAD EVENTS
========================
*/

const eventFiles = fs
    .readdirSync("./events")
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

client.login(TOKEN);
