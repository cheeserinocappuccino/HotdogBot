
// Async forloop https://stackoverflow.com/questions/40328932/javascript-es6-promise-for-loop
function CheckAdmin(message, db, adminBypassIdentifier) {
    return new Promise((resolve, reject) => {
        const sql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;

        db.query(sql, (err, rows) => {
            if (err)
                return reject(err + " from apply.checkAdmin");
            if (rows[0][0] == undefined && !adminBypassIdentifier) {
                message.channel.send(`Admin才可使用此指令`);
                return reject(`A non-admin ${message.author.username} tried to use command "apply"`);
            }

            return resolve();
        })
    })
}

function CheckValidTarget(message, userTarget) {
    return new Promise((resolve, reject) => {

        message.guild.members.fetch(userTarget)
            .then(user => {
                if (user == undefined)
                    reject('User不存在');
                resolve(user);
            }).catch(() => {
                console.log("User不存在")
                reject('User不存在')
            }
            )

    })
}


const funcs = {
    "channel": ChannelCycle
}
module.exports = {
    "name": 'cycle',
    "description": "cycle by user specified function",
    execute(message, inputs, tasksHandles, db) {
        // 防止漏打參數
        if (inputs[1] == undefined | inputs[2] == undefined | inputs[3] == undefined | inputs[4] == undefined) {
            message.channel.send(`格式不對，請輸入 !cycle [提及] [功能] [次數] [間隔(毫秒)]
            例如: !cycle <@947333928417628250> channel 100 1000 ， 會讓被提及的人每1000毫秒被移動1次，直到移動了100次`);
            return;
        }


        // 第一個參數，指定誰要被影響
        const userTarget = inputs[1].replaceAll(/\D/g, "");
        // 第二個參數，指定要怎麼影響
        const userFuncSelect = inputs[2];
        // 第三個參數，指定要影響幾次
        const userTimesSelect = inputs[3];
        // 第四個參數，指定要影響之間間隔幾豪秒
        const userIntervalSelect = inputs[4];

        // 防止太誇張的值
        if (userTimesSelect <= 0 || userTimesSelect > 100) {
            message.channel.send('次數需介於1~100之間');
            return;
        }
        if (userIntervalSelect < 300 || userIntervalSelect > 10000) {
            message.channel.send("間格需大於300毫秒並小於10000毫秒");
            return
        }


        let cycleFunc;
        let memberObj;
        let channels_gl;
        // 先由user的指令決定要跑哪一個function
        // 如果user打錯字, 會default為ChannelCycle()
        if (funcs[userFuncSelect] == undefined)
            cycleFunc = funcs['channel'];
        else {
            cycleFunc = funcs[userFuncSelect];
        }

        CheckAdmin(message, db, false)
            .then(() => { return CheckValidTarget(message, userTarget) })

            .then(user_Obj => { return memberObj = user_Obj })

            .then(() => { return message.guild.channels.fetch().catch('no channel in guild'); })

            .then(channels => { return channels.filter(c => c.type == 'GUILD_VOICE') })

            .then(channels => { channels_gl = channels; return message.channel.send('開始cycle指令'); })

            .then((botMessageObj) => {
                console.log("start cycle");
                const channelArr = Array.from(channels_gl)
                // cycle
                for (let i = 0, p = Promise.resolve(); i < userTimesSelect; i++) {
                    p = p.then(() => cycleFunc(i, userTimesSelect, memberObj, userIntervalSelect, channelArr, botMessageObj));
                }
            })


            .catch((err) => {
                message.channel.send(err);
                console.log(err);
            })


    }
}

function ChannelCycle(i,userTimesSelect , memberObj, userIntervalSelect, channelArr, botMessageObj) {

    const allPromiseArr = [];

    let index = (i + 1) % channelArr.length;
    const channelObj = channelArr[index];

    let botmsg = `第 ${i + 1} 次 cycle指令`;
    if((i+1) == userTimesSelect)
        botmsg = `cycle指令結束，運行了${i+1}次`
        
    allPromiseArr.push(botMessageObj.edit(botmsg));
    
    const p = memberObj.voice.setChannel(channelObj[0]);
    allPromiseArr.push(p);

    const delay = new Promise(res => setTimeout(res, userIntervalSelect));

    const p_all = Promise.all(allPromiseArr);
    return p_all;


}