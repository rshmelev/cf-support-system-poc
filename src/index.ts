import { Router } from 'itty-router';
import { log } from './log';

const router = Router();

// ===============================================================================
//                                       SLACK
/*
{
  "token": "8qV...FM",
  "team_id": "T4...5",
  "api_app_id": "A0....M",
  "event": {
    "client_msg_id": "ef6a68db-9941-4e36-a780-2ba99ddfef69",
    "type": "message",
    "text": "hello!",
    "user": "U4...H",
    "ts": "1653309012.748639",
    "team": "T4...5",
    "blocks": [
      {
        "type": "rich_text",
        "block_id": "XOd",
        "elements": [
          {
            "type": "rich_text_section",
            "elements": [
              {
                "type": "text",
                "text": "hello!"
              }
            ]
          }
        ]
      }
    ],
    "thread_ts": "1653308764.079089", !!!!!!!!!!!!!!!!!!!!!!!
    "channel": "C0......B",
    "event_ts": "1653309012.748639",
    "channel_type": "group"
  },
  "type": "event_callback",
  "event_id": "Ev........P",
  "event_time": 1653309012,
  "authorizations": [
    {
      "enterprise_id": null,
      "team_id": "T4...5",
      "user_id": "U0...A",
      "is_bot": true,
      "is_enterprise_install": false
    }
  ],
  "is_ext_shared_channel": false,
  "event_context": "4-..."
}
*/
router.all('/slack-bot', async (req: Request, env: Env, context) => {
  const incoming: any = await req.json!();
  console.log(JSON.stringify(incoming, undefined, 2));
  // challenge for initial webhook configuration
  // TODO: PROPER CHECK: https://api.slack.com/authentication/verifying-requests-from-slack
  if (incoming.challenge && incoming.type === 'url_verification') return new Response(incoming.challenge);

  await log(env, incoming);

  if (
    incoming.event?.type === 'message' &&
    incoming.event?.subtype !== 'bot_message' &&
    incoming.event?.thread_ts &&
    !incoming.event?.deleted_ts
  ) {
    // TODO: slash commands are better
    const kvKeySlackToTg = 'telegramid_for_slackthread_' + incoming.event?.thread_ts;
    const tgId = +((await env.KV.get(kvKeySlackToTg)) || '');

    const close = incoming.event?.text === '!close';
    if (close) {
      // KV deletes are too slow so need to put empty value there
      // to speed up the process
      const kvKeyTgToSlack = 'slack_thread_for_telegramid_' + tgId;
      await env.KV.put(kvKeyTgToSlack, '');
      await env.KV.delete(kvKeyTgToSlack);
    }

    if (tgId) {
      const tgBotUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}`;
      await fetch(`${tgBotUrl}/sendMessage`, {
        method: 'POST',
        body: JSON.stringify({
          text: close ? env.BYE_MESSAGE : '' + incoming.event?.text, //  + ' from ' + incoming.event?.user,
          chat_id: tgId,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      await log(env, 'failed to get: ' + kvKeySlackToTg);
    }
  }

  return new Response('', {
    headers: {},
  });
});

// ===============================================================================
//                                   TELEGRAM
/*
``` {
  "update_id": 163316105,
  "message": {
    "message_id": 62,
    "from": {
      "id": 171002143,
      "is_bot": false,
      "first_name": "John",
      "last_name": "Doe",
      "username": "jdoe",
      "language_code": "en"
    },
    "chat": {
      "id": 171002143,
      "first_name": "John",
      "last_name": "Doe",
      "username": "jdoe",
      "type": "private"
    },
    "date": 1653310211,
    "text": "help me please"
  }
}
```

https://github.com/grammyjs/types/

*/
router.all('/telegram-bot', async (req: Request, env: Env, context) => {
  const incoming: any = await req.json!();
  console.log(JSON.stringify(incoming, undefined, 2));
  const tgBotUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}`;

  // TODO: fix security and not allow this to be called again
  if (req.url.includes('INSTALLBOT')) {
    return await fetch(`${tgBotUrl}/setWebhook?url=${req.url.split('?')[0]}`, {
      method: 'GET',
    });
  }

  await log(env, incoming);

  if (incoming.message?.from?.id > 0) {
    const kvKeyTgToSlack = 'slack_thread_for_telegramid_' + incoming.message?.from?.id;
    const cachedUserThreadTs = await env.KV.get(kvKeyTgToSlack);

    // https://api.slack.com/methods/chat.postMessage
    // TODO: needs additional care for threads > 100 messages
    const f = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      body: JSON.stringify({
        token: env.SLACK_TOKEN,
        text: incoming.message?.text || '...',
        username:
          'TG: ' +
          (incoming.message.from.username ? `@${incoming.message.from.username} ` : '') +
          (incoming.message.from.first_name ? `${incoming.message.from.first_name} ` : '') +
          (incoming.message.from.last_name ? `${incoming.message.from.last_name} ` : ''),
        channel: env.SLACK_SUPPORT_CHANNEL_ID,
        icon_emoji: ':heart:',
        ...(cachedUserThreadTs ? { thread_ts: cachedUserThreadTs } : {}),
      }),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: 'Bearer ' + env.SLACK_TOKEN,
        Accept: '*/*',
        'User-Agent': 'curl/7.64.1',
      },
    });
    const postBody: any = await f.json();
    if (!cachedUserThreadTs && postBody.ok && postBody.ts) {
      const kvKeySlackToTg = 'telegramid_for_slackthread_' + postBody.ts;
      await env.KV.put(kvKeyTgToSlack, postBody.ts);
      await env.KV.put(kvKeySlackToTg, '' + incoming.message?.from?.id);
    }
    /*
{
  "ok": true,
  "channel": "C0.....",
  "ts": "1653308764.079089",
  "message": {
    "type": "message",
    "subtype": "bot_message",
    "text": "...",
    "ts": "1653308764.079089",
    "username": "BOT",
    "icons": {...},
    "bot_id": "B0....R",
    "app_id": "A0....M"
  }
}
    */
    if (incoming.message?.text === '/start') {
      await fetch(`${tgBotUrl}/sendMessage`, {
        method: 'POST',
        body: JSON.stringify({
          text: env.WELCOME_MESSAGE,
          chat_id: incoming.message?.from?.id,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await log(
      env,
      'post: ' + f.status + '/  ' + JSON.stringify({ cachedUserThreadTs }) + ' / ' + JSON.stringify(postBody)
    );
  } else {
    await log(env, 'hmmm');
  }

  return new Response('', {
    headers: {},
  });
});

export default {
  fetch: router.handle,
} as ExportedHandler<Env>;

export interface Env {
  KV: KVNamespace;
  WELCOME_MESSAGE: string;
  BYE_MESSAGE: string;
  TG_BOT_TOKEN: string;
  SLACK_TOKEN: string;
  SLACK_SUPPORT_CHANNEL_ID: string;
}
