const redis = require('redis');

// const Campaign = require('./schema/campaign')
// const Partner = require('./schema/partner')
// const config = require('./src/config/kafka-config');
const express = require("express");
const axios = require('axios');

const { createServer } = require("http");
const { Server } = require("socket.io");
const fs = require('fs');

const app = express();
const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

var count = 0;

// Define a simple route
app.get('/hey', (req, res) => {
    res.send('Hello, World!');
});

app.get('/gateway/socket.io', (req, res) => {

	res.send("through gateway")
});



app.post('/refresh', express.json(), async (req, res) => {
    
//    count += 1;
    const { id } = req.body;
  	console.log('am right here with id', id)
    res.status(200).send(`success refreshing cache`);
//    await redisClient.get("count", count.toString());
    await sendCachedDataToClients(id)
    
});


const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST'],
    },
});


// const kafka = new Kafka(config);
// const consumer = kafka.consumer({ groupId: 'project-greenplay-consumer-group-01' });
const redisClient = redis.createClient({
    socket: {
        host: 'localhost',
        port: 63791,
    }
    // url: "redis://projectgreenplayleaderboardcache-z22fwr.serverless.use1.cache.amazonaws.com:6379"
});


redisClient.on('error', err => console.log('Redis Client Error', err));

// Handle Socket.IO connections on the /leaderboard route
io.of('/gateway/socket.io').on('connection', (socket) => {
    console.log('A user connected to the leaderboard through gateway');
    
    // Handle socket events as needed
    socket.on('disconnect', () => {
        console.log('A user disconnected from the leaderboard through gateway!');
    });
});

io.on("connection", (socket) => {
    // console.log(socket.id);
    // const id = socket.id;
    socket.on("join-room", async (campaignID) => {
        console.log('campaignID', campaignID)
        if (!campaignID) {
            console.log('emitting to', socket.id)

            io.to(socket.id).emit('join-room', "please provide which leaderboard you would like to view");
            return;
        }
        console.log('shouldnt be here')

        socket.join(campaignID);
        socket.to(campaignID).emit('connectToRoom', "You are vieweing room " + campaignID);

        await sendCachedDataToClients(campaignID);
    })
    socket.on("disconnecting", () => {
        console.log(socket.rooms); // the Set contains at least the socket ID
    });

    socket.on("disconnect", () => {
        // socket.rooms.size === 0
    });
    // socket.on("create", (username, callback) => {
    //     const existingUser = users.find((user) => user.username === username);

    //     if (existingUser) return callback("This username is been taken!");
    //     const user = { id, username };
    //     users.push(user);
    //     console.log(`${id} create ${username}`);

    //     socket.on("load_users", () => {
    //         io.emit("send_users", users);
    //     });
    // });

    // socket.on("disconnect", () => {
    //     const id = socket.id;

    //     const index = users.findIndex((user) => user.id === id);

    //     if (index !== -1) {
    //         users.splice(index, 1)[0];
    //     }

    //     io.emit("send_users", users);
    // });
});

httpServer.listen(3005);

// const wss = new WebSocketServer({ port: 8081 }); // Adjust the port as needed

// wss.on('connection', (ws) => {
//     console.log('WebSocket client connected');
//     ws.send("connected");

//     ws.on('message', (message) => {
//         // Handle WebSocket messages from the client if needed
//     });
// });


