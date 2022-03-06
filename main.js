const appSettings = require('./app-settings.json');
const mysql = require('mysql2');
const db = require('./db.js');
const Discord = require('discord.js');
const fs = require('fs');
const { promise } = require('./db.js');
const { resolve } = require('path');

const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES", "GUILD_VOICE_STATES", "GUILD_MEMBERS"] });

// (start) To get commands in other files
client['myCommands'] = new Discord.Collection();

const commandsFile = fs.readdirSync('./commands/').filter(f => f.endsWith('.js'));

for (const filename of commandsFile) {
    const eachCommand = require(`./commands/${filename}`);
    client.myCommands.set(eachCommand.name, eachCommand);
}

console.log('loaded ' + commandsFile.length + ' command files');
// (end) To get commands in other files

// the command prefix for our bot. such as /mycommand or $mycommand
const prefix = '!';
// when the client emmited a event called 'ready', do something
client.once('ready', () => {
    console.log("Hotdog bot is ready.");
});

// Listen to messageCreate, and when it is emmited, get the message for us to process
client.on('messageCreate', (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        // do nothing because it does not start with our prefix.
        return;
    }
    if (message.member.id == 477998202206027777)
        return;

    // pre process commands 
    // input is a array of command + all other arguments user typed in channel.
    const input = message.content.slice(prefix.length).split(/ +/);
    // command is the first text user type in channel that might trigger action, such as !ping, !prefix, !shudown
    const command = input[0].toLowerCase();


    // check if the user typed command exist
    const commandObject = client.myCommands.get(command);
    if (commandObject == undefined)
        return;

    // tasksToSuspend是執行特定任務時需要暫時被關閉的功能
    const tasksToSuspend = {
        "GuildMemberUpdate": GuildMemberUpdates
    }
    const args = [input, tasksToSuspend]
    // execute the command by calling methods in objects
    // execute(message, args, db)
    // args[0] = input[] | args[1] = tasksToSuspend[]
    client.myCommands.get(command).execute(message, args, db);

    return;
});


// user更改頻道時就會發動
// 這個事件需要在initialize Discord.Client的時候包含GUILD_VOICE_STATES option，才會運作
client.on('voiceStateUpdate', (oldState, newState) => {
    // 設定只在有進出頻道時才啟動，否則return不做事
    if (oldState.channelId == newState.channelId)
        return;

    if (newState.member.id == newState.guild.ownerId) {
        console.log("owner action, aborting");
        return;
    }

    
    // 暫時關閉GuildMemberUpdates (使function內容為空)
    const originGMU = GuildMemberUpdates;
    GuildMemberUpdates = function () { };
    
   

    // 用來暫放GetNameForChangedStateUser的回傳
    let gl_OriginName;
    // 檢查是否為第一次進入任一語音頻道，若有，儲存被bot修改前的本名，若無則繼續
    FirstInVoiceChannel(oldState, newState)
        .then(() => { return GetNameForChangedStateUser(oldState, newState) })// 接著，先從DB拿回本名
        .then(originName => { gl_OriginName = originName; console.log('ch originName'); return newState.member.setNickname(originName, "backtonormal");}) // 利用上一句的回傳(origiName)，將user先設定為本名，若為退出頻道，只會運行到這句，下一句收到會直接return
        .then(guildMember => { return GetPrefixPlusUsername(oldState, newState, gl_OriginName) }) // 找到該語音群的prefix，傳給下一句
        .then(newName => {console.log('ch prefix') ;return newState.member.setNickname(newName, "enter prefixed channel") }) // 實際更改username
        .then(() =>{
            GuildMemberUpdates = originGMU;
            console.log("Finished change nickname");
        }) // 事情結束，將GuildMemberUpdates恢復原狀
        .catch(err => console.log(err + " --rejected from VoiceStateUpdate")) // resolve上面任何一串的reject

});

// Fire whenever a guild member changes
client.on('guildMemberUpdate', (oldMember, newMember) => {
    GuildMemberUpdates(oldMember, newMember)
    return;
})

// Functions --------------------------------------------------------------
function GuildMemberUpdates(oldMember, newMember) {

    console.log("detect manual guildmemberUpdate");

    // Do shit when any user changed their nickname
    if (newMember.nickname != oldMember.nickname) {

        let uname = newMember.nickname == undefined ? newMember.user.username : newMember.nickname;
        console.log("A user Changed their nickname to: "
            + uname + " , initialize new nickname db storing");



        // 儲存修改完的Nickname作為退出語音群時的設定
        const storeOriginNamesql = "CALL SaveOriginName(" + newMember.id.toString() +
            ", " + newMember.guild.id.toString() + ", '"
            + uname + "');";

        db.query(storeOriginNamesql, function (err, rows, result) {
            if (err) throw err;
            return;
        });
    }
}

function FirstInVoiceChannel(oldState, newState) {
    // 若為初次進入頻道...
    return new Promise((resolve, reject) => {
        // 設定為只有在初次進入語音頻道才執行將原名存入DB的事情
        if (!(oldState.channelId == undefined && newState.channelId != undefined))
            return resolve();

        // 如果user沒有nickname, 就將原名設定為帳號名
        let name = newState.member.nickname == undefined ? newState.member.user.username : newState.member.nickname;
        // sql語句，用來儲存修改前的原名
        const storeOriginNamesql = `Call SaveOriginName(${newState.member.id.toString()}, ${newState.guild.id.toString()},'${name}')`;
        // 執行儲存修改前的原名
        db.query(storeOriginNamesql, function (err, rows, result) {
            if (err)
                return reject(err + " from getPrefixPlusUsername");
            else {
                console.log("Saved nickname for " + name);
                return resolve();
            }


        });

    })
}

function GetNameForChangedStateUser(oldState, newState) {

    // sql語句，用來取得該user的本名
    const restoreNicknamesql = `CALL GetUserOriginNickName(${newState.member.id}, ${newState.guild.id})`;

    // 執行sql，取得本名並利用Promise的resolved回傳
    return new Promise((resolve, reject) => {

        db.query(restoreNicknamesql, function (err, rows) {
            if (err)
                return reject(err + " from getPrefixPlusUsername");
            else if (rows[0][0]['usernickname'] == undefined)
                return reject("Can't find user origin nickname")

            const originName = rows[0][0]['usernickname'];
            console.log("this user's originName = " + originName);
            return resolve(originName)
            

        });

    });
}

function GetPrefixPlusUsername(oldState, newState, originName) {

    return new Promise((resolve, reject) => {
        // 若為退出頻道，這個function不用做事
        if (newState.channelId == undefined)
            return resolve();
        // 若非退出語音頻道(也就是單純切換於兩個語音頻道，或者剛加入頻道),做下面的事情，將prefix加入userName中

        // sql語句，查看該語音channel是否有設定
        const sql = `CALL GetChannelId(${newState.channelId}, ${newState.guild.id})`

        // execute the query
        db.query(sql, function (err, rows, result) {
            if (err)
                return reject(err + " from getPrefixPlusUsername");
            else if (rows[0][0]['specialemoji'] == undefined)
                return reject('有人加入語音群,但此語音群沒有設定的prefix');

            // 若有找到prefix，將他加入username中，並利用resolve()回傳
            const prefix = rows[0][0]['specialemoji'];
            const newName = prefix + "" + originName;

            console.log("Assembled new name.");
            return resolve(newName);

        });

    })
}



// login, keep this at the bottom of main()
client.login(appSettings['token']);