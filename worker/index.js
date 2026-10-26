import { handleRequest, handleScheduled } from './app.js';
import { errorBody, json } from './lib/http.js';

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(error);
      return json(errorBody(error), error.status ?? 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(env, new Date(controller.scheduledTime)));
  }
};