async function consumeMessages(topic) {
    // await consumer.connect();
    // await consumer.subscribe({ topic, fromBeginning: true });

    // await consumer.run({
    //     eachMessage: async ({ topic, partition, message }) => {
    //         const value = JSON.parse(message.value.toString());
    //         await consumer.commitOffsets([{ topic, partition, offset: message.offset + 1 }]);

    //         // console.log('value', value)
    //         // const campaign = await Campaign.findOne({ campaignID: value.campaignID });

    //         // var partnerIndex = campaign.registeredPartners.findIndex(p => p.id === value.id);

    //         // if (partnerIndex === -1)
    //         //     return res.status(404).json({ status: 404, error: 'Partner not registered for this campaign' });

    //         try {
    //             // partner.currentNumber += Number.parseInt(progress);
    //             // campaign.registeredPartners[partnerIndex] = partner;
    //             // await kafkaProducer.produceMessage(JSON.stringify(partner));

    //             // await Campaign(value.campaign).save();
    //             // await Partner(value.partner).save();
    //             // console.log('value', value.campaign._id.toString())

    //             await redisClient.set(value.campaign._id.toString(), JSON.stringify(value.campaign));
    //             // console.log('saved')

    //             await sendCachedDataToClients(value.campaign._id.toString());

    //         }
    //         catch (e) {
    //             throw e;
    //         }


    //         // wss.clients.forEach((client) => {

    //         //     try{
    //         //         if (client.readyState === 1) {
    //         //             client.send(value);
    //         //             console.log('\n\nclient.readyState', client.readyState)

    //         //         }
    //         //     }
    //         //     catch (e){
    //         //         console.log('e', e)

    //         //     }


    //         // });
    //         // Process and handle the Kafka message as needed

    //     },
    // });
}

async function sendCachedDataToClients(campaignID) {
    console.log('abt to call')
    if (!campaignID) {
        io.to(campaignID).emit('leaderboardData', { message: "please provide which leaderboard you would like to view" }.toString());
        return;
    }
    var value;
    try {
        value = await redisClient.get(campaignID);
        if (value) {
            // console.log('value: ', value)
            io.to(campaignID).emit('leaderboardData', value.toString());

        }

        else {
            console.log('didnt find')
            console.log(campaignID)

            try {
                
                const campaignResponse = await axios.get(`http://localhost:3001/api/v1/campaign/${campaignID}`);
                console.log('am here')

                if (campaignResponse.data && campaignResponse.data.data) {
                    console.log('found from backend', campaignResponse.data.data)

                    await redisClient.set(campaignID, JSON.stringify(campaignResponse.data.data));
                    console.log('saved to redis')

                    io.to(campaignID).emit('leaderboardData', campaignResponse.data.data.toString());
                    console.log('check frontend')

                    return;
                }
                value = { status: 404, error: "Campaign Doesn't exist" };
                console.log('Campaign Doesnt exist')

                io.to(campaignID).emit('leaderboardData', value.toString());
                return;
            }
            catch (e) {
                console.log('e', e.response.data)
                value = { status: e.response.data.status, error: e.response.data.message };
                io.to(campaignID).emit('leaderboardData', value.toString());
                return;
            }
        }
        // value = { status: 404, error: "Campaign Doesn't exist" };
        // io.to(campaignID).emit('leaderboardData', value.toString());
        // return;
    }
    catch (e) {
        value = e.toString();
        io.to(campaignID).emit('leaderboardData', value.toString());
        return;
    }

    // io.to(campaignID).emit('leaderboardData',value.toString());

    // return;
    // wss.clients.forEach((client) => {

    //     if (client.readyState === 1) {

    //         client.send(value);
    //     }
    // });

    // await redisClient.get('cachedData', (error, data) => {
    //     if (error) {
    //         console.error('Error fetching cached data from Redis:', error);
    //         return;
    //     }
    //     console.log('data', data)
    //     // Send data to all connected WebSocket clients
    //     wss.clients.forEach((client) => {
    //         console.log('abt to send')

    //         if (client.readyState === 1) {
    //             console.log('sending')

    //             client.send(data);
    //         }
    //     });
    // });

}

// Set up periodic data update using a timer (adjust the interval)
// setInterval(sendCachedDataToClients, 1000); // Every 5 seconds



// consumeMessages(config.kafka_topic)
//     .then(async () => {
//         await redisClient.connect();
//         console.log('Kafka consumer is running');
//     })
//     .catch((error) => {
//         console.error('Error starting Kafka consumer:', error);
//     });

redisClient.connect().then(() => {
    console.log("redis is listening on port 3005")
}).catch((err) => {
    console.log(err)
})
