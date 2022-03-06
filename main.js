const appSettings = require('./app-settings.json');
const mysql = require('mysql2');
const db = require('./db.js');
const Discord = require('discord.js');
const fs = require('fs');

const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES", "GUILD_VOICE_STATES", "GUILD_MEMBERS"] });

// (start) To get commands in other files
client['myCommands'] = new Discord.Collection();

const commandsFile = fs.readdirSync('./commands/').filter(f => f.endsWith('.js'));

for(const filename of commandsFile)
{
    const eachCommand = require(`./commands/${filename}`);
    client.myCommands.set(eachCommand.name, eachCommand);
}

console.log('loaded ' + commandsFile.length + ' command files');

// (end) To get commands in other files

// Used for disabling certain listener;
var fc_disableChangNicknameListener = false;

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
    if(commandObject == undefined)
        return;

    // execute the command by calling methods in objects
    client.myCommands.get(command).execute(message, input);
  
    return;
}); 

// Listen to member join/leaving voice channel
// needs GUILD_VOICE_STATES option to work when initializing Discord.Client
client.on('voiceStateUpdate', (oldState, newState) => {
    // 設定只在有進出頻道時才啟動，否則return不做事
    if (oldState.channelId == newState.channelId)
        return;

    if (newState.member.id == newState.guild.ownerId) {
        console.log("owner action, aborting");
        return;

    }
    /*if(newState.member.nickname == undefined)
    {
        console.log("pepople with no nickname got in");
        return;
    }*/
    if (newState.member.id == 477998202206027777)
        return;


    // 改nickname之前，先避免guildMemberUpdate聽到這次事件
    fc_disableChangNicknameListener = true;

    // 用於存取DB內的名子
    var originName;


    // 初次進入任一語音頻道時
    if (oldState.channelId == undefined && newState.channelId != undefined) {
        // 儲存原本的Nickname

        let name = newState.member.nickname == undefined ? newState.member.user.username : newState.member.nickname;
        const storeOriginNamesql = "CALL SaveOriginName(" + newState.member.id.toString() +
            ", " + newState.guild.id.toString() + ", '"
            + name + "');";

        dbContext.query(storeOriginNamesql, function (err, rows, result) {
            if (err) throw err;
            console.log("Storeing current name")
        });
    }

    // 任何更換頻道的事情，剛開始的瞬間皆從DB拿回本名
    const restoreNicknamesql = "SELECT usernickname FROM channel_username_store WHERE user_id = " +
        newState.member.id.toString();

    dbContext.connect(function (err) {

        dbContext.query(restoreNicknamesql, function (err, rows, result) {
            if (err) throw err;
            try {
                originName = rows[0]['usernickname'];
            } catch {
                console.log("Can't find user origin nickname");
                //return;
            }

            if (originName != undefined)
                newState.member.setNickname(originName, "backtonormal").catch(e => console.log("can't change owner"));

            console.log("Restored nickname for " + originName);
        });
    });




    //若非退出語音頻道(也就是單純切換), 額外做下面的事情
    if (newState.channelId != undefined) {


        dbContext.connect(function (err) {

            const sql = "SELECT * FROM channel_setting WHERE channel_id = " + newState.channelId +
                "&& guild_id =" + newState.guild;

            // execute the query
            let emoji;
            dbContext.query(sql, function (err, rows, result) {
                if (err) throw err;
                try {
                    emoji = rows[0]['specialemoji'];
                } catch {
                    // 如果沒有找到emoji
                    console.log("Some one joined voice channel: " + newState.channel.name +
                        "  ,but no channel setting found for this one");
                    return;
                }




                // 如果有找到emoji的話
                if (emoji != undefined) {

                    //client.channels.cache.get('638705738314809384').send(emoji + " debug");


                    console.log("selecting emoji");

                    let newName = emoji + "" + originName;



                    // 改nickname
                    setTimeout(function () {
                        newState.member.setNickname(newName, "enter sausage").catch(e => console.log("can't change owner"));
                    }, 100)

                    

                }

            });


        })

    }
    // 1秒後把guildMemberUpdate的listening改回來
    setTimeout(function () {
        fc_disableChangNicknameListener = false;
    }, 1000)
    return;
});




/* // Fire whenever a guild member changes
client.on('guildMemberUpdate', (oldMember, newMember) => {
    // voiceStateUpdate use this to temporary disable nickname storage
    // other wise guildMemberUpdate will store the modified nickname imediately;
    if (fc_disableChangNicknameListener == true)
        return;
    if (newMember.id == 477998202206027777)
        return;

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

        dbContext.query(storeOriginNamesql, function (err, rows, result) {
            if (err) throw err;
            return;
        });
    }
    return;
}) */

// Fire when bot joined a Guild
client.on('guildCreate', guild => {

    dbContext.connect(function (err) {
        // create a query to insert a record to audit table and set time = now, type = 3(joinedguild)
        let timenow = new Date().toISOString().slice(0, 19).replace("T", " ");
        let sql = "INSERT INTO actionaudit VALUES(default,'"
            + timenow + "',1,'Bot Joined Guild: " + guild.name + " id = " + guild.id + " ' , 'client');";

        // execute the query
        dbContext.query(sql, function (err, result) {
            if (err) throw err;
            console.log("Bot joined a server");
        });
    });
    return;
});


// login, keep this at the bottom of main()
client.login(appSettings['token']);