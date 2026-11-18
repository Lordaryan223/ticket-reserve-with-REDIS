import Redis from "ioredis"
import { MongoClient } from "mongodb";

const redis = new Redis({host: "127.0.0.1",
  port: 6379,
  db: 0
  ,
})


const mongo = new MongoClient("mongodb://127.0.0.1:27017");
await mongo.connect();

const ordersCollection = mongo
  .db("ticketBooking")
  .collection("orders");



const eventId="priyanshi"
const streamKey=`orders:${eventId}`
const groupName="order-worker"
const consumerName="worker-1"

async function processOrder(order, stream, messageId) {
  await ordersCollection.updateOne(
    { stream, messageId },
    {
      $setOnInsert: {
        ...order,
        stream,
        messageId,
        status: "reserved",
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}


    


async function startWorker() {
    try{
        await redis.xgroup("CREATE",streamKey,groupName,"0", "MKSTREAM")
        console.log(`group created:${groupName}`)
    }
    catch(error){
        if (!error.message.includes("BUSYGROUP")) {
      throw error;
    }

}
     console.log(`Worker listening to ${streamKey}`)

     while(true){
        const result = await redis.xreadgroup(
            "GROUP", groupName, consumerName,
            "COUNT",10,
            "BLOCK",500,
            "STREAMS",streamKey,">"
        )
        if(!result) continue

        for( const [stream,messages] of result){
            for( const[messageId,fields]of messages){
                const order={}

                for(var i=0;i<fields.length;i+=2){
                    const fieldName=fields[i]
                    const fieldValue=fields[i+1]
                    order[fieldName]=fieldValue

                }
                console.log("procssing orders",{messageId,...order})

                try {
                    await processOrder(order, stream, messageId)
                    // do any thing here reserve a seat 

                    await redis.xack(stream,groupName,messageId);
                     console.log(`Processed & acknowledged order ${messageId}`);

                    
                } catch (error) {
                    console.error(`Failed to process ${messageId}:`, error);
                    
                }
            }
        }
     }



    
}


startWorker().catch((error) => {
  console.error("Worker failed:", error);
  process.exitCode = 1;
})


