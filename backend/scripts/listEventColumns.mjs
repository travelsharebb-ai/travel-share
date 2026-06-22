import "dotenv/config";
import { prisma } from "../src/utils/prisma.js";

async function run(){
  try{
    const res = await prisma.$queryRaw`select column_name from information_schema.columns where table_name = 'Event' order by column_name`;
    console.log('Event columns:', res.map(r => r.column_name));
  }catch(err){
    console.error('error listing event columns', err);
    process.exitCode = 2;
  }finally{
    await prisma.$disconnect();
  }
}
run();
