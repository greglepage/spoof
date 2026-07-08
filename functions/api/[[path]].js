import worker from '../_lib/api-worker.js';

export async function onRequest(context) {
  return worker.fetch(context.request, context.env, context);
}