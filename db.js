const appSettings = require('./app-settings.json');
var mysql = require('mysql2');

var dbContext = mysql.createConnection(appSettings['mysqlConnection']);

dbContext.connect(function (err) {
    if (err) throw err;

    console.log("mysql server Connected");

});
module.exports = dbContext;
