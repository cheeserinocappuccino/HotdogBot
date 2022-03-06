module.exports = {
    'name': 'ping',
    'description': 'A basic command for testing.',
    execute(message, args, dbContext){
        message.channel.send('pong');
    }

}