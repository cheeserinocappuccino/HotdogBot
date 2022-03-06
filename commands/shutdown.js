function GetDbConnection_p(dbContext) {
    return new Promise((resolve, reject) => {
        connection = dbContext.connect((err) => {
            if (err)
                reject(err);

            resolve(connection);
        })

    })
}

function GetAdmin_p(dbConnection, message) {
    // 此sql意旨抓出所有在此群組有權限且發送此指令的該Admin
    const getAdminSql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;
    return new Promise((resolve, reject) => {
        dbConnection.query(getAdminSql, (err, rows) => {
            if (err)
                return reject(err);
            if (rows[0] == undefined)
                return reject('not a admin');

            return resolve(rows, dbConnection);

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
            for (let mem of rows) {
                map.set(mem['user_id'], mem['usernickname']);
            }

            return resolve(map, dbConnection);
        });

    });

}

module.exports = {
    "name": "shutdown",
    "description": "A command for admin to shutdown bot, clean all stats apply to other user.",
    execute(message, args, dbContext) {
        // 改nickname之前，先避免guildMemberUpdate聽到這次事件
        fc_disableChangNicknameListener = true;
        /*
        // 此sql意旨抓出所有在此群組有權限且發送此指令的該Admin
        //const getAdminSql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;
        // 此sql意旨抓出所有在此群組的人
        //const getMembersSql = `CALL GetAllGuildMember(${message.guildId})`;

        // alluserArr存放資料庫撈到的所有人
        let allusersArr;*/


        GetDbConnection_p(dbContext) // 先連線
            .then(dbConnection => { return GetAdmin_p(dbConnection, message); }) // 然後確認此用戶是Admin
            .then((rows, dbConnection) => { return GetMembersNicknameInDb_p(dbConnection, message) }) // 抓出有在資料庫裡的該guild的user
            .then((map, dbConnection) => {
                let p = message.guild.members.fetch().filter(m => m.voice.channelId != undefined);// 抓出群組所有人並過濾成有在語音頻道的人
                p.then(eachmembers => {
                    // 取得包了目前所有在語音群的人的promise之後，逐一更改用戶nickname
                    for (let mem of eachmembers) {
                        if (map.get(mem) != undefined) {

                            const originName = map.get(mem);

                            mem.setNickname(originName, "due to shutdown")
                                .catch(e => console.log("shutdown user " + userdbname + " failed"));
                        }
                    }
                });
            })
            .then(() => fc_disableChangNicknameListener = false)
            .catch(rejection => { console.log(rejection); return; });



        /* dbContext.connect(function (err) {

            // check if the message is from admin;
            dbContext.query(getAdminSql, function (err, rows, result) {
                if (err) throw err;
                if (rows[0] == undefined) 
                    return;
            });


            dbContext.query(getMembersSql, function (err, rows, result) {
                if (err) throw err;
                allusersArr = rows;

                // 在console顯示所有撈到的人
                for (let i = 0; i < allusersArr.length; i++) {
                    console.log(allusersArr[i]['usernickname'] + " <<userName" + allusersArr[i]['user_id'] + " << userID")
                }
                
                // 對每個alluserArr的user做事情
                for(let j = 0; j < allusersArr.length; j++)
                {
                    // 用fetch功能拿單一user的object，此方法回傳promise
                    let usernowPromise = message.guild.members.fetch(allusersArr[j]['user_id']);
                    // 預先備好db內的username
                    let memberdbname = allusersArr[j]['usernickname'];
                    
                        // 用eachmember存取promise內包含的Guildmember物件
                        usernowPromise.then(function(eachmember){
                            
                            // 先確認user還有沒有在語音群內
                            if(eachmember.voice.channelId == undefined)
                                return;
                            
                            // 有在語音群內的話，把它名子改回db內存的名子
                            eachmember.setNickname(memberdbname, "due to shutdown")
                                            .catch(e => console.log("shutdown user " + userdbname + " failed"));

                        })

                    
                }

                

            });
        });
         */

        // 5秒後把guildMemberUpdate的listening改回來
        /*setTimeout(function () {
            fc_disableChangNicknameListener = false;
        }, 5000)
        message.channel.send("熱狗機器人休眠完成");
        return;*/
    }

}