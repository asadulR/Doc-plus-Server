const express = require('express')
const cors = require('cors');
require('dotenv').config();
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.im6xt.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run(){

    try{
        await client.connect();
        // console.log('database conected')
        const servicesCollection = client.db('doc+').collection("services");
        const bookingCollection = client.db('doc+').collection("bookings");
        const usersCollection = client.db('doc+').collection("users");

        app.get('/services', async(req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get('/available', async(req, res) => {
          const date = req.query.date;
          // get all services
          const services = await servicesCollection.find().toArray();

          // get the booking of the day
          const query = {date: date};

          const bookings = await bookingCollection.find(query).toArray();

          //  for each service, find bookings for that service
          services.forEach(service => {
            const serviceBookings = bookings.filter(b => b.treatment === service.name);
            const booked = serviceBookings.map(s => s.timeSlot);
            // service.booked = booked;

            const available = service.slots.filter(s => !booked.includes(s));
            // service.available = available;
            service.slots = available;
          })

          res.send(services);
        });


        // User collection 
        app.put('/users/:email', async(req, res) => {
          const email = req.params.email;
          const user = req.body;
          const filter = { email: email };
          const options = { upsert: true };


          const updateDoc = {
            $set: user
          };

          const result = await usersCollection.updateOne(filter, updateDoc, options);
          res.send(result);
        });

        app.get('/booking', async(req, res) =>{
          const patient = req.query.patient;
          const query = {patientEmail: patient};
          // console.log(query)
          const bookings = await bookingCollection.find(query).toArray();
          res.send(bookings);
        })

        app.post('/booking', async(req, res) => {
          const booking = req.body;
          const query = {treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail}
          // console.log(query)
          const exists = await bookingCollection.findOne(query);
          if(exists){
            return res.send({success: false, booking: exists})
          }
          const result = await bookingCollection.insertOne(booking);

          return res.send({success: true, result});
        })



    }
    finally{

    }
}

run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello from doctor!')
})



















app.listen(port, () => {
  console.log(`Doc+ app listening on port ${port}`)
})