import worker from '../../worker/src/index.js';

export async function onRequest(context) {
  return worker.fetch(context.request, context.env, context);
}
