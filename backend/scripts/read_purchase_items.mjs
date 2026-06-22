import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {PrismaClient} from '@prisma/client';

const outPath = path.resolve(process.cwd(), 'tmp', 'purchase_items.json');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const items = await prisma.purchaseItem.findMany({select:{id:true,name:true,metadata:true}});
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
    console.log('WROTE', outPath);
  }catch(err){
    console.error('ERROR-DB', err && err.message || err);
    process.exit(2);
  } finally{
    await prisma.$disconnect();
  }
})();
