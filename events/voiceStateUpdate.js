const {
    handleVoiceStateUpdate
} = require(
    "../games/voiceconnect/voiceManager"
);

module.exports = {

    name: "voiceStateUpdate",

    async execute(
        oldState,
        newState,
        client
    ) {

        return handleVoiceStateUpdate(
            oldState,
            newState,
            client
        );
    }
};
