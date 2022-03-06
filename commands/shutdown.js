
function GetAdmin_p(dbConnection, message) {

    // 此sql意旨抓出所有在此群組有權限且發送此指令的該Admin
    const getAdminSql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;
    
    return new Promise((resolve, reject) => {
        dbConnection.query(getAdminSql, (err, rows) => {

            if (err)
                return reject(err);
            else if (rows[0][0]  == undefined)
                return reject('not a admin');
            else
                return resolve();

        });

    })
}
function GetMembersNicknameInDb_p(dbConnection, message) {
    // 此sql意旨抓出所有在此群組有nickname在DB的人
    const getMembersSql = `CALL GetAllGuildMember(${message.guildId})`;

    return new Promise((resolve, reject) => {
        dbConnection.query(getMembersSql, (err, rows) => {
            if (err)
                return reject(err);

            // 先把rows轉成 map
            let map = new Map();
            for (let row of rows[0]) {
                map.set(row['user_id'], row['usernickname']);
            }

            return resolve(map);
        });

    });

}

module.exports = {
    "name": "shutdown",
    "description": "A command for admin to shutdown bot, clean all stats apply to other user.",
    execute(message, args, db) {
        const originFunc = args[1]['GuildMemberUpdate']; //GuildMemberUpdates
        args[1]['GuildMemberUpdate'] = function(){};
        

        GetAdmin_p(db, message) // 確認此用戶是Admin
            .then(() => { return GetMembersNicknameInDb_p(db, message) }) // 抓出有在資料庫裡的該guild的user
            .then((map) => {
                let p = message.guild.members.fetch();// 抓出群組所有人
                p.then(eachmembers => {
                    // 取得包了目前所有群組裡的人的promise之後，filter掉不在語音群的
                    let filteredMembers = eachmembers.filter(user => user.voice.channelId != undefined);

                    // 以現在在語音群裡的人為基礎，去db的資料找每個user是否有存原始nickname在db
                    // map is the return of last .then(), which is the return of GetMembersNicknameInDb_p(dbConnection, message)
                    // map = SELECT user_id, nickname FROM .... WHERE guild_id = ...
                    for (let mem of filteredMembers) {
                        // important notes below
                        // mems[0] = user ID
                        // mem[1] = GuildMember Object
                        if (map.get(mem[0]) != undefined) {

                            const originName = map.get(mem[0]);

                            mem[1].setNickname(originName, "due to shutdown")
                                .catch(e => console.log("shutdown user " + userdbname + " failed")); 
                        }
                    }
                })
                
            })
            .then(() => {
                args[1]['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                message.channel.send("熱狗機器人休眠完成");
            })
            .catch(rejection => { 
                console.log(rejection); 
                args[1]['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                message.channel.send("You are not a admin");
                return; 
            });

    }

}