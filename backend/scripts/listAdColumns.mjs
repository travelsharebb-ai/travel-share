import "dotenv/config";
import { prisma } from "../src/utils/prisma.js";

async function run(){
  try{
    const res = await prisma.$queryRaw`select table_schema, table_name, column_name from information_schema.columns where column_name ilike '%creator%' or table_name ilike '%ad%' order by table_name, column_name`;
    console.log('columns:', res);
  }catch(err){
    console.error('error listing columns', err);
    process.exitCode = 2;
  }finally{
    await prisma.$disconnect();
  }
}
run();
