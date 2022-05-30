import { Env } from '.';

export async function log(env: Env, message: unknown): Promise<void> {
  console.log(typeof message === 'string' ? message : JSON.stringify(message));
}
