import { handleRequest, handleScheduled } from './app.js';
import { json } from './lib/http.js';

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: error.message }, error.status ?? 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(env, new Date(controller.scheduledTime)));
  }
};
