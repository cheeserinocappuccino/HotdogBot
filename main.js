const appSettings = require('./app-settings.json');
const mysql = require('mysql2');
const Discord = require('discord.js');

const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES", "GUILD_VOICE_STATES", "GUILD_MEMBERS"] });

// Used for disabling certain listener;
var fc_disableChangNicknameListener = false;

// connect to mysql
var dbContext = mysql.createConnection(appSettings['mysqlConnection']);
dbContext.connect(function (err) {
    if (err) throw err;

    console.log("mysql server Connected. Writing audit");

    // create a query to insert a record to audit table and set time = now, type = 1(server up)
    let timenow = new Date().toISOString().slice(0, 19).replace("T", " ");
    let sql = "INSERT INTO actionaudit VALUES(default,'"
        + timenow + "',1, NULL, 'client')";

    // execute the query
    dbContext.query(sql, function (err, result) {

        if (err) throw err;
        console.log("[server up] audit is inserted");
    });


});



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

    // pre process commands before processing;
    const input = message.content.slice(prefix.length).split(/ +/);
    const command = input[0].toLowerCase();
    console.log("Received command \n raw =" + message.content + " \n input =" + input + "\n pure =" + command)

    if (command === 'ping') {
        message.channel.send('pong');
    }

    if (command === 'prefix') {
        if (input[1].length > 20) {
            message.channel.send("字數過長");
            return;
        }
        else if (message.member.voice.channelId == undefined) {
            message.channel.send("請進入語音頻道再做此設定")
            return;
        }

        console.log("Adding emoji to database");
        let addChannelSettingsql = "CALL SaveChannelSettings(" + message.member.voice.channelId.toString() +
            ", " + message.member.guild.id.toString() + ", '"
            + input[1] + "');";

        dbContext.query(addChannelSettingsql, function (err, rows, result) {
            if (err) throw err;
        });

        message.channel.send("語音頻道 " + message.member.voice.channel.name + " 的前綴已經設定為: " + input[1]);
    }

    if(command === '俎達')
    {
        message.channel.send('');
    }
    return;
});

// Listen to member join/leaving voice channel
// needs GUILD_VOICE_STATES option to work when initializing Discord.Client
client.on('voiceStateUpdate', (oldState, newState) => {
    // 設定只在有進出頻道時才啟動，否則return不做事
    if (oldState.channelId == newState.channelId)
        return;
    
    if( newState.member.id == newState.guild.ownerId)
    {
        console.log("owner action, aborting");
        return;

    }
        
        

    // 改nickname之前，先避免guildMemberUpdate聽到這次事件
    fc_disableChangNicknameListener = true;

    // 用於存取DB內的名子
    var originName;
    

    // 初次進入任一語音頻道時
    if (oldState.channelId == undefined && newState.channelId != undefined) {
        // 儲存原本的Nickname
        const storeOriginNamesql = "CALL SaveOriginName(" + newState.member.id.toString() +
            ", " + newState.guild.id.toString() + ", '"
            + newState.member.nickname.toString() + "');";

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
                    }, 5)

                    // 1秒後把guildMemberUpdate的listening改回來

                }

            });


        })

    }
    setTimeout(function () {
        fc_disableChangNicknameListener = false;
    }, 1000)
    return;
});




// Fire whenever a guild member changes
client.on('guildMemberUpdate', (oldMember, newMember) => {
    // voiceStateUpdate use this do temporary disable nickname storage
    // other wise guildMemberUpdate will store the modified nickname imediately;
    if (fc_disableChangNicknameListener == true)
        return;


    console.log("detect manual guildmemberUpdate");

    // Do shit when any user changed their nickname
    if (newMember.nickname != oldMember.nickname /*&& newMember.voice.channelId != undefined*/) {

        console.log("User: " + oldMember.nickname + " Changed their nickname to: "
            + newMember.nickname + " , initialize new nickname db storing");

        // 儲存修改完的Nickname作為退出語音群時的設定
        const storeOriginNamesql = "CALL SaveOriginName(" + newMember.id.toString() +
            ", " + newMember.guild.id.toString() + ", '"
            + newMember.nickname.toString() + "');";

        dbContext.query(storeOriginNamesql, function (err, rows, result) {
            if (err) throw err;

        });
    }
    return;
})

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