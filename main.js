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
    let sql = "INSERT INTO actionaudit(audit_id,actiontime,actiontype_id) VALUES(default,'" 
                + timenow + "',1);";

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
    console.log("voicechannel");
    
});


// login, keep this at the bottom of main()
client.login(appSettings['token']);