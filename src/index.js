import express from "express"
import Redis from "ioredis"
import dotenv from "dotenv"
import fs from "node:fs";
import {MongoClient} from "mongodb"

const mongo= new MongoClient("mongodb://127.0.0.1:27017")
 await mongo.connect()

 const orderCollection=mongo.db("ticketBooking").collection("orders")

const app=express()
app.use(express.json())

const redis = new Redis({host: "127.0.0.1",
  port: 6379,
  db: 0
  ,
})

redis.on("connect", () => console.log("Connected to Redis"));
redis.on("error", (err) => console.error("Redis error:", err.message));

const reserveScript = fs.readFileSync(
  new URL("./reserve.lua", import.meta.url),
  "utf8"
);

redis.defineCommand("reserveTicket", {
  numberOfKeys: 3,
  lua: reserveScript,
});

 async function reserveRateLimit(req,res,next) {

  const {userId}=req.body
const key=`rate:reserve:${userId}`
const attempts=await redis.incr(key)

if(attempts===1){
  await redis.expire(key,60)
}
if(attempts>3){
  const remainingsecond = await redis.ttl(key)

  return res.status(429).json({
    message: "no more requests accepted" ,
    secondleft:remainingsecond

  })
}
next()
  
  
}

app.post("/events", async(req,res)=>{

    const{tickets,eventId}=req.body
   

    if(!eventId || !Number.isInteger(tickets) || tickets < 1) {
    return res.status(400).json({
      message: "Provide eventId and a positive ticket count",
    });
  }
    const result= await redis.set(`tickets:${eventId}:available`,tickets,"NX")
    if(result===null){
       return res.json({message:"no ticket available"})
    }
    return res.status(200).json({message:"event created",eventId,tickets})

})

app.get("/event/:eventId/orders",async(req,res)=>{

  const {eventId}=req.params

  const cacheKey=`event:order${eventId}`

  const cached=await redis.get(cacheKey)

  if(cached!==null){
    return res.json(JSON.parse(cached))
  }

  const orders=await orderCollection
                  .find({eventId})
                  .project({_id:0,eventId:1,userId:1,status:1, createdAt:1})
                  .toArray()

                  const response={eventId,count:orders.length,orders}

                  await redis.set(cacheKey, JSON.stringify(response),"EX",30)

                  return res.status(200).json(response)

      

})






app.get("/events/:eventId",async(req,res)=>{

  const {eventId}=req.params

const count=await redis.get(`tickets:${eventId}:available`)
const ticketRemaining=Number(count)

return res.json({
  ticketRemaining,eventId,soldOut:ticketRemaining===0
})
})

app.post("/reserve",reserveRateLimit, async(req,res)=>{
    const {eventId,userId}=req.body
 
   const [status,remaining] =  await    
   redis.reserveTicket(
    `tickets:${eventId}:available`,
    `tickets:${eventId}:users`,
    `orders:${eventId}`,
     userId,
     eventId)



    

       if(status===-1){
    return res.json({message:"ticket is already reserved for you"})
  }
  
  if(status===0){
    return res.json({message:"ticket sold out"})
  }

    if(remaining===0)
    {
       return res.json({message:"no ticket available" })
    }
    res.json({message:"ticket reserve" ,remaining,"userId": userId})

})

  app.listen(3000,()=>{
    console.log("server is running on port",3000)
  })