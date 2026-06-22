import "dotenv/config";
import { prisma } from "../src/utils/prisma.js";

async function run(){
  try{
    const ev = await prisma.event.findMany({
      where: { visibility: 'public', status: { in: ['live', 'ended'] } },
      include: { _count: { select: { uploads: true, zones: true } } },
      orderBy: { startDate: 'asc' },
      take: 5
    });
    console.log('events length', ev.length);
    console.dir(ev, { depth: 2 });
  }catch(err){
    console.error('ERROR running events query:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 2;
  }finally{
    await prisma.$disconnect();
  }
}

run();
