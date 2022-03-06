module.exports = {
    "name": "prefix",
    'description': 'A command to set channel\'s prefix emoji or text',
    execute(message, args, dbContext){
        if (args[1].length > 20) {
            message.channel.send("字數過長");
            return;
        }
        else if (message.member.voice.channelId == undefined) {
            message.channel.send("請進入語音頻道再做此設定")
            return;
        }

        console.log("Adding emoji to database");
        /*let sql = "CALL SaveChannelSettings(" + message.member.voice.channelId.toString() +
            ", " + message.member.guild.id.toString() + ", '"
            + args[1] + "');";*/
        let sql = `CALL SaveChannelSettings(${message.member.voice.channelId.toString()},
                                                ${message.member.guild.id.toString()},
                                                '${args[1]}')`;
        dbContext.query(sql, function (err, rows, result) {
            if (err) throw err;
        });

        message.channel.send("語音頻道 " + message.member.voice.channel.name + " 的前綴已經設定為: " + args[1]);
    }

}