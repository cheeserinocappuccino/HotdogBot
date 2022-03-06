module.exports = {
    'name': 'ping',
    'description': 'A basic command for testing.',
    execute(message, args, db){
        message.channel.send('pong');
    }

}