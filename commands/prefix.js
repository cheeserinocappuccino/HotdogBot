module.exports = {
    "name": "prefix",
    'description': 'A command to set channel\'s prefix emoji or text',
    execute(message, inputs, tasksHandles, db) {

        if (message.member.voice.channelId == undefined) {
            message.channel.send("請進入語音頻道再做此設定")
            return;
        }

        console.log("Adding emoji to database");
        let prefixString = "";
        for (let i = 1; i < inputs.length; i++) {

            if (inputs[i].length > 20) {
                message.channel.send("字數過長");
                break;
            }

            prefixString += inputs[i];

            // 暫時限制設定時只能堆疊五次prefix
            if (i >= 5)
                break;
        }

        let sql = `CALL SaveChannelSettings(${message.member.voice.channelId.toString()},
                                                ${message.member.guild.id.toString()},
                                                '${prefixString}')`;

        const p = new Promise((resolve, reject) => {
            db.query(sql, function (err, rows, result) {
                if (err) {
                    return reject(err);
                }
                else {
                    return resolve();
                }
            });
        })

        p.then(() => {
            message.channel.send("語音頻道 " + message.member.voice.channel.name + " 的前綴已經設定為: " + prefixString);
            return;
        });

    }

}