export async function deliverThenMarkSent(input) {
  await input.deliver(input.idempotencyKey)
  await input.markSent()
}
