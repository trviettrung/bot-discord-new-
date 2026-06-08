function startTimer(
    game,
    channel,
    onEnd
) {

    clearTimeout(game.timeout);

    game.timeout = setTimeout(
        async () => {

            await channel.send(
                `⏰ Hết thời gian`
            );

            onEnd();

        },
        30000
    );
}

module.exports = {
    startTimer
};