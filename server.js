const express = require('express');
const redis = require('redis');
const mysql = require('mysql');
const crypto = require('crypto');
const app = express();

const port = 5000;
let isDBConnected = false;
let isRedisConnected = false;

// create connection to database
const dbConn = mysql.createConnection({
    host: 'localhost',
    user: 'geek',
    password: process.env.QUERY_DB_PASS, //store your credentials somewhere safe
    database: 'employees'
});


// connect to database
dbConn.connect((err) => {
    if (err) {
        console.error(err);
    } else {
        isDBConnected = true;
        console.log('Connected to database');
    }
});

// create and connect redis client to local instance.
const redisClient = redis.createClient({password: process.env.QUERY_REDIS_PASS}); //store your credentials somewhere safe

// Print redis errors to the console
redisClient.on('error', (err) => {
    isRedisConnected = false;
    console.error(err);
}).on('connect', () => {
    isRedisConnected = true;
    console.log('Connected to Redis');
});

//Query data
function doQuery(req, res, next) {
    if(!isDBConnected || !isRedisConnected) {
        res.send("Server not connected");
    }

    //query from MySQL
    let query = `select * from employees.employees e where last_name like '%${req.query.name}%'`;
    let key = crypto.createHash('sha1')
        .update(query)
        .digest('hex');
    
    // check if the     
    redisClient.exists(key, (err, isExist) => {
        if (isExist === 1) {
            console.log('Feeling lucky, key found in Redis');

            //measure time against Redis
            console.time('CacheQuery');
            redisClient.get(key, function (err, reply) {
                //end measure time of query against MySQL
                console.timeEnd('CacheQuery');

                if(err) {
                    next(err);
                } else {
                    res.send(reply);
                }
            });
        } else if (err) {
            next(err);
        } else {
            console.log('No luck, get the data from DB');
            //measure time against MySQL
            console.time('DBQuery');
            dbConn.query(query, (err, result) => {
                //end measure time of query against MySQL
                console.timeEnd('DBQuery');
                if (err) {
                    next(err);
                } else {
                    const data = JSON.stringify(result);
                    redisClient.set(key, data, function (err, reply) {
                        if(err) {
                            next(err);
                        } else {
                            redis.print
                        }
                    });    

                    res.send(data);
                }
            });
        }
    });
};

app.set('port', process.env.port || port); // set express to use this port

// configure middleware
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/query', doQuery);

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});