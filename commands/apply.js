/* 

module.exports = {
    "name":"apply",
    "description": "For manually changing all user's nickname with channel prefix",
    execute(message, args, db){
        let dbNameMap;
        let allPromises = [];
        let serverPrefix;
        let memberInVoiceChannel;
        // 先確認發訊息者是admin，否則直接return reject
        CheckAdmin(message, db)
        // sql: 取得該伺服器的所有原名資料
        // 處理: 承上，將原名資料改為Map結構，key為user_id, value 為 originame
        .then(() => { return GetOriginName(message, db)})

        // discord api : 把所有人抓出來
        .then(map =>{dbNameMap = map; return message.guild.members.fetch()})
        
        // discord api : 過濾為有在語音頻道的人
        .then(members =>{ return members.filter(user => user.voice.channelId != undefined)})

        // 為了方便，將members存去外部變數
        .then(members =>{memberInVoiceChannel = members;})

        // 承上的discord資料，跑迴圈，若有在sql提供的map裡，改回原名
        .then(members =>{
            for(let mem in members)
            {
                if(dbNameMap.get(mem[0]) != undefined)
                {
                    let originName = + "" +dbNameMap.get(mem[0]);

                    allPromises.push(mem[1].setNickname(originName, "due to prepare apply"));
                }
            }
            return Promise.all(allPromise);
        })
       
        // 回傳Promise.all.then()

        // 收尾訊息

        // catch

    }

}

function CheckAdmin(message,db){
    return new Promise((resolve,reject) =>{
        const sql = `CALL CheckAdmin(${message.member.id},${message.guildId})`;

        db.query(sql, (err,rows) =>{
            if(err)
                return reject(err+  " from apply.checkAdmin");
            if(rows[0][0] == undefined)
                return reject('you are not a admin');
            
            return resolve();

        })

    })

}

function GetOriginName(message, db){
    return new Promise((resolve, reject) =>{
        const sql = `CALL GetAllGuildMember(${message.guildId})`;

        db.query(sql, (err, rows) => {
            if(err)
                return reject(err);
            if(rows[0][0] == undefined)
                return reject('No member found in db');
            
            const m = new Map();

            for(let pair of rows[0])
            {
                m.set(pair['user_id'], pair['usernickname']);
            }
            return resolve(m);

        })
    })
}
function GetChannelPrefix(member, db){
    return new Promise((resolve,reject) =>{
        const sql = `CALL GetChannelId (${member.voice.channelId}, ${member.guildId})`;
        db.query(sql, (err, rows) =>{
            if(err)
                return reject(err);
            
            return resolve(rows[0]['specialemoji']);

        })
    })
} */