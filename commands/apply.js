

module.exports = {
    "name": "apply",
    "description": "For manually changing all user's nickname with channel prefix",
    execute(message, inputs, tasksHandles, db) {
        // 關閉GuildMemberUpdates的功能，避免一改名子程式就想把改後的名子存到DB
        const originFunc = tasksHandles['GuildMemberUpdate']; //GuildMemberUpdates
        tasksHandles['GuildMemberUpdate'] = function () { };

        console.log(`${tasksHandles['GuildMemberUpdate'].toString()} +++++`);

        let dbNameMap;
        // 先確認發訊息者是admin，否則直接return reject
        CheckAdmin(message, db)
            // sql: 取得該伺服器的所有原名資料
            // 處理: 承上，將原名資料改為Map結構，key為user_id, value 為 originame
            .then(() => { return GetOriginName(message, db) })

            // discord api : 把所有人抓出來
            .then(map => { dbNameMap = map; return message.guild.members.fetch() })

            // discord api : 過濾為有在語音頻道的人
            .then(members => { return members.filter(user => user.voice.channelId != undefined) })

            // 為了方便，將members存去外部變數
            .then(members => { return new Promise(resolve => resolve(members)) })

            // 承上的discord資料，跑迴圈，若有在sql提供的map裡，改回原名
            .then(members => { return SetToOriginName(members, db, dbNameMap) })

            // 逐一在有人的channel裡取得prefix以及更改暱稱
            .then(members => { return GetPrefixAndApply(members, db, dbNameMap); })

            // 結束
            .then(nums => {
                tasksHandles['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                console.log(`Finished apply.`);
                message.channel.send(`修改了 ${nums} 人的鳴子, 熱狗機器人休眠完成`);
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
function SetToOriginName(members, db, dbNameMap) {
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

function GetPrefixAndApply(members, db, dbNameMap) {
    // Key : channelId
    // value : prefix
    const prefixMap = new Map();
    let promisesArr = [];

    return new Promise((resolve, reject) => {
        for (let member of members) {
            let c = '';

            // 取得該member所處的channel的ID，用try catch避免中途該member退出頻道
            try {

                c = member[1].voice.channelId;

                // 如果程式還不知道該member所處的頻道的prefix
                // query並存prefix進prefixMap裡
                if (prefixMap.get(c) == undefined) {

                    // sql語句，查看該語音channel是否有設定
                    const sql = `CALL GetChannelId(${member[1].voice.channelId}, ${member[1].guild.id})`

                    const p = new Promise((resolve, reject) => {
                        db.query(sql, (err, rows) => {
                            if (err)
                                /*return*/ reject(err);


                            /*return*/ resolve(rows[0][0]['specialemoji']);

                        });

                    })
                    // 將query到的prefix放進prefixMap
                    p.then((prefix => {
                        prefixMap.set(c, prefix);
                        let uname = dbNameMap.get(member[0]) == undefined ? member[1].user.username : dbNameMap.get(member[0]);
                        const n = prefix + "" + uname;
                        promisesArr.push(member[1].setNickname(n, "An apply command."));
                        //return;
                    }))

                }
                // 如果prefixMap.get(c)已有值
                else {
                    let prefix = prefixMap.get(c);
                    let uname = dbNameMap.get(member[0]) == undefined ? member[1].user.username : dbNameMap.get(member[0]);
                    const n = prefix + "" + uname;
                    promisesArr.push(member[1].setNickname(n, "An apply command."));
                }


            } catch {
                console.log('member state changed, try again.');
                return reject('member state changed, try again.');
            }
        }

        const p_all = Promise.all(promisesArr);

        p_all.then(() => { return resolve(promisesArr.length); });
        
    })





}