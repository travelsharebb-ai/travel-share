import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main(){
  const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE lower(table_name) = 'location' OR lower(table_name) = 'upload';`;
  console.log('tables:', tables);
  const cols = await prisma.$queryRaw`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE lower(table_name) = 'location' ORDER BY ordinal_position;`;
  console.log('location columns:', cols);
  const uploadCols = await prisma.$queryRaw`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE lower(table_name) = 'upload' ORDER BY ordinal_position;`;
  console.log('upload columns:', uploadCols);
}

main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>process.exit());
