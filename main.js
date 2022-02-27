const appSettings = require('./app-settings.json');
const mysql = require('mysql');
const Discord = require('discord.js');

const client = new Discord.Client({intents:["GUILDS","GUILD_MESSAGES","GUILD_PRESENCES","GUILD_VOICE_STATES"]});

// the command prefix for our bot. such as /mycommand or $mycommand
const prefix = '$';

// when the client emmited a event called 'ready', do something
client.once('ready', () => {
    console.log("Discord.client object event \'ready\.'");
    console.log("Hotdog is ready.");
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