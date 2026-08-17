export async function resetPublicSchema(sql) {
  await sql`DROP SCHEMA IF EXISTS public CASCADE`
  await sql`CREATE SCHEMA public`
  await sql`GRANT ALL ON SCHEMA public TO PUBLIC`
  await sql`GRANT ALL ON SCHEMA public TO CURRENT_USER`
}
