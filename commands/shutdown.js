
function GetAdmin_p(dbConnection, message) {

    // 此sql意旨抓出所有在此群組有權限且發送此指令的該Admin
    const getAdminSql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;

    return new Promise((resolve, reject) => {
        dbConnection.query(getAdminSql, (err, rows) => {

            if (err)
                return reject(err);
            else if (rows[0][0] == undefined)
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
    execute(message, inputs, tasksHandles, db) {
        // 關閉GuildMemberUpdates的功能，避免一改名子程式就想把改後的名子存到DB
        const originFunc = tasksHandles['GuildMemberUpdate']; //GuildMemberUpdates
        tasksHandles['GuildMemberUpdate'] = function () { };

        // 用來儲存資料庫抓的所有nickname
        let guildAllNickname;

        GetAdmin_p(db, message) // 確認此用戶是Admin
            .then(() => { return GetMembersNicknameInDb_p(db, message) }) // 抓出有在資料庫裡的該guild的user，在下一行存入guildAllNickname
            .then((map) => { guildAllNickname = map; return message.guild.members.fetch(); }) // 從discord api抓出該guild的所有user
            .then((eachmembers) => {
                // 用來儲存所有setNickName方法回傳的promise
                let allPromises = [];

                // 取得目前所有群組裡的人之後，filter掉不在語音群的
                let filteredMembers = eachmembers.filter(user => user.voice.channelId != undefined);

                // 以現在在語音群裡的人為基礎，去db的資料找每個user是否有存原始nickname在db
                // map is the return of last .then(), which is the return of GetMembersNicknameInDb_p(dbConnection, message)
                // map = SELECT user_id, nickname FROM .... WHERE guild_id = ...
                for (let mem of filteredMembers) {
                    // IMPORTANT NOTE BELOW
                    // mems[0] = user ID
                    // mem[1] = GuildMember Object
                    if (guildAllNickname.get(mem[0]) != undefined) {

                        const originName = guildAllNickname.get(mem[0]);
                        
                        // 將setNickName回傳的個別promise放進陣列，讓Promise.all判斷等到全數resolve才做下一步
                        allPromises.push(mem[1].setNickname(originName, "due to shutdown"));

                    }
                }
                // 模擬長時任務，測試時使用
                //allPromises.push(new Promise((resolve) => { setTimeout(resolve, 3000) }));     

                // 等待allPromises中存的promise事情都做完
                const p_all = Promise.all(allPromises);

                // promise後的.then(return //something)結束後，也是回傳一個Promise
                // 如果單寫p_all.then(()...)而非return p_all.then(()...)，會被最外層的Promise chain視為平行的分支
                // 就會被跳過先去運行外層的chain，造成allpromises.length還未被defined
                // 總之請記得每個then都要回傳一個promise型別，才會照順序運行
                return p_all.then(() => {
                    return allPromises.length;
                });
            })
            .then((nums) => {
                tasksHandles['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                console.log(`回復了 ${nums} 人的鳴子, 熱狗機器人休眠完成`);
                message.channel.send(`回復了 ${nums} 人的鳴子, 熱狗機器人休眠完成`);
                return;
            })
            .catch(rejection => {
                console.log(rejection);
                tasksHandles['GuildMemberUpdate'] = originFunc; // 做完事恢復聆聽user的改動
                message.channel.send("You are not a admin");
                return;
            });

        

    }

}