const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.im6xt.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function vrifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthoridzed access" });

  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' })
    }
    req.decoded = decoded;
    next();
  });
}


async function run() {

  try {
    await client.connect();
    // console.log('database conected')
    const servicesCollection = client.db('doc+').collection("services");
    const bookingCollection = client.db('doc+').collection("bookings");
    const usersCollection = client.db('doc+').collection("users");
    const doctorsCollection = client.db('doc+').collection("doctors");
    
    const verifyAdmin = async(req, res, next) => {
      const requester = req.decoded.email;
      const rquesterAccount = await usersCollection.findOne({ email: requester });

      if (rquesterAccount.role === 'admin') {
        next();

      }else{
        res.status(403).send({message: 'forbidden'});
      }
    }



    app.get('/services', async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    app.get('/available', async (req, res) => {
      const date = req.query.date;
      // get all services
      const services = await servicesCollection.find().toArray();

      // get the booking of the day
      const query = { date: date };

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
    //  Get users
    app.get('/users', vrifyJWT, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    })

    app.put('/users/admin/:email', vrifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


    // User collection 
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };


      const updateDoc = {
        $set: user,
      };

      const result = await usersCollection.updateOne(filter, updateDoc, options);

      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ result, token: token });
    });

    app.get('/booking', vrifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patientEmail: patient };
        // console.log(query)
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: 'Forbidden Access' })
      }

    });

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail }
      // console.log(query)
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);

      return res.send({ success: true, result });
    })


    //  post doctor

    app.post('/doctor', vrifyJWT, async(req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    })

    //  load all doctors
    app.get('/doctors', vrifyJWT, async(req, res) => {
      const doctors = await doctorsCollection.find().toArray();
      res.send(doctors);
    });

    app.delete('/doctors/:email', vrifyJWT, async(req, res) => {
      const email = req.params.email;
      const query = {email : email};
      const result = await doctorsCollection.deleteOne(query);
      res.send(result);
    })









  }
  finally {

  }
}

run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello from doctor!')
})



















app.listen(port, () => {
  console.log(`Doc+ app listening on port ${port}`)
})