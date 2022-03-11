const { promise } = require("../db");


module.exports = {
    "name": "apply",
    "description": "For manually changing all user's nickname with channel prefix",
    execute(message, inputs, tasksHandles, db) {
        // 關閉GuildMemberUpdates的功能，避免一改名子程式就想把改後的名子存到DB
        const originFunc = tasksHandles['GuildMemberUpdate']; //GuildMemberUpdates
        tasksHandles['GuildMemberUpdate'] = function () { };


        let dbNameMap;
        let allmembers;

        // 先確認發訊息者是admin，否則直接return reject
        CheckAdmin(message, db)
            // sql: 取得該伺服器的所有原名資料
            // 處理: 承上，將原名資料改為Map結構，key為user_id, value 為 originame
            .then(() => { return GetOriginName(message, db) })

            // discord api : 把所有人抓出來
            .then(map => { dbNameMap = map; return message.guild.members.fetch() })

            // discord api : 過濾為有在語音頻道的人
            .then(members => { return members.filter(user => user.voice.channelId != undefined) })

            // 承上的discord資料，跑迴圈，若有在sql提供的map裡，改回原名
            .then(members => { allmembers = members; return SetToOriginName(members, dbNameMap) })

            // 抓出群組中每個頻道
            .then(() => { return message.guild.channels.fetch() })

            // 將群組中頻道過濾為剩下語音頻道
            .then((channels) => { return channels.filter(c => c.type == 'GUILD_VOICE') })

            // 從DB拿每一個channel的prefix，並存到channelPrefixMap，回傳給下一個then
            .then(channels => { return GetChannelPrefixsMap(channels, db); })

            // 開始逐一修改暱稱
            .then(channelPrefixsMap => {return ApplyPrefixNickName(channelPrefixsMap, dbNameMap, allmembers);})

            // 結束
            .then(nums => {
                tasksHandles['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                console.log(`Finished apply.`);
                message.channel.send(`修改了 ${nums} 人的鳴子`);
                return;
            })

            // catch
            .catch(err => {
                tasksHandles['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                console.log(err);
                return;
            });

    }

}

function CheckAdmin(message, db) {
    return new Promise((resolve, reject) => {
        const sql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;

        db.query(sql, (err, rows) => {
            if (err)
                return reject(err + " from apply.checkAdmin");
            if (rows[0][0] == undefined) {
                message.channel.send(`Admin才可使用此指令`);
                return reject(`A non-admin ${message.author.username} tried to use command "apply"`);
            }

            return resolve();

        })

    })

}

function GetOriginName(message, db) {
    return new Promise((resolve, reject) => {
        const sql = `CALL GetAllGuildMember(${message.guildId})`;

        db.query(sql, (err, rows) => {
            if (err)
                return reject(err);
            if (rows[0][0] == undefined)
                return reject('No member found in db');

            const m = new Map();

            for (let pair of rows[0]) {
                m.set(pair['user_id'], pair['usernickname']);
            }
            return resolve(m);

        })
    })
}
function SetToOriginName(members, dbNameMap) {
    let allPromises = [];

    return new Promise((resolve, reject) => {
        for (let mem of members) {

            if (dbNameMap.get(mem[0]) != undefined) {
                let originName = dbNameMap.get(mem[0]);

                allPromises.push(mem[1].setNickname(originName, "due to prepare apply"));
            }
        }
        const p_a = Promise.all(allPromises);
        p_a.then(() => {
            return resolve(members);
        })
    })
}

function GetChannelPrefixsMap(channels, db) {

    let channelPrefixsMap = new Map();
    const promiseArr = [];
    for (let channel of channels) {
        const c_id = channel[0];
        const g_id = channel[1].guild.id;

        if (channelPrefixsMap.get(channel[0]) == undefined) {

            // sql語句，查看該語音channel是否有設定
            const sql = `CALL GetChannelId(${c_id}, ${g_id})`;

            const p = new Promise((resolve, reject) => {
                db.query(sql, (err, rows) => {
                    if (err)
                        reject(err);
                    else if (rows[0][0] == undefined)
                        resolve();
                    else {
                        channelPrefixsMap.set(c_id, rows[0][0]['specialemoji']);

                        resolve();
                    }

                })
            })
            promiseArr.push(p);
        }
    }
    const p_all = Promise.all(promiseArr);
    return p_all.then(() => {
        return channelPrefixsMap;
    })

}

function ApplyPrefixNickName(channelPrefixsMap,dbNameMap, allmembers) {
    const promiseArr = [];
    let chNameCount = 0;
    for (let mem of allmembers) {

        const mem_id = mem[0];
        const mem_obj = mem[1];

        const originName = dbNameMap.get(mem_id);
        const prefix = channelPrefixsMap.get(mem_obj.voice.channelId);
        const n = prefix + "" + originName;
        if (prefix != undefined) {
            chNameCount++;
            promiseArr.push(mem_obj.setNickname(n, "due to apply"));
        }

    }

    const p_all = Promise.all(promiseArr);
    return p_all.then(() => {
        return chNameCount;
    })
}






