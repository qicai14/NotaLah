import { proxy, type ProxyEnv } from '../edge/proxy';

export const onRequest = ({ request, env }: { request: Request; env: ProxyEnv }) => proxy(request, env);
