import { proxy } from '../edge/proxy';

export const onRequest = ({ request, env }: { request: Request; env: { API_ORIGIN?: string } }) =>
  proxy(request, env.API_ORIGIN);
