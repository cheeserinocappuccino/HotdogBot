const appSettings = require('./app-settings.json');
const mysql = require('mysql2');
const Discord = require('discord.js');

const client = new Discord.Client({intents:["GUILDS","GUILD_MESSAGES","GUILD_PRESENCES","GUILD_VOICE_STATES"]});

// connect to mysql
var dbContext = mysql.createConnection(appSettings['mysqlConnection']);
dbContext.connect(function(err) {
    if (err) throw err;

    console.log("mysql server Connected. Writing audit");

    // create a query to insert a record to audit table and set time = now, type = 1(server up)
    let timenow = new Date().toISOString().slice(0, 19).replace("T", " ");
    let sql = "INSERT INTO actionaudit VALUES(default,'" 
                + timenow + "',1, NULL, 'client')";

    // execute the query
    dbContext.query(sql, function(err, result){
        if(err) throw err;
        console.log("[server up] audit is inserted");
    });
});



// the command prefix for our bot. such as /mycommand or $mycommand
const prefix = '$';

// when the client emmited a event called 'ready', do something
client.once('ready', () => {
    console.log("Hotdog bot is ready.");
});

// Listen to messageCreate, and when it is emmited, get the message for us to process
client.on('messageCreate', (message) => 
{
    if(!message.content.startsWith(prefix)|| message.author.bot){
        // do nothing because it does not start with our prefix.
        return;
    }

    // pre process commands before processing;
    const input = message.content.slice(prefix.length).split(/ +/);
    const command = input.shift().toLowerCase();
    console.log("Received command \n raw =" + message.content + " \n input =" + input +"\n pure =" + command)
    
    if(command === 'ping')
    {
        message.channel.send('pong');
    }
});

// Listen to member join/leaving voice channel
// needs GUILD_VOICE_STATES option to work when initializing Discord.Client
client.on('voiceStateUpdate', (oldState, newState) =>
{
    // 退出語音時，newstate中的channel id會為空
    if(newState.channelId == undefined)
        return;

    //若非退出語音(也就是加入語音), 做下面的事情
    dbContext.connect(function(err){

        const sql = "SELECT * FROM channel_setting WHERE channel_id = " + newState.channelId +
                "&& guild_id =" + newState.guild;
        console.log("selecting emoji");
        // execute the query
        let emoji;
        dbContext.query(sql, function(err, rows, result){
            if(err) throw err;
            try{
                emoji = rows[0]['specialemoji'];
            }catch{
                console.log("Some one joined voice channel: " + newState.channel.name + 
                "  ,but no channel setting found for this one");
                return;
            }
            
            // 如果有找到emoji的話
            if(emoji != undefined)
            {
                client.channels.cache.get('638705738314809384').send(emoji + " hi");



            }
                
           
        });

        
    })

    
});

// Fire when bot joined a Guild
client.on('guildCreate', guild =>{

    dbContext.connect(function(err){
        // create a query to insert a record to audit table and set time = now, type = 3(joinedguild)
        let timenow = new Date().toISOString().slice(0, 19).replace("T", " ");
        let sql = "INSERT INTO actionaudit(audit_id,actiontime,actiontype_id) VALUES(default,'" 
                    + timenow + "',1, NUll, 'client');";

        // execute the query
        dbContext.query(sql, function(err, result){
            if(err) throw err;
            console.log("[server up] audit is inserted");
        });
    });

});


// login, keep this at the bottom of main()
client.login(appSettings['token']);