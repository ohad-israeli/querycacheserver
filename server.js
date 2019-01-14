const express = require('express');
const path = require('path');
const redis = require('redis');
const mysql = require('mysql');
var sha1 = require('sha1');
const app = express();

const port = 5000;

// create connection to database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'arun',
    password: 'password',
    database: 'employees'
});


// connect to database
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

// create and connect redis client to local instance.
const client = redis.createClient();
console.log('Connected to redis');

// Print redis errors to the console
client.on('error', (err) => {
    console.log("Error " + err);
});
client.flushall();

//Query data
function doQuery(req, res, next) {
    console.log('Start Query');
    //query from MySQL
    let query = `select * from employees.employees e where last_name like '%${req.query.name}%'`;
    let key = sha1(query);

    client.exists(key, (err, isExist) => {
        if (isExist) {
            console.log('Feeling lucky, key found in Redis');

            //mesure time against Redis
            console.time('CacheQuery');
            client.get(key, function (err, reply) {
                res.send(reply);
            });
            //end mesure time of query against MySQL
            console.timeEnd('CacheQuery');
            return;
        }
        else {
            console.log('No luck, get the data from DB');
            //mesure time against MySQL
            console.time('DBQuery');
            db.query(query, (err, result) => {
                if (err) {
                    res.redirect('/');
                }
                let data = JSON.stringify(result);
                res.send(data);
                //end mesure time of query against MySQL
                console.timeEnd('DBQuery');
                client.set(key, data, redis.print);
            });
        }
    });
};

// configure middleware
app.set('port', process.env.port || port); // set express to use this port

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/query', doQuery);

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});