// Discord-бот PANDAMIA: модерация голосовых каналов (права владельцев, мут/глухота,
// тег 🔑), бан-таймаут за выход с сервера, музыка и мост между серверами (pipe).
// Всё, что зависит от конкретного сервера, -- в config.json (шаблон: config.example.json).
// node >= 22 (портативный: ./node-v24.21.0-win-x64/node.exe)
// discord.js v14:
//   npm install discord.js @keyv/sqlite keyv
// CHANGELOG v2 (переход на discord.js v14 / keyv v5 / node 24):
//   * intents строками (v13-стиль) + partials: ['Channel'] (иначе ЛС не работают)
//   * keyv v5: const { Keyv } = require('keyv');
//   * channel.type: enum ChannelType (0 = GUILD_TEXT, 1 = DM)
//   * permissionOverwrites: overwrite.allow/deny -- PermissionsBitField (не Collection)
//   * displayAvatarURL: { extension: 'png', forceStatic: false, size: 1024 }
//   * users.fetch: один аргумент (опции cache/force убраны в v14)
//   * user.tag -- null (только username, без discriminator), uu()/uuu() без '#0'
//   * setBitrate: число bps (не строка '64000')
//   * embed timestamp: только Date/number/ISO (locale-строка d() кидала 'Invalid time value')
//   * color 'BLUE' (v13-стиль, капсом) НЕ распознаётся EmbedBuilder -> 'Blue'/hex
//   * channelCreate/channelUpdate: в v14 каналы приходят без guild -> берём через .guild ?? client.guilds.cache.get
//   * [FIX v2] NaN-баг в логе переименования: скобки вокруг 'Владельцы канала: ' + (owners.size ? ... : ...)
//   * [FIX v2] e.message там, где e не существует (users.fetch .catch(() => null))
// CHANGELOG v2.9.1 (по итогам ревью всего кода):
//   * [FIX] предзагрузка: один поток мог получить ДВА обработчика 'error' -- одна ошибка
//     писала в лог две строки (вторая называла играющий трек «предзагрузкой»).
//   * [FIX] громкость больше не берётся из фиктивной записи $music[''] (мусор в состоянии).
//   * [FIX] запись входа/выхода в журнал: null-аватара больше не попадает в embed.
// CHANGELOG v2.5 (пересылка из пандалогии + текст команд):
//   * ИНТЕНТ Message Content теперь запрашивается (в портале приложения он ВКЛЮЧЁН).
//     Без него Discord отдаёт события без текста (content пустой) -- поэтому НЕ работали
//     ни пересылка из пандалогии в чат, ни текстовые команды 'panda ...'.
//   * Если Discord интент не даст (после 09.10.2026 без одобрения) -- бот сам
//     запустится БЕЗ него и напишет об этом в лог (деградация вместо падения).
//   * Пересылка: сперва отправка, потом удаление оригинала (иначе при ошибке
//     отправки сообщение терялось). Пустое сообщение больше НЕ удаляется.
// CHANGELOG v2.1 (работа БЕЗ привилегированных интентов -- заявку Discord подавать не надо!):
//   * интент GuildMembers УБРАН (привилегированный; после 09.10.2026 без одобрения
//     бот не запустился бы). Вход/выход участников ловим REST-поллингом
//     (см. pollMembers в конце файла) -- разрешено всем приложениям.
//   * Welcome-ЛС новичкам отключены (по решению владельца).
//   * Логи входов/выходов в журнал -- сохранены.
//   * Причины банов -- как было: 'Забанен ботом на N мин.'
//   * [БОНУС] ban-таймауты теперь рестарт-безопасны: при старте и в каждом тике
//     просроченные membersBanTimeout из SQLite снимаются (sweepExpiredBans).

const
{
    ID, TOKEN, PREFIX, SERVERS,
    ERROR, DEBUG, NOTICE, STARTUP_DM,
    MESSAGE_CONTENT,
}
= require ('./config.json');
const space = ' ';

// [v2.5] Привилегированный интент Message Content (в портале приложения включён).
// Он нужен двум вещам: пересылке из пандалогии и текстовым командам 'panda ...'.
// Поставь в config.json "MESSAGE_CONTENT": false -- если Discord его отзовёт.
const USE_MESSAGE_CONTENT = MESSAGE_CONTENT !== false;

// [v2.5] «Владелец» для текста помощи -- первый id из STARTUP_DM (config.json).
// Зашитых id в коде быть не должно: репозиторий отдаётся людям как есть.
const OWNER_ID =
    (Array.isArray (STARTUP_DM) && /^\d{17,20}$/.test (STARTUP_DM[0] || ''))
        ? STARTUP_DM[0]
        : '';

// [v2.2] Инструкция по использованию. Один текст на все входы: стартовая ЛС
// (STARTUP_DM из config.json), слэш `/help` и `panda help` -- правки только здесь.
const STARTUP_DM_TEXT =
    '**Как пользоваться ботом** 🐼\n' +
    '📌 Вызвать эту инструкцию в любой момент: `/help` (видно только тебе)\n' +
    'или `panda help` (бот пришлёт её в ЛС).\n' +
    '\n' +
    '🎵 **Музыка** (слэш-команды; сначала зайди в голосовой канал):\n' +
    '`/play ссылка или запрос` -- трек или плейлист (YouTube, SoundCloud и др.)\n' +
    '`/join` -- зайти в твой канал и остаться там (даже без музыки)\n' +
    '`/skip` -- следующий • `/stop` -- стоп и очистить очередь\n' +
    '`/pause` / `/resume` -- пауза / продолжить • `/queue` -- что играет\n' +
    '`/leave` -- выйти из голосового канала\n' +
    'Управлять музыкой могут админы, модеры и роль DJ (смотреть очередь -- всем).\n' +
    'Сам бот никуда не уходит: кончилась песня или /stop -- он остаётся в канале,\n' +
    'пока не позовёшь в другую комнату или не скажешь `/leave`.\n' +
    'Пока сидит, он пишет в самом канале, что играет, сколько в очереди,\n' +
    'сколько людей в комнате и сколько он тут.\n' +
    '\n' +
    '💬 **Команды в чате** (префикс `panda `):\n' +
    '`panda ping` -- проверка связи (ответ: pong)\n' +
    '`panda help` -- бот пришлёт эту инструкцию в ЛС\n' +
    '`panda file` + вложение -- бот вернёт файл обратно\n' +
    '`panda dm @юзер текст` -- ЛС от имени бота (только админы);\n' +
    'вместо упоминания можно указать id: `panda dm 123456789012345678 текст`\n' +
    '`panda test` -- бот напишет тебе в личку (проверка ЛС)\n' +
    '\n' +
    '🛡️ **Что бот делает сам:**\n' +
    '• мут/глухота действуют только в своём канале: в других говорить можно,\n' +
    '  вернёшься -- мут на месте; жалоба -- зайди в общий канал 🆘\n' +
    '• выдаёт права владельцу канала и ставит тег 🔑 в ник\n' +
    '• бан на 20 минут за выход с сервера (таймаут на перезаход)\n' +
    '\n' +
    '🔑 **Тег 🔑 в нике** -- права в этом канале есть. У ADM/MOD тега нет: у них права и так.\n' +
    '\n' +
    '🖥️ **Если бот выключен** -- напиши ' + (OWNER_ID ? u (OWNER_ID) : 'владельцу сервера') + '.';

// [v2.6] Инструкция одним объектом -- чтобы /help, `panda help` и стартовая ЛС
// никогда не разъезжались по тексту:
function helpEmbed ()
{
    const first = Object.keys (SERVERS)[0];
    return {
        color: 0x00CCFF,
        title: '🐼 PANDAMIA Bot: инструкция',
        description: STARTUP_DM_TEXT,
        footer:
        {
            text: (first && SERVERS[first]) ? SERVERS[first].name : 'PANDAMIA Bot',
        },
        timestamp: dt(), // [v14] только Date/number (locale-строка кидала 'Invalid time value'),
    };
}

const
{
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionsBitField,
    Collection,
    AuditLogEvent, // [v2.4] авторство действий: кто замутил/перенёс (из журнала аудита)
    ActivityType,  // [v2.8] профильный статус бота (слушает/смотрит/играет)
} = require ('discord.js');

// [v2.1] GuildMembers интент УБРАН -- он привилегированный, без одобрения Discord
// бот после 09.10.2026 просто не запустился бы ('Used disallowed intents').
// Вход/выход участников теперь ловим БЕЗ интента -- REST-поллингом (см. pollMembers).
const INTENTS =
[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration, // [v2.4] журнал аудита: авторство мутов/переносов. НЕ привилегированный -- одобрения Discord не требует
    GatewayIntentBits.GuildMessages,
    // GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
];
// [v2.5] ТЕКСТ сообщений: без этого интента Discord присылает события с пустым content
// (пересылка из пандалогии и команды 'panda ...' молчат). Интент привилегированный,
// но в портале приложения Peka он включён -- заявку подавать не надо (проверено).
if (USE_MESSAGE_CONTENT)
    INTENTS.push (GatewayIntentBits.MessageContent);

const client = new Client
(
    {
        intents: INTENTS,
        partials:
        [
            Partials.Channel, // DM-каналы не кэшируются без этого [v14]
        ],
    }
);

// ## DB!:
// keyv v5: именованный экспорт!
const { Keyv } = require ('keyv');

var $db = {};// ALL SERVERS!
for (let _server in SERVERS)
{
    $db[_server] = {};
    $db[_server]['membersBanTimeout'] = new Keyv ('sqlite://' + __dirname + '/' + _server + '.sqlite', {namespace: 'membersBanTimeout'});
    $db[_server]['channelsBusy']      = new Keyv ('sqlite://' + __dirname + '/' + _server + '.sqlite', {namespace: 'channelsBusy'});
}

async function db (server, namespace, id, value = undefined, item = undefined)
{
    if (id === '!!!WIPE!!!') // CLEAR ALL DB/SERVERS!
        return await $db[server][namespace].clear();
    else
        if (item === undefined) // no item
            if (value === undefined)
                return await $db[server][namespace].get (id);
            else // set value to -> id!
                if (value === null)
                    return await $db[server][namespace].delete (id);
                else
                    return await $db[server][namespace].set (id, value);
        else // item!
        {
            let obj = await $db[server][namespace].get (id);
            if (typeof obj !== 'object') obj = {}; // || {}!
            if (value === undefined)
                return obj[item];
            else
                if (value === null)
                {
                    delete obj[item]; // ->true
                    if (Object.keys(obj).length)
                        return await $db[server][namespace].set (id, obj);
                    else
                        return await $db[server][namespace].delete (id);
                }
                else
                {
                    obj[item] = value;
                    return await $db[server][namespace].set (id, obj);
                }
        }
}

// [FIX v2.2.1] страховка на уровне процесса: непойманное исключение/промис больше НЕ убивает бота
// (битые видео, сеть, прокси -- всё уходит в лог, бот продолжает работать):
process.on ('unhandledRejection', e => console.error ('[' + (d()) + '] [unhandledRejection] ' + String ((e && e.message) || e).slice (0, 300)));
process.on ('uncaughtException',  e => console.error ('[' + (d()) + '] [uncaughtException] '  + String ((e && e.message) || e).slice (0, 300)));

// [v2.5] Discord отдаёт текст сообщений только с интентом Message Content. Если он
// отзовёт доступ (заявка не одобрена до 09.10.2026) -- бот всё равно ЗАПУСТИТСЯ,
// просто без пересылки и команд 'panda ...'. Проверяем это заранее через REST и
// переподключаемся без интента, если Discord его не даёт ('Used disallowed intents').
async function messageContentAllowed ()
{
    try
    {
        const r = await fetch
        (
            'https://discord.com/api/v10/applications/@me',
            {headers: {Authorization: 'Bot ' + TOKEN}, signal: AbortSignal.timeout (5000)}
        );
        if (!r.ok) return true; // не смогли проверить -- пробуем с интентом (fallback ниже)
        const app = await r.json();
        // GATEWAY_MESSAGE_CONTENT (1<<18) / GATEWAY_MESSAGE_CONTENT_LIMITED (1<<19):
        return Boolean (app.flags & ((1 << 18) | (1 << 19)));
    }
    catch (e) { return true; }
}

// Heavy GO! +D
// here you go...
(async () =>
{
    if (USE_MESSAGE_CONTENT && !(await messageContentAllowed ()))
    {
        console.error ('[' + (d()) + '] [login] Message Content у приложения ОТКЛЮЧЁН -- запускаю без него' +
            ' (пересылка из пандалогии и команды "panda ..." работать не будут)');
        client.options.intents.remove (GatewayIntentBits.MessageContent);
    }
    if (!client.options.intents.has (GatewayIntentBits.MessageContent))
        console.log ('[' + (d()) + '] [login] без интента Message Content: текст сообщений недоступен');
    try
    {
        await client.login (TOKEN);
    }
    catch (e)
    {
        const msg = String ((e && e.message) || e);
        if (/disallowed intent/i.test (msg) && client.options.intents.has (GatewayIntentBits.MessageContent))
        {
            console.error ('[' + (d()) + '] [login] Discord запретил Message Content -- переподключаюсь без него');
            client.options.intents.remove (GatewayIntentBits.MessageContent);
            await client.login (TOKEN).catch (e2 => console.error ('[login] error: ' + ((e2 && e2.message) || e2)));
        }
        else
            console.error ('[login] error: ' + msg);
    }
})();

client.on
(
    'clientReady', // [v2.4] 'ready' в v15 уйдёт -- без warnings в логе (только события)
    async () =>
    {
        console.log
        (
            '[' + (d()) + '] ' +
            `Logged in as ${client.user.tag}!` // v14: tag === username (discriminator убрали)
        );
        schedulePresence (true); // [v2.8] профильный статус: «свободен, жду команду»
        // [v2.2] Инструкция по использованию -- в ЛС владельцу и коллеге (STARTUP_DM из config.json):
        for (const uid of (STARTUP_DM || []))
        {
            await client.users.fetch (uid)
            .then
            (
                user =>
                user.send ({ embeds: [helpEmbed ()] }) // [v2.6] тот же текст, что у /help
            )
            .then (() => console.log ('[' + (d()) + '] startup DM sent to ' + uid))
            .catch (e => console.error ('[' + (d()) + '] startup DM error for ' + uid + ': ' + e.message));
        }
    }
);

// FUNCTIONS:
// pad for dates...
var pad = (n,z=2)=>('0'+n).slice(-z);
// date to locale ? -- :(
function d (t = 0, f = false)
{
    var d = t ? new Date(t) : new Date();
    return  f
        ?
            pad(d.getDate()) + "." + pad(d.getMonth()+1) + "." + d.getFullYear() + ", " +
            pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds())
        :
            d.toLocaleString();
}
// [v14] timestamp для embed: locale-строка кидала 'Invalid time value' в EmbedBuilder!
function dt (t = 0)
{
    return t ? new Date(t) : new Date();
}
// date difference: [hours] [minutes] [seconds]:
function dd (d2, f = false, d1 = undefined) // null ?
{
    d1 = d1 ? d1 : Date.now();
    let d = (d2 - d1);
    let h = d/3.6e6|0;      // часы?
    let m = d%3.6e6/6e4|0; // минуты
    let s = d%6e4/1000|0; // секунды
    let r = f
        ?
            (h ? pad(h) + ' час.' : '') +
            (m ? (h ? ' ' : '') + pad(m) + ' мин.' : '') +
            (s ? (h||m ? ' ' : '') + pad(s) + ' сек.' : '')
        :
            pad(h) + ':' + pad(m) + ':' + pad(s);
    return r;
}
// mentions:
// uid, user, member
function u (id) // uid
{
    return '<@!'+id+'>';
}
function uu (user) // user
{
    // v14: discriminator убрали (у всех '0') -- возвращаем просто username!
    return user.username;
}
function uuu (member) // member
{
    // v14: discriminator убрали -- возвращаем просто username!
    return member.user.username +
        (member.nickname ? ' (' + member.nickname + ')' : '');
}
// cid, channel
function c (id) // cid
{
    return '<#'+id+'>';
}
function cc (channel) // channel
{
    return '#'+channel.name;
}
function ccc (channel) // channel (link)
{
    if (channel.type === ChannelType.GuildText)
        return `${channel}` + ' (#'+channel.name+')';
    else
        return `${channel}`;
}
// rid, role?..
function r (id) // rid
{
    return '<@&'+id+'>';
}
// to:
// code
function code (s) // '`' + s + '`'
{
    return s.replace(/`/g, '\'');
}

// ONE attach from files!?
// [v2.5] discord.js принимает в files URL/буфер/поток, но НЕ объекты Attachment:
// внутри получается attachment === undefined, файлы молча теряются и Discord
// отвечает 50006 'Cannot send an empty message'. Поэтому разворачиваем вложения
// в {attachment: url, name} -- discord.js сам скачает их по ссылке CDN.
function attachOf (message)
{
    return {
        files: [...message.attachments.values ()].map
        (
            a => ({ attachment: a.url, name: a.name })
        )
    };
}

// [v2.5] Разбор `panda dm`: кому -- упоминание ИЛИ просто id (17-20 цифр).
// Раньше целью было ТОЛЬКО упоминание, поэтому `panda dm <id> текст`
// молча ничего не делал (а команда при этом удалялась).
// Возвращает { id, letter }: id может быть null (кому -- не поняли).
function dmParse (content, mentions)
{
    let rest = content.slice ((PREFIX + 'dm').length);
    let id = null;
    let mentioned = mentions.users.first () || null;
    if (mentioned)
    {
        id = mentioned.id;
        // Упоминание в тексте приходит в двух формах: <@id> и <@!id> -- срезаем любую
        // (в старой версии срезалась только <@!id>, и в ЛС уезжал мусор вроде <@123>):
        rest = rest.replace (new RegExp ('<@!?' + id + '>', 'g'), '');
    }
    else
    {
        // <@id> / <@!id> / голый id первым словом:
        let m = rest.match (/^\s*(?:<@!?(\d{17,20})>|(\d{17,20})(?!\d))/);
        if (m)
        {
            id = m[1] || m[2];
            rest = rest.slice (m[0].length);
        }
    }
    return { id: id, letter: rest.trim () };
}

// (node:16096) DeprecationWarning: The message event is deprecated. Use messageCreate instead
client.on ('messageCreate', async message =>
{
    // [IMPORTANT] context of the message...
    if (message.author.bot) return; // from Bot!
    // For TEXT and DM type message functions... BOTH!
    // On Discord API v8 and later, DM Channels do not emit the CHANNEL_CREATE event, which means discord.js is unable to cache them automatically.
    // In order for your bot to receive DMs, the CHANNEL partial must be enabled. [+] v14: partials: [Partials.Channel]
    if ([ChannelType.GuildText, ChannelType.DM].includes (message.channel.type))
    {
        // command 'ping' ## pong
        if (message.content.startsWith (PREFIX + 'ping'))
        {
            message.channel.send
            (
                {
                    content: 'pong'
                }
            )
            // [v2.6] .then (console.log) печатал в лог весь объект сообщения --
            // строку события ('[cmd] ... panda ping') уже пишет обработчик выше.
            .catch (e => console.error ('[' + (d()) + '] [cmd] ping: ' + e.message));
            //message.reply ('Pika!');
        }

        // command 'help' ## [v2.6] Инструкция в ЛС тому, кто спросил.
        // В чат её не льём (20 строк шума); саму команду в канале уберёт блок ниже.
        if (message.content.startsWith (PREFIX + 'help'))
        {
            message.author.send ({ embeds: [helpEmbed ()] })
            .then (() => console.log ('[' + (d()) + '] [dm] help -> ' + uu (message.author) + ' OK'))
            .catch (e => console.error
            (
                '[' + (d()) + '] [dm] help -> ' + uu (message.author) + ': ЛС не ушло (' + e.message + ')'
            ));
        }

        // command 'test' ## [v2.5] Самопроверка ЛС.
        // Раньше тут был зашит один uid (остался от тестов на себе) и красный эмбед
        // «оппозиция» -- команда писала ЕМУ, а не тому, кто её вызвал. Теперь -- вызывающему.
        if (message.content.startsWith (PREFIX + 'test'))
        {
            message.author.send ({ content: 'pong 🐼 ЛС работают.' })
            .then
            (
                () => console.log ('[' + (d()) + '] [dm] self-test -> ' + message.author.username + ' OK')
            )
            .catch
            (
                e => console.error
                (
                    '[' + (d()) + '] [dm] self-test -> ' + message.author.username +
                    ': ЛС не ушло (' + e.message + ')'
                )
            );
        }
    }
    if (message.channel.type === ChannelType.GuildText)
    {
        var _pipe_channel_source = '';
        var _pipe_channel_target = '';
        for (let _server in SERVERS)
        {
            _pipe_channel_source = SERVERS[_server].pipe_channel_source;
            _pipe_channel_target = SERVERS[_server].pipe_channel_target;
            // command message send to {another} server channel!
            if (message.channel.id === _pipe_channel_source)
            {
                /* [v2.5] Пересылка источник -> приёмник ОТ ИМЕНИ БОТА.
                   Важен порядок: сперва ОТПРАВКА, только потом удаление оригинала --
                   иначе при любой ошибке отправки сообщение теряется навсегда. */
                const attach = attachOf (message);
                const text  = message.content ? message.content : '';
                const files = attach.files ? attach.files.length : 0;
                if (!text && !files)
                {
                    // Текст сюда попадает только с интентом Message Content: без него Discord
                    // присылает событие с пустым content. Удалять такое НЕЛЬЗЯ -- потеряем сообщение.
                    console.log
                    (
                        '[' + (d()) + '] [pipe] сообщение от ' + message.author.username +
                        ' НЕ переслано: Discord не отдал ни текст, ни файлы' +
                        ' (нужен интент Message Content -- см. config.json / README)'
                    );
                    return;
                }
                // [v14] channels.resolve асинхронный: сперва кэш, затем запрос к Discord:
                let pipe_channel_target = client.channels.cache.get (_pipe_channel_target);
                if (!pipe_channel_target)
                    pipe_channel_target = await client.channels.fetch (_pipe_channel_target).catch (() => null);
                if (pipe_channel_target) // check!
                {
                    pipe_channel_target.send
                    (
                        {
                            content: text
                                ? text
                                : undefined,
                            ...attach // || {}
                        }
                    )
                    .then
                    (
                        () =>
                        {
                            console.log
                            (
                                '[' + (d()) + '] [pipe] ' +
                                'message from bot (by ' + message.author.username + '): ' +
                                (
                                    text
                                        ? '"' + text + '"' + (files ? ' + <ATTACH>' : '')
                                        : '<ATTACH>'
                                )
                            );
                            // оригинал убираем ТОЛЬКО после успешной пересылки:
                            return message.delete ().catch
                            (
                                e => console.error ('[' + (d()) + '] [pipe] не смог удалить оригинал: ' + e.message)
                            );
                        }
                    )
                    .catch
                    (
                        e => console.error
                        (
                            '[' + (d()) + '] [pipe] НЕ переслано (' + e.message +
                            ') -- сообщение оставлено в источнике'
                        )
                    );
                }
                else
                {
                    console.log
                    (
                        '[' + (d()) + '] ' +
                        '[_CHANNEL_NOT_FOUND_] ' +
                        'message from bot (by ' + message.author.username + '): ' +
                        (
                            text
                                ? '"' + text + '"' + (files ? ' + <ATTACH>' : '')
                                : '<ATTACH>'
                        )
                    );
                }
            }
        }
        const server = message.guild.id; // Guild need!
        if (server in SERVERS && SERVERS[server].allow)
        {
            // [?] messages for bot 'panda' // '*'
            if (message.content.startsWith (PREFIX))
            {
                // [v2.4] активное действие -- в лог: кто и какую команду написал
                console.log ('[' + (d()) + '] [cmd] ' + (message.member ? uuu (message.member) : message.author.username) + ': ' + message.content.slice (0, 120));
                // command 'file' ## return the attach...
                if (message.content.startsWith (PREFIX + 'file'))
                {
                    let attach = attachOf (message);
                    message.channel.send
                    (
                        attach.files.length
                            ? {...attach}
                            : {content: 'no file ;('}
                    )
                    .catch (console.error);
                }
                // command 'pretty' ## test pretty embed ;D
                else if (message.content.startsWith (PREFIX + 'pretty'))
                {
                    message.channel.send
                    (
                        {
                            embeds:
                            [
                                {
                                    color: 0xFF0000, // 'RED',
                                    author:
                                    {
                                        name: uu (message.author), // SERVERS[server].name, // 'Автор',
                                        icon_url: message.author.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                    },
                                    thumbnail:
                                    {
                                        url: message.author.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                    },
                                    title: 'Предупреждение', // 'Оповещение',
                                    description: `${message.author}` + ', ```Вы забанены.```',
                                    footer:
                                    {
                                        text: SERVERS[server].name, // 'Администрация',
                                    },
                                    timestamp: dt(), // [v14] Date (locale-строка кидала 'Invalid time value'),
                                },
                            ],
                        }
                    )
                    .catch (console.error);
                }
                // command 'dm' ## DM to specific @user...
                else if (message.content.startsWith (PREFIX + 'dm'))
                {
                    // [v2.5] Раньше было три ловушки: цель только упоминанием (голый id
                    // игнорировался), команда удалялась ДО отправки (bulkDelete) и пользователь
                    // искался ТОЛЬКО в кэше -- если его там нет, ЛС не уходило без единой
                    // строки в логе. Теперь: удаляем команду ТОЛЬКО после успешной отправки.
                    let is_admin = !!message.member && !!SERVERS[server].role_admin &&
                        message.member._roles.includes (SERVERS[server].role_admin);
                    const { id, letter } = dmParse (message.content, message.mentions);
                    const attach = attachOf (message);
                    if (!is_admin)
                    {
                        console.log
                        (
                            '[' + (d()) + '] [dm] отказано: ' +
                            (message.member ? uuu (message.member) : message.author.username) +
                            ' -- нет роли админа'
                        );
                    }
                    else if (!id)
                    {
                        message.channel.send
                        (
                            {
                                content: '🤔 Кому? `panda dm @юзер текст` ' +
                                    'или `panda dm 123456789012345678 текст`'
                            }
                        )
                        .catch (console.error);
                    }
                    else if (!letter && !attach.files.length)
                    {
                        message.channel.send
                        (
                            { content: '🤔 Что отправить? В команде нет ни текста, ни вложения.' }
                        )
                        .catch (console.error);
                    }
                    else
                    {
                        // кэш -> запрос к Discord (в кэше далеко не все -- см. выше):
                        let user = client.users.cache.get (id);
                        if (!user) user = await client.users.fetch (id).catch (() => null);
                        if (!user)
                        {
                            message.channel.send
                            (
                                { content: '🤔 Пользователь с id `' + id + '` не найден.' }
                            )
                            .catch (console.error);
                        }
                        else
                        {
                            user.send ({content: letter ? letter : undefined, ...attach})
                            .then
                            (
                                () =>
                                {
                                    console.log
                                    (
                                        '[' + (d()) + '] [dm] ' +
                                            (message.member ? uuu (message.member) : message.author.username) +
                                            ' -> ' + uu (user) + ': ' +
                                            (
                                                letter
                                                    ? '"' + letter + '"' + (attach.files.length ? ' + <ATTACH>' : '')
                                                    : '<ATTACH>'
                                            )
                                    );
                                    // команду убираем ТОЛЬКО после успешной отправки:
                                    return message.delete ().catch
                                    (
                                        e => console.error ('[' + (d()) + '] [dm] не смог удалить команду: ' + e.message)
                                    );
                                }
                            )
                            .catch
                            (
                                e =>
                                {
                                    console.error ('[' + (d()) + '] [dm] НЕ отправлено ' + uu (user) + ': ' + e.message);
                                    // админ должен видеть причину, а не тишину:
                                    message.channel.send
                                    (
                                        { content: '⚠️ ЛС не ушло: `' + code (e.message) + '`' }
                                    )
                                    .catch (() => {});
                                }
                            );
                        }
                    }
                }
                // command 'test' ## в текстовом канале команда просто убирается из чата
                // (само ЛС отправил блок выше -- см. 'test' / self-test)
                else if (message.content.startsWith (PREFIX + 'test'))
                {
                    message.delete ().catch (console.error); // delete command?
                }
                // command 'help' ## [v2.6] инструкция уже ушла в ЛС (блок выше) --
                // в канале убираем саму команду:
                else if (message.content.startsWith (PREFIX + 'help'))
                {
                    message.delete ().catch (console.error);
                }
            }
        }
    }
});
// [v2.5] Перенос участника в голосовой канал.
// Важно: setChannel() принимает канал ТОЛЬКО из кэша guild -- если id там нет
// (старый config.json, канала больше нет, бота не перезапустили после правки),
// discord.js падает с 'Could not resolve channel to a guild voice channel'.
// Поэтому резолвим сами (кэш -> запрос к Discord) и пишем в лог, ЧТО именно не так.
async function moveToVoice (state, channel_id, reason)
{
    let who = state.member ? uuu (state.member) : state.id;
    if (!channel_id) return false;
    let target = state.guild.channels.cache.get (channel_id);
    if (!target) target = await state.guild.channels.fetch (channel_id).catch (() => null);
    if (!target)
    {
        console.error ('[voice] перенос ' + who + ': канала ' + channel_id + ' нет -- проверь config.json и ПЕРЕЗАПУСТИ бота');
        return false;
    }
    if (typeof target.isVoiceBased !== 'function' || !target.isVoiceBased ())
    {
        console.error ('[voice] перенос ' + who + ': канал "' + target.name + '" не голосовой (type=' + target.type + ')');
        return false;
    }
    let ok = true;
    await state.setChannel (target, reason)
        .catch (e => { ok = false; console.error ('[voice] перенос ' + who + ' в "' + target.name + '": ' + e.message); });
    return ok;
}

// Members with MANAGE_CHANNELS:
async function ownersOf (channel)
{
    var owners = channel
       .permissionOverwrites
            .cache //+
                .filter
                (
                    permission =>
                        permission.type === 1 && // [v14] OverwriteType.Member === 1 ('member' -- строки больше нет)
                        // [v14] allow/deny -- PermissionsBitField (не Collection):
                        permission.allow.has (PermissionsBitField.Flags.ManageChannels)
                );
    // [!!!!] FETCH data from Discord! ~ Cache.
    // Parallel processing:
    var promises = owners.map
    (
        owner => channel.guild.members.fetch (owner.id)
        .then
        (
            member =>
            {
                if (member && !member.user.bot)
                    owners.set (owner.id, member);
                else
                    owners.delete (owner.id);
            }
        )
        .catch (console.error)
    );
    await Promise.all (promises);
    // Collection:
    return owners;
}

// [v2.3.4] ADM/MOD-роли: бот НЕ управляет их ключом 🔑 -- права у них и так есть
// в любом канале, а захотят -- поставят себе сами (и бот его не срежет):
function isStaff (server, member)
{
    return !!member &&
    (
        (SERVERS[server].role_admin && member.roles.cache.has (SERVERS[server].role_admin)) ||
        (SERVERS[server].role_moder && member.roles.cache.has (SERVERS[server].role_moder))
    );
}

async function modNick (server, member/*, add = false*/)
{
    const tag = '🔑'; // 🔴
    if (SERVERS[server].addTag || false)
    {
        if (!member.user.bot) // [v2.2.3] тег -- ЛЮБОМУ с правами в канале
        {
            let nick = member.nickname || member.user.username;
            // [v2.3.5] СМЫСЛ КЛЮЧА: гарантия «права в канале 100%» для обычных участников.
            // ADM/MOD -- исключение: права у них и так всегда есть, и все свои это знают,
            // поэтому ключа у staff быть НЕ должно -- даже самодрисованный бот удаляет:
            if (isStaff (server, member))
            {
                if (nick.startsWith (tag))
                {
                    console.log ('[' + (d()) + '] [nick] -🔑 (staff) ' + member.user.username);
                    await member.setNickname (nick.slice (tag.length))
                        .catch (e => console.error ('[nick] error on setNickname: ' + e.message));
                }
                return;
            }
            if
            (
                member.voice.channel &&
                (
                    member.voice.channel.permissionsFor(member).has(PermissionsBitField.Flags.ManageChannels) ||
                    member.voice.channel.permissionsFor(member).has(PermissionsBitField.Flags.ManageRoles) ||
                    member.voice.channel.permissionsFor(member).has(PermissionsBitField.Flags.MoveMembers) ||
                    member.voice.channel.permissionsFor(member).has(PermissionsBitField.Flags.DeafenMembers) ||
                    member.voice.channel.permissionsFor(member).has(PermissionsBitField.Flags.MuteMembers)
                )
            )
            {
                // [FIX v2.3.3] точная проверка ключа: старый чар-код 0xD83D ловил ЛЮБОЙ
                // эмодзи в начале ника (💙, 🔊...) и срезал его, думая что это ключ:
                if (!nick.startsWith (tag))
                {
                    let nickNew = tag + nick;
                    console.log ('[' + (d()) + '] [nick] +🔑 ' + member.user.username + ' in ' + member.voice.channel.name);
                    await member.setNickname (nickNew)
                        .catch (e => console.error ('[nick] error on setNickname: ' + e.message)); // [!] при ошибке прав -- видно в логе
                }
            }
            else
            {
                // [FIX v2] убираем только ВЕДУЩИЙ тег, а не все вхождения:
                nickNew = nick.startsWith (tag) ? nick.slice (tag.length) : nick;
                if (nickNew !== nick)
                {
                    console.log ('[' + (d()) + '] [nick] -🔑 ' + member.user.username);
                    await member.setNickname (nickNew)
                        .catch (e => console.error ('[nick] error on setNickname: ' + e.message));
                }
            }
        }
    }
}

// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-channelCreate
client.on ('channelCreate', async (newChannel) =>
{
    // [v14] у каналов больше нет .guild -- берём из кэша гильдий:
    const guild = newChannel.guild ?? client.guilds.cache.get (newChannel.guildId);
    if (guild) // [!???]
    {
        const server = guild.id; // Guild need!
        if (server in SERVERS && SERVERS[server].allow)
        {
            // [v2.4] активное событие -- в лог:
            console.log ('[' + (d()) + '] [channel] создан ' + (newChannel.parent ? '«' + newChannel.parent.name + '» / ' : '') + '«' + newChannel.name + '»');
            let log_channel = SERVERS[server].log_channel;
            if (newChannel.type === ChannelType.GuildVoice)
            {
                // https://discord.js.org/#/docs/main/stable/typedef/PremiumTier:
                // ?:DEFAULT=64,0:NONE=96,1:TIER_1=128,2:TIER_2=256,3:TIER_3=384.
                /*let*/var bitrate = 64; // DEFAULT?
                switch (newChannel.guild.premiumTier)
                {
                       case   'NONE': bitrate =  96; break; // NONE
                       case 'TIER_1': bitrate = 128; break; // TIER_1
                       case 'TIER_2': bitrate = 256; break; // TIER_2
                       case 'TIER_3': bitrate = 384; break; // TIER_3
                    // default: bitrate = 64; break; // DEFAULT
                }
                // [v14] setBitrate принимает число bps (строка '64000' -- INVALID_TYPE):
                newChannel.setBitrate (bitrate * 1000) // bitrate: int value should be less than or equal to 256000.
                .catch (e => console.error ('[channelCreate] error on setBitrate: ' + e.message));
                // panda: ['🚫NO VIDEO🚫']
                if (SERVERS[server].role_for_no_stream)
                {
                    newChannel.permissionOverwrites.edit
                    (
                        SERVERS[server]
                            .role_for_no_stream,
                        {
                            Stream: false,
                        }
                    )
                    .catch (console.error);
                };
                // panda: ['🙊полный мут🙊'], ['🔇VOICE MUTED🔇']
                if (SERVERS[server].role_for_no_speak)
                {
                    newChannel.permissionOverwrites.edit
                    (
                        SERVERS[server]
                            .role_for_no_speak,
                        {
                            Speak: false,
                        }
                    )
                    .catch (console.error);
                };
                // panda: ['🙊полный мут🙊'], ['🔇VOICE MUTED🔇']
                if (SERVERS[server].role_for_no_media)
                {
                    newChannel.permissionOverwrites.edit
                    (
                        SERVERS[server]
                            .role_for_no_media,
                        {
                            AttachFiles: false,
                            EmbedLinks: false,
                            UseExternalEmojis: false,
                            UseExternalStickers: false,
                        }
                    )
                    .catch (console.error);
                };
                if (SERVERS[server].role_for_no_chat)
                {
                    newChannel.permissionOverwrites.edit
                    (
                        SERVERS[server]
                            .role_for_no_chat,
                        {
                            SendMessages: false,
                        }
                    )
                    .catch (console.error);
                };
                let owners = await ownersOf (newChannel);
                for (let [id, owner] of owners)
                {
                    // https://stackoverflow.com/questions/52580903/how-to-overwrite-channel-permissions-with-bitfield
                    newChannel.permissionOverwrites.edit
                    (
                        id, // owner.id
                        {
                            //MANAGE_CHANNELS:
                            //ManageRoles: true,
                              ManageRoles: owner.roles.cache.has (SERVERS[server].role_for_manage) ? true : null,
                                     Speak: true,
                              MuteMembers: true,
                            DeafenMembers: true,
                              MoveMembers: owner.roles.cache.has (SERVERS[server].role_for_manage) ? true : null,
                            //ViewChannel: true,
                        }
                    )
                    .then
                    (
                        async channel =>
                        {
                            // owner
                            await modNick
                            (
                                server, owner
                            )
                            .catch (console.error);
                            // logging
                            if (log_channel)
                            {
                                // message to log channel:
                                let log_text = `${owner.user}` + ' **получает** 💪 права на канал `' + code(cc(newChannel)) + '` 🟩';
                                client.channels.resolve(log_channel).send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                author:
                                                {
                                                    name: uuu (owner), // uu (owner.user),
                                                    icon_url: owner.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                },
                                                color: 0x0000FF, // 'BLUE',
                                                description: log_text,
                                                footer:
                                                {
                                                    text: SERVERS[server].name,
                                                },
                                                timestamp: dt(),
                                            },
                                        ]
                                    }
                                )
                                .catch (console.error);
                            }
                            console.log ('[' + (d()) + '] ' + owner.user.username + ' get rights1 in ' + newChannel.name);
                        }
                    )
                    .catch (e => console.error ('[channelUpdate] error on updateOverwrite: ' + e.message));
                }
            }
        }
    }
});

// https://maah.gitbooks.io/discord-bots/content/getting-started/roles-and-channels-permissions.html
// [v2.4] активное событие: канал удалён -- в лог:
client.on ('channelDelete', (channel) =>
{
    const server = channel.guild ? channel.guild.id : '';
    if (server in SERVERS && SERVERS[server].allow)
        console.log ('[' + (d()) + '] [channel] удалён ' + (channel.parent ? '«' + channel.parent.name + '» / ' : '') + '«' + channel.name + '»');
});

client.on ('channelUpdate', async (oldChannel, newChannel) =>
{
    // [v14] у каналов больше нет .guild -- берём из кэша гильдий:
    const guild = newChannel.guild ?? client.guilds.cache.get (newChannel.guildId);
    const server = guild.id; // Guild need!
    if (server in SERVERS && SERVERS[server].allow)
    {
        if (newChannel.type === ChannelType.GuildVoice)
        {
            let log_channel = SERVERS[server].log_channel;
            let oldOwners = await ownersOf (oldChannel);
            let owners = await ownersOf (newChannel);
            // channel:overview:rename
            if (oldChannel.name !== newChannel.name)
            {
                if (log_channel)
                {
                    // message to log channel:
                    let log_text = 'Канал `' + code(cc(oldChannel)) + '` **переименован** ➡️ в `' + code(cc(newChannel)) + '` 🟦';
                    client.channels.resolve(log_channel).send
                    (
                        {
                            embeds:
                            [
                                {
                                    author:
                                    {
                                        // [FIX v2] скобки! 'str + a ? b : c' в v13 всегда давало b,
                                        // а при пустых owners -- строку 'NaN' в поле author:
                                        name: 'Владельцы канала: ' + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*'),
                                    },
                                    color: 0x0000FF, // 'BLUE' -- [v14] капсом не распознаётся EmbedBuilder'ом,
                                    description: log_text,
                                    footer:
                                    {
                                        text: SERVERS[server].name,
                                    },
                                    timestamp: dt(),
                                },
                            ]
                        }
                    )
                    .catch (console.error);
                }
                console.log ('[' + (d()) + '] channel ' + oldChannel.name + ' renamed to ' + newChannel.name);
            }
            // channel:permissions:add/edit/...
            let all = new Map([...newChannel.members, ...owners, ...oldOwners]);
            for (let [id, member] of all)
            {
                if (owners.has (id))
                {
                    if (!oldOwners.has (id))
                    {
                        let owner = member;
                        newChannel.permissionOverwrites.edit
                        (
                            id, // owner.id
                            {
                                //MANAGE_CHANNELS:
                                //ManageRoles: true,
                                ManageRoles: owner.roles.cache.has (SERVERS[server].role_for_manage) ? true : null,
                                         Speak: true,
                                  MuteMembers: true,
                                DeafenMembers: true,
                                MoveMembers: owner.roles.cache.has (SERVERS[server].role_for_manage) ? true : null,
                            }
                        )
                        .then
                        (
                            async channel =>
                            {
                                // owner
                                await modNick
                                (
                                    server, owner
                                )
                                .catch (console.error);
                                if (log_channel)
                                {
                                    // message to log channel:
                                    let log_text = `${owner.user}` + ' **получает** 💪 права на канал `' + code(cc(newChannel)) + '` 🟩';
                                    client.channels.resolve(log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (owner), // uu (owner.user),
                                                        icon_url: owner.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0x0000FF, // 'BLUE',
                                                    description: log_text,
                                                    footer:
                                                    {
                                                        text: SERVERS[server].name,
                                                    },
                                                    timestamp: dt(),
                                                },
                                            ]
                                        }
                                    )
                                    .catch (console.error);
                                }
                                console.log ('[' + (d()) + '] ' + owner.user.username + ' get rights2 in ' + newChannel.name);
                            }
                        )
                        .catch (e => console.error ('[channelUpdate] error on updateOverwrite: ' + e.message));
                    }
                    else
                    {
                        // owners yet!!
                    }
                }
                else
                {
                    // check ex owners!!!:
                    // exOwner
                    //// member
                    await modNick
                    (
                        server, member
                    )
                    .catch (console.error);
                }
            }
        }
    }
});

client.on
(
        'guildMemberUpdate',
    async (oldMember, newMember) =>
    {
        const server = newMember.guild.id; // Guild need!
        if (server in SERVERS && SERVERS[server].allow)
        {
            await modNick
            (
                server, newMember
            )
            .catch (console.error);
        }
    }
);

// ============================================================
// [v2.4] АВТОРСТВО ДЕЙСТВИЙ
// voiceStateUpdate автора НЕ содержит -- его сообщает журнал аудита
// (интент GuildModeration -- НЕ привилегированный, одобрения не требует).
// Кэш из гейтвея + фолбэк свежим REST-запросом (если событие ещё не дошло).
// ============================================================
const $audit = []; // {action, targetId, who, at, used}

// из MemberUpdate нам важны только мут/глухота (ники/роли -- не наше дело)
function isMuteDeafChange (changes)
{
    return (changes || []).some (c => /^\$?(mute|deaf)$/i.test (String (c.key)));
}

client.on ('guildAuditLogEntryCreate', (entry, guild) =>
{
    try
    {
        if (!guild || !SERVERS[guild.id] || !SERVERS[guild.id].allow) return;
        if (entry.action === AuditLogEvent.MemberUpdate && !isMuteDeafChange (entry.changes)) return;
        $audit.push
        ({
            action: entry.action,
            targetId: entry.targetId || null,
            who: (entry.executor && entry.executor.username) || null,
            at: Date.now (),
            used: false,
        });
        if ($audit.length > 300) $audit.splice (0, $audit.length - 300);
    }
    catch (e) { console.error ('[audit] error: ' + e.message); }
});

// кто совершил action над targetId. targetId === null -- цель в журнале не указана
// (Discord не пишет её для переносов/отключений), тогда связываем по времени.
async function auditWho (guild, action, targetId, maxAgeMs = 20000)
{
    for (let i = $audit.length - 1; i >= 0; i--)
    {
        let r = $audit[i];
        if (r.action !== action) continue;
        if (targetId && r.targetId !== targetId) continue;
        if (!targetId && r.used) continue;
        if ((Date.now () - r.at) > maxAgeMs) continue;
        if (!targetId) r.used = true;
        return r.who;
    }
    if (!guild) return null;
    try
    {
        let logs = await guild.fetchAuditLogs ({ type: action, limit: 5 });
        for (const e of logs.entries.values ())
        {
            if (targetId && e.targetId !== targetId) continue;
            if (action === AuditLogEvent.MemberUpdate && !isMuteDeafChange (e.changes)) continue;
            if ((Date.now () - e.createdTimestamp) > maxAgeMs) continue;
            return (e.executor && e.executor.username) || null;
        }
    }
    catch (e) { /* нет прав или лимит -- просто без автора */ }
    return null;
}

// '(кто: Имя) ' (или '(кто: бот) ', если действовал сам бот)
function whoText (who)
{
    if (!who) return '';
    return '(кто: ' + ((client.user && who === client.user.username) ? 'бот' : who) + ') ';
}

// строка действия + автор (мут/разглухота и т.п.) -- ждём запись журнала, потом пишем одной строкой
function logAction (guild, action, targetId, text)
{
    setTimeout (() =>
    {
        auditWho (guild, action, targetId, 20000)
        .then (who => console.log ('[' + (d()) + '] ' + whoText (who) + text))
        .catch (() => console.log ('[' + (d()) + '] ' + text));
    }, 700);
}

// то же, но для событий без цели в журнале (перенос/отключение) -- отдельной строкой
function byWhom (guild, action, text)
{
    setTimeout (() =>
    {
        auditWho (guild, action, null, 12000)
        .then (who => { if (who) console.log ('[' + (d()) + '] ' + whoText (who) + text); })
        .catch (() => {});
    }, 1500);
}

// [v2.4] Активные голосовые события -- всегда в лог (вход/выход/переход/микрофон/наушники/стрим/камера):
function logVoiceEvent (oldState, newState)
{
    try
    {
        if (!newState.member || newState.member.user.bot) return; // боты (в т.ч. сам бот с музыкой) -- не шумим
        let who = uuu (newState.member);
        let nm = (st) => st.channel ? ('«' + st.channel.name + '»') : ('[канал ' + st.channelId + ']');
        let o = oldState.channelId, n = newState.channelId;
        if      (!o && n)           console.log ('[' + (d()) + '] [voice] + ' + who + ' -> ' + nm (newState));
        else if (o && !n)
        {
            console.log ('[' + (d()) + '] [voice] - ' + who + ' <- ' + nm (oldState));
            byWhom (newState.guild, AuditLogEvent.MemberDisconnect, 'выкинул из голосового ' + who);
        }
        else if (o && n && o !== n)
        {
            console.log ('[' + (d()) + '] [voice] > ' + who + ': ' + nm (oldState) + ' -> ' + nm (newState));
            byWhom (newState.guild, AuditLogEvent.MemberMove, 'перенёс ' + who + ': ' + nm (oldState) + ' -> ' + nm (newState));
        }
        if (oldState.selfMute  !== newState.selfMute)
            console.log ('[' + (d()) + '] [voice] микрофон '  + (newState.selfMute  ? 'ВЫКЛ' : 'ВКЛ') + ': ' + who + ' ' + nm (newState));
        if (oldState.selfDeaf  !== newState.selfDeaf)
            console.log ('[' + (d()) + '] [voice] наушники '  + (newState.selfDeaf  ? 'ВЫКЛ' : 'ВКЛ') + ': ' + who + ' ' + nm (newState));
        if (oldState.selfStream !== newState.selfStream && newState.selfStream)
            console.log ('[' + (d()) + '] [voice] стрим ВКЛ: '    + who + ' ' + nm (newState));
        if (oldState.selfVideo  !== newState.selfVideo  && newState.selfVideo)
            console.log ('[' + (d()) + '] [voice] камера ВКЛ: '   + who + ' ' + nm (newState));
    }
    catch (e) { console.error ('[voice] log error: ' + e.message); }
}

client.on ('voiceStateUpdate', async (oldState, newState) =>
{
    const server = newState.guild.id; // Guild need!
    if (server in SERVERS && SERVERS[server].allow)
    {
        logVoiceEvent (oldState, newState);
        scheduleVoiceStatus (server); // [v2.7] «в канале: N» в статусе канала (дебаунс)
        await modNick
        (
            server, newState.member
        )
        .catch (console.error);
        // [v2.3] личные каналы: заход в лобби -> создать; выход из категории -> чистка пустых:
        let temp_lobby = SERVERS[server].temp_lobby || '';
        let temp_category = SERVERS[server].temp_category || '';
        if (temp_lobby && newState.channelId === temp_lobby)
            await tempCreateFor (server, newState.member).catch (console.error);
        if (oldState.channelId && (oldState.channelId === temp_lobby ||
            (oldState.channel && oldState.channel.parentId === temp_category)))
            await tempSweep (server).catch (console.error);
        // Stage type channel is null! But exists channelID.
        if (newState.channel === null && newState.channelId)
        {
            if (newState.serverMute)
            {
                // unmute
                newState.setMute (false)
                .catch (console.error);
            }
            if (newState.serverDeaf)
            {
                // undeaf
                newState.setDeaf (false)
                .catch (console.error);
            }
        }
        if (newState.channel && newState.channel.id)
        {
            // let admin = SERVERS[server].admins.includes (newState.member.id);
            let admin = newState.member._roles.includes (SERVERS[server].role_admin);
            let moder = newState.member._roles.includes (SERVERS[server].role_moder);
            let log_channel = SERVERS[server].log_channel || ''; // log_channel_temp ?
            let channel_common = SERVERS[server].channel_common || '';
            let afkLikeChannels = [newState.guild.afkChannelId] // [v14] afkChannelId (camelCase)
                .concat (SERVERS[server].afkLikeChannels || []);
            // [?!] https://stackoverflow.com/questions/43010642/checking-who-issued-a-server-mute-on-another-user
            // mute || deaf || unmute || undeaf: let action = ''; // ...
            if (!newState.member.user.bot)
            {
                let owners = await ownersOf (newState.channel);
                // [undefined] Protect! // ~unMute?..
                if (!newState.channel.id) return; // 0_o ?
                if (oldState.serverMute === null) // undefined
                    oldState.serverMute = newState.serverMute;
                if (oldState.serverDeaf === null) // undefined
                    oldState.serverDeaf = newState.serverDeaf;
                if (newState.channel.id === channel_common) return; //!
                if (!oldState.serverMute && newState.serverMute) // MUTE
                {
                    // [v14] allow/deny -- PermissionsBitField:
                    if
                    (
                        !newState.channel.permissionOverwrites.cache.get(newState.id) ||
                        !newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Speak)
                    )
                    {
                        // /*You are not Admin|moder and */in Common channel...
                        if (newState.channel.id === channel_common) // unMUTE for Appeal!
                        {
                            newState.setMute (false)
                            .catch (console.error);
                            if (log_channel)
                            {
                                // message to log channel:
                                let log_text = 'На ' + `${newState.member}` + ' поступила 🚫 **жалоба** в канале `' + code(cc(newState.channel)) + '` 🆘';
                                client.channels.resolve(log_channel).send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                author:
                                                {
                                                    name: uuu (newState.member), // uu (newState.member.user),
                                                    icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                },
                                                color: 0xFF0000, // 'RED',
                                                description: log_text,
                                                footer:
                                                {
                                                    text: SERVERS[server].name,
                                                },
                                                timestamp: dt(),
                                            },
                                        ]
                                    }
                                )
                                .catch (console.error);
                            }
                            console.log ('[' + (d()) + '] ' + newState.member.user.username + ' get appeal in ' + newState.channel.name);
                        }
                        // /*You are Admin|moder or */not in Common channel...
                        else
                        {
                            newState.channel.permissionOverwrites.edit
                            (
                                newState.id,
                                {
                                    Speak: false,
                                }
                            )
                            .then
                            (
                                channel =>
                                {
                                    // notify from bot:
                                    let notify_text =
                                        `${newState.member}, вам **запрещено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟨\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    newState.member.send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    color: 0xFFFF00, // 'YELLOW', 'ORANGE', '#FFA500' ?
                                                    description: notify_text,
                                                },
                                            ]
                                        }
                                    )
                                    .catch (e => console.error ('[voiceStateUpdate] error on newState.member.send: ' + e.message));
                                    if (log_channel)
                                    {
                                        // message to log channel:
                                        let log_text =
                                            `${newState.member} **запрещено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟨\n` +
                                            `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                            `Подробности смотрите в журнале аудита.`;
                                        client.channels.resolve(log_channel).send
                                        (
                                            {
                                                embeds:
                                                [
                                                    {
                                                        author:
                                                        {
                                                            name: uuu (newState.member), // uu (newState.member.user),
                                                            icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                        },
                                                        color: 0xFFFF00, // 'YELLOW',
                                                        description: log_text,
                                                        footer:
                                                        {
                                                            text: SERVERS[server].name,
                                                        },
                                                        timestamp: dt(),
                                                    },
                                                ]
                                            }
                                        )
                                        .catch (console.error);
                                    }
                                    logAction (newState.guild, AuditLogEvent.MemberUpdate, newState.id, newState.member.user.username + ' get mute in ' + channel.name);
                                }
                            )
                            .catch (console.error);
                        }
                    }
                }
                else if (!oldState.serverDeaf && newState.serverDeaf) // DEAF
                {
                    if (newState.channel.name === 'Кабинет Уролога') return; // tut
                    if
                    (
                        !newState.channel.permissionOverwrites.cache.get(newState.id) ||
                        !newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Connect)
                    )
                    {
                        newState.channel.permissionOverwrites.edit
                        (
                            newState.id,
                            {
                                //SPEAK: false,
                                //STREAM: false,
                                Connect: false,
                            }
                        )
                        .then
                        (
                            async channel =>
                            {
                                if (channel_common && channel.id !== channel_common)
                                {
                                    // [v2.5] резолв канала + внятный лог (см. moveToVoice):
                                    if (await moveToVoice (newState, channel_common, 'Запрещённый канал (deaf)'))
                                    {
                                        // [v2.5] если deaf-участника отправляем в лобби личных
                                        // каналов -- не ждём до 45 сек следующего тика поллера,
                                        // комната создаётся сразу (tempCreateFor идемпотентна):
                                        if (SERVERS[server].temp_lobby === channel_common)
                                            setTimeout
                                            (
                                                () => tempCreateFor (server, newState.member)
                                                    .catch (e => console.error ('[temp] ' + e.message)),
                                                1500
                                            );
                                    }
                                }
                                else
                                {
                                    newState.kick()
                                    .catch (e => console.error ('[voiceStateUpdate] error on newState.kick: ' + e.message));
                                }
                                // notify from bot:
                                let notify_text =
                                    `${newState.member}, вам **запрещено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟥\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                newState.member.send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                color: 0xFF0000, // 'RED',
                                                description: notify_text,
                                            },
                                        ]
                                    }
                                )
                                .catch (e => console.error ('[voiceStateUpdate] error on newState.member.send: ' + e.message));
                                if (log_channel)
                                {
                                    // message to log channel:
                                    let log_text =
                                        `${newState.member}, **запрещено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟥\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    client.channels.resolve(log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (newState.member), // uu (newState.member.user),
                                                        icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0xFF0000, // 'RED',
                                                    description: log_text,
                                                    footer:
                                                    {
                                                        text: SERVERS[server].name,
                                                    },
                                                    timestamp: dt(),
                                                },
                                            ]
                                        }
                                    )
                                    .catch (console.error);
                                }
                                logAction (newState.guild, AuditLogEvent.MemberUpdate, newState.id, newState.member.user.username + ' get deaf in ' + channel.name);
                            }
                        )
                        .catch (console.error);
                    }
                }
                else if (oldState.serverMute && !newState.serverMute) // unMUTE
                {
                    if
                    (
                        newState.channel.permissionOverwrites.cache.get(newState.id) &&
                        newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Speak)
                    )
                    {
                        newState.channel.permissionOverwrites.edit
                        (
                            newState.id,
                            {
                                Speak: null,
                            }
                        )
                        .then
                        (
                            channel =>
                            {
                                // notify from bot:
                                let notify_text =
                                    `${newState.member}, вам **разрешено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟩\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                newState.member.send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                color: 0x00FF00, // 'GREEN',
                                                description: notify_text,
                                            },
                                        ]
                                    }
                                )
                                .catch (e => console.error ('[voiceStateUpdate] error on newState.member.send: ' + e.message));
                                if (log_channel)
                                {
                                    // message to log channel:
                                    let log_text =
                                        `${newState.member} **разрешено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟩\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    client.channels.resolve(log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (newState.member), // uu (newState.member.user),
                                                        icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0x00FF00, // 'GREEN',
                                                    description: log_text,
                                                    footer:
                                                    {
                                                        text: SERVERS[server].name,
                                                    },
                                                    timestamp: dt(),
                                                },
                                            ]
                                        }
                                    )
                                    .catch (console.error);
                                }
                                logAction (newState.guild, AuditLogEvent.MemberUpdate, newState.id, newState.member.user.username + ' get unmute in ' + channel.name);
                            }
                        )
                        .catch (console.error);
                    }
                }
                else if (oldState.serverDeaf && !newState.serverDeaf) // unDEAF
                {
                    if
                    (
                        newState.channel.permissionOverwrites.cache.get(newState.id) &&
                        newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Connect)
                    )
                    {
                        newState.channel.permissionOverwrites.edit
                        (
                            newState.id,
                            {
                                ///SPEAK: null,
                                //STREAM: null,
                                Connect: null,
                            }
                        )
                        .then
                        (
                            channel =>
                            {
                                // notify from bot:
                                let notify_text =
                                    `${newState.member}, вам **разрешено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟩\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                newState.member.send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                color: 0x00FF00, // 'GREEN',
                                                description: notify_text,
                                            },
                                        ]
                                    }
                                )
                                .catch (e => console.error ('[voiceStateUpdate] error on newState.member.send: ' + e.message));
                                if (log_channel)
                                {
                                    // message to log channel:
                                    let log_text =
                                        `${newState.member}, **разрешено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟩\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    client.channels.resolve(log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (newState.member), // uu (newState.member.user),
                                                        icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0x00FF00, // 'GREEN',
                                                    description: log_text,
                                                    footer:
                                                    {
                                                        text: SERVERS[server].name,
                                                    },
                                                    timestamp: dt(),
                                                },
                                            ]
                                        }
                                    )
                                    .catch (console.error);
                                }
                                logAction (newState.guild, AuditLogEvent.MemberUpdate, newState.id, newState.member.user.username + ' get undeaf in ' + channel.name);
                            }
                        )
                        .catch (console.error);
                    }
                }
                else // GARANTEEs:
                {
                    if // MUTEd
                    (
                        newState.channel.permissionOverwrites.cache.get(newState.id) &&
                        newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Speak)
                    )
                    {
                        if (!newState.serverMute)
                        {
                            // mute
                            newState.setMute (true)
                            .catch (console.error);
                        }
                    }
                    else
                    {
                        if (newState.serverMute)
                        {
                            // unmute
                            newState.setMute (false)
                            .catch (console.error);
                        }
                    }
                    if // DEAFed
                    (
                        newState.channel.permissionOverwrites.cache.get(newState.id) &&
                        newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Connect)
                    )
                    {
                        if (!newState.serverDeaf)
                        {
                            // deaf
                            newState.setDeaf (true)
                            .catch (console.error);
                        }
                    }
                    else
                    {
                        if (newState.serverDeaf)
                        {
                            // undeaf
                            newState.setDeaf (false)
                            .catch (console.error);
                        }
                    }
                }
            }
            else
            {
                // for Bots!
            };
        }
    }
});

// [v14] мёртвый обработчик 'voiceStateUpdate_OFFed' из v13 удалён (был unreachable).
// ============================================================================
// [v2.1] REST-ПОЛЛЕР УЧАСТНИКОВ (замена guildMemberAdd/guildMemberRemove):
// ============================================================================

const POLL_PERIOD = 45 * 1000; // раз в 45 сек (REST без интента; лимиты не трогаем)

// Снапшоты участников по серверам: server_id -> Map<user_id, {user, member}>
var $membersSnapshot = {};

// [v2.5] Поллер отдаёт СЫРОЙ JSON участника из REST, а логам нужен объект User:
// у сырого нет displayAvatarURL() (была ошибка 'memberUser.displayAvatarURL is not
// a function'), а упоминание рисовалось как [object Object]. Разрешаем в User.
async function resolveUser (uid, raw)
{
    let user = client.users.cache.get (uid);
    if (!user) user = await client.users.fetch (uid).catch (() => null);
    if (user) return user;
    // крайний случай (пользователь недоступен) -- лог не должен падать:
    let stub =
    {
        id: uid,
        username: (raw && raw.user && raw.user.username) || uid,
        displayAvatarURL: () => null,
        toString: () => '<@' + uid + '>',
    };
    return stub;
}

// Лог входа/выхода участника в журнал (как было на событиях):
async function logMemberJoinLeave (server, memberUser, isJoin)
{
    try
    {
        let log_channel = SERVERS[server].log_channel || '';
        if (!log_channel) return;
        let channel = client.channels.cache.get (log_channel);
        if (!channel) channel = await client.channels.fetch (log_channel).catch (() => null);
        if (!channel)
        {
            console.error ('[member] лог-канал ' + log_channel + ' не найден');
            return;
        }
        let log_text = isJoin
            ? `${memberUser} **зашёл** 👋 на сервер \`${SERVERS[server].name}\` 🟩`
            : `${memberUser} **вышел** 🚪 с сервера \`${SERVERS[server].name}\` 🟥`;
        let author = {name: memberUser.username}; // без icon_url, если аватара нет
        // [FIX v2.9.1] у заглушки (пользователь недоступен) аватары нет -- null в icon_url
        // Discord не примет, а записи о входе/выходе терять нельзя. Проверяем значение:
        let icon = (typeof memberUser.displayAvatarURL === 'function')
            ? memberUser.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024})
            : null;
        if (icon) author.icon_url = icon;
        channel.send
        (
            {
                content: `${memberUser}`,
                embeds:
                [
                    {
                        author: author,
                        color: isJoin ? 0x00FF00 : 0xFF0000, // GREEN / RED
                        description: log_text,
                        footer:
                        {
                            text: SERVERS[server].name,
                        },
                        timestamp: dt(),
                    },
                ]
            }
        )
        .catch (console.error);
    }
    catch (e)
    {
        // Ошибка лога НЕ должна ронять поллер (иначе снапшот не обновится и
        // один и тот же человек будет 'входить' на каждом тике).
        console.error ('[member] logMemberJoinLeave: ' + e.message);
    }
}

// [!!!] Рестарт-безопасность: ban-таймеры живут в памяти (setTimeout) и умирают
// вместе с процессом. Теперь при каждом старте (и в каждом тике поллера)
// проверяем просроченные membersBanTimeout в SQLite и снимаем баны.
async function sweepExpiredBans (server)
{
    let unbannedAny = false;
    try
    {
        let rows = [];
        for await (const [key, value] of $db[server]['membersBanTimeout'].iterator())
        {
            rows.push ([key, value]);
        }
        for (let [id, until] of rows)
        {
            if (typeof until !== 'number') continue; // не таймаут-запись
            if (Date.now() >= until)
            {
                await db (server, 'membersBanTimeout', id, null);
                unbannedAny = true;
                await client.guilds.cache.get (server).members.unban (id, 'Таймаут истёк (снято при проверке)')
                .then
                (
                    user => console.log ('[' + (d()) + '] member ' + (user ? user.username : id) + ' unbanned (sweep)')
                )
                .catch
                (
                    e =>
                    {
                        // Не забанен/уже снят -- запись уже вычищена, это не ошибка.
                        if (!/Unknown Ban|404/i.test (e.message))
                            console.error ('[sweepExpiredBans] unban error: ' + e.message);
                    }
                );
            }
        }
    }
    catch (e)
    {
        console.error ('[sweepExpiredBans] error: ' + e.message);
    }
    return unbannedAny;
}

// Полная выгрузка участников гильдии через REST (пагинация по 1000):
async function fetchAllMembersRest (guildId)
{
    let members = new Map(); // user_id -> raw member object
    let after = '0';
    for (;;)
    {
        const data = await client.rest.get
        (
            '/guilds/' + guildId + '/members?limit=1000&after=' + after
        );
        if (!Array.isArray (data) || !data.length) break;
        for (let m of data)
        {
            members.set (m.user.id, m);
        }
        after = data[data.length - 1].user.id;
        if (data.length < 1000) break;
    }
    return members;
}

// Обработка ВХОДА (бывший guildMemberAdd): бан-таймаут при перезаходе.
// [v2.1] Welcome-ЛС отключены (по решению владельца).
async function handleMemberJoin (server, uid, raw)
{
    const guild = client.guilds.cache.get (server);
    let onLeaveBanTimeout = SERVERS[server].onLeaveBanTimeout || 0;
    let onEnterBanRealy = SERVERS[server].onEnterBanRealy || false;
    let membersBanTimeout = await db (server, 'membersBanTimeout', uid);
    if (membersBanTimeout)
    {
        let user = raw ? raw.user : await client.users.fetch (uid).catch(() => null);
        if (user)
        {
            let notify_text =
            `${user}, вам временно **ограничен** 🏃 вход на сервер \`${SERVERS[server].name}\` 🟥\n` +
            `Из-за перезаходов для обхода блокировок, установлен таймаут: \`${onLeaveBanTimeout} мин.\`\n` +
            `Вы сможете зайти \`${d(membersBanTimeout, true)}\`, это через \`${dd(membersBanTimeout)}\``;
            await client.users.fetch (uid)
            .then
            (
                fetched =>
                {
                    fetched.send
                    (
                        {
                            embeds:
                            [
                                {
                                    color: 0xFF0000, // 'RED',
                                    description: notify_text,
                                },
                            ]
                        }
                    )
                }
            )
            .catch (e => console.error ('[memberJoin] error on user.send: ' + e.message));
        }
        else
        {
            console.error ('[memberJoin] error on user: user not found :( // fetch failed');
        }
        if (onEnterBanRealy)
        {
            let plusTimeout = membersBanTimeout - Date.now();
            if (plusTimeout > 0)
            {
                guild.members.ban
                (
                    uid,
                    {
                        days: 0,
                        reason: 'Забанен ботом на ~' + Math.round (plusTimeout / 1000 / 60) + ' мин.',
                    }
                )
                .then
                (
                    async () =>
                    {
                        let username = raw && raw.user ? raw.user.username : uid;
                        console.log ('[' + (d()) + '] member ' + username + ' banned on ~' + Math.round (plusTimeout / 1000 / 60) + ' min.');
                        setTimeout
                        (
                            async () =>
                            {
                                await db (server, 'membersBanTimeout', uid, null);
                                guild.members.unban (uid)
                                .then
                                (
                                    user => console.log ('[' + (d()) + '] member ' + (user ? user.username : uid) + ' unbanned after ~' + Math.round (plusTimeout / 1000 / 60) + ' min.')
                                )
                                .catch (e => console.error ('[memberJoin] unban: ' + e.message + ' -- unbanned already ?'));
                            },
                            plusTimeout
                        );
                    }
                )
                .catch (e => console.error ('[memberJoin] ban error: ' + e.message));
            }
        }
    }
}

// Обработка ВЫХОДА (бывший guildMemberRemove): бан-за-выход.
// Причины банов -- как было: 'Забанен ботом на N мин.'
async function handleMemberLeave (server, uid, raw)
{
    const guild = client.guilds.cache.get (server);
    let log_channel = SERVERS[server].log_channel || '';
    let onLeaveBanTimeout = SERVERS[server].onLeaveBanTimeout || 0;
    let onLeaveBanRealy = SERVERS[server].onLeaveBanRealy || false;
    if (await db (server, 'membersBanTimeout', uid))
    {
        // Уже в таймауте (перезаход) -- банить повторно не надо.
        return;
    }
    if (!onLeaveBanTimeout) return; // функция выключена
    let username = raw && raw.user ? (raw.user.username + (raw.nick ? ' (' + raw.nick + ')' : '')) : uid;
    if (onLeaveBanRealy)
    {
        guild.members.ban
        (
            uid,
            {
                days: 0,
                reason: 'Забанен ботом на ' + onLeaveBanTimeout + ' мин.',
            }
        )
        .then
        (
            async () =>
            {
                await db (server, 'membersBanTimeout', uid, Date.now() + onLeaveBanTimeout * 60 * 1000);
                console.log ('[' + (d()) + '] member ' + username + ' banned on ' + onLeaveBanTimeout + ' min.');
                setTimeout
                (
                    async () =>
                    {
                        await db (server, 'membersBanTimeout', uid, null);
                        guild.members.unban (uid)
                        .then
                        (
                            user => console.log ('[' + (d()) + '] member ' + (user ? user.username : uid) + ' unbanned after ' + onLeaveBanTimeout + ' min.')
                        )
                        .catch (e => console.error ('[memberLeave] unban: ' + e.message + ' -- unbanned already ?'));
                    },
                    onLeaveBanTimeout * 60 * 1000
                );
            }
        )
        .catch (e => console.error ('[memberLeave] ban error: ' + e.message));
    }
    else
    {
        await db (server, 'membersBanTimeout', uid, Date.now() + onLeaveBanTimeout * 60 * 1000);
        console.log ('[' + (d()) + '] member ' + username + ' banned on ' + onLeaveBanTimeout + ' min.');
        setTimeout
        (
            async () =>
            {
                await db (server, 'membersBanTimeout', uid, null);
                console.log ('[' + (d()) + '] member ' + username + ' unbanned after ' + onLeaveBanTimeout + ' min.');
            },
            onLeaveBanTimeout * 60 * 1000
        );
    }
}

// [v2.2.3] РЕСТАРТ-БЕЗОПАСНАЯ сверка тегов 🔑: события, случившиеся пока бот был выключен
// (выдача прав, вход в канал), событиями уже не догнать -- поллер сам сверяет всех,
// кто сейчас в голосовых каналах: есть оверрайд с правами -> тег, нет -> снять:
async function sweepNicks (server)
{
    try
    {
        const guild = client.guilds.cache.get (server);
        if (!guild || !(SERVERS[server].addTag || false)) return;
        const tag = '🔑';
        // [FIX v2.3.2] REST-эндпоинт voice-states ботам недоступен (404) -- берём
        // кэш гейтвея: guild.voiceStates заполнен из GUILD_CREATE/voice-событий:
        let states = guild.voiceStates.cache;
        let checked = 0, added = 0, removed = 0;
        for (let vs of states.values ())
        {
            if (vs.id === client.user.id) continue;
            const channel = vs.channel || client.channels.cache.get (vs.channelId);
            if (!channel) continue;
            const ow = channel.permissionOverwrites.cache.get (vs.id);
            const hasRights = !!ow &&
            (
                ow.allow.has (PermissionsBitField.Flags.ManageChannels) ||
                ow.allow.has (PermissionsBitField.Flags.ManageRoles) ||
                ow.allow.has (PermissionsBitField.Flags.MoveMembers) ||
                ow.allow.has (PermissionsBitField.Flags.DeafenMembers) ||
                ow.allow.has (PermissionsBitField.Flags.MuteMembers)
            );
            // [FIX v2.3.2] VoiceState несёт member из гейтвея (vs.member) даже без
            // GuildMembers-интента; fetch по id нужен только как страховка.
            // (vs.user_id -- сырого API-поля в v14 нет, fetch(undefined) вечно падал):
            // [FIX v2.3.6] ник берём СВЕЖИМ: без GuildMembers-интента бот не получает
            // события GUILD_MEMBER_UPDATE (смена ника), кэш знает ник старым --
            // самодрисованный ключ для свипа невидим (срабатывал только войс-статус).
            // REST fetch всегда возвращает актуальные данные:
            let member = await guild.members.fetch (vs.id).catch (() => null)
                             || vs.member;
            if (!member || member.user.bot) continue;
            checked++;
            let nick = member.nickname || member.user.username;
            // [FIX v2.3.3] charCodeAt (0xD83D) ловит ЛЮБОЙ эмодзи в начале ника
            // (💙, 🔊...) и свип срезал их, думая что это ключ. Точная проверка:
            let hasTag = nick.startsWith ('🔑'); // 🔑
            // [v2.3.5] ADM/MOD: ключ = права для обычных, у staff его быть не должно --
            // даже самодрисованный удаляем (и это единственное, что бот делает с их никами):
            if (isStaff (server, member))
            {
                if (hasTag)
                    await member.setNickname (nick.slice (tag.length))
                        .then (() => { removed++; console.log ('[' + (d()) + '] [nick] -🔑 (staff) ' + member.user.username); })
                        .catch (e => console.error ('[nick][sweep] error for ' + member.user.username + ': ' + e.message));
                continue;
            }
            if (hasRights && !hasTag)
                await member.setNickname (tag + nick)
                    .then (() => { added++; console.log ('[' + (d()) + '] [nick] +🔑 (sweep) ' + member.user.username + ' in ' + channel.name); })
                    .catch (e => console.error ('[nick][sweep] error for ' + member.user.username + ': ' + e.message));
            else if (!hasRights && hasTag)
                await member.setNickname (nick.slice (tag.length))
                    .then (() => { removed++; console.log ('[' + (d()) + '] [nick] -🔑 (sweep) ' + member.user.username); })
                    .catch (e => console.error ('[nick][sweep] error for ' + member.user.username + ': ' + e.message));
        }
        // [v2.4] итог свипа -- только в DEBUG (периодический шум в логе ни к чему):
        if (DEBUG && checked > 0 && (added > 0 || removed > 0))
            console.log ('[' + (d()) + '] [nick][sweep] проверено ' + checked + ' в голосе: +' + added + '/-' + removed + ' ключей');
    }
    catch (e)
    {
        console.error ('[nick][sweep] error: ' + e.message);
    }
}

// [v2.3] Личные каналы: заход в «➕ Создать канал» -> канал «@Ник» с правами владельца + 🔑.
// Ничего не храним: пустой канал -- удаляется. После рестарта осиротевшие чистятся свипом.
async function tempCreateFor (server, member)
{
    const guild = client.guilds.cache.get (server);
    const catId = SERVERS[server].temp_category || '';
    const lobbyId = SERVERS[server].temp_lobby || '';
    if (!guild || !catId) return;
    // у человека уже есть личный канал? -- возвращаем туда:
    let exists = guild.channels.cache.find
    (
        c => c.parentId === catId &&
             c.type === ChannelType.GuildVoice &&
             c.permissionOverwrites.cache.has (member.id)
    );
    if (exists)
    {
        if (member.voice.channelId && member.voice.channelId !== exists.id)
            await member.voice.setChannel (exists.id).catch (() => {});
        return;
    }
    let name = '@' + (member.nickname || member.user.username);
    let created = await guild.channels.create
    (
        {
            name: name,
            type: ChannelType.GuildVoice,
            parent: catId,
            permissionOverwrites:
            [
                {
                    id: member.id,
                    allow:
                    [
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.MoveMembers,
                        PermissionsBitField.Flags.MuteMembers,
                        PermissionsBitField.Flags.DeafenMembers,
                        PermissionsBitField.Flags.Stream,
                    ],
                },
            ],
        }
    )
    .catch (e => { console.error ('[temp] error on create: ' + e.message); return null; });
    if (!created) return;
    console.log ('[' + (d()) + '] [temp] created ' + created.name + ' for ' + member.user.username);
    if (member.voice.channelId === lobbyId)
        await member.voice.setChannel (created.id)
            .catch (e => console.error ('[temp] error on setChannel: ' + e.message));
    // ключ владельцу (он в своём канале -- права есть; ADM/MOD -- не трогаем):
    if ((SERVERS[server].addTag || false) && !isStaff (server, member))
    {
        let nick = member.nickname || member.user.username;
        // [FIX v2.3.3] точная проверка ключа (см. комментарий в sweepNicks):
        if (!nick.startsWith ('🔑'))
            await member.setNickname ('🔑' + nick)
                .then (() => console.log ('[' + (d()) + '] [nick] +🔑 (temp) ' + member.user.username))
                .catch (e => console.error ('[temp] error on setNickname: ' + e.message));
    }
    await tempSweep (server); // заодно убрать осиротевшие
}

// Удаление ПУСТЫХ личных каналов в категории:
// [FIX v2.3.1] пустоту определяем ТОЛЬКО по кэшу голосовых состояний (voiceStates):
// channel.members требует кэша участников, которого без GuildMembers-интента НЕТ.
async function tempSweep (server)
{
    const guild = client.guilds.cache.get (server);
    const catId = SERVERS[server].temp_category || '';
    const lobbyId = SERVERS[server].temp_lobby || '';
    if (!guild || !catId) return;
    for (let [, ch] of guild.channels.cache)
    {
        if (ch.parentId !== catId || ch.type !== ChannelType.GuildVoice || ch.id === lobbyId) continue;
        let busy = false;
        for (let [, vs] of guild.voiceStates.cache)
            if (vs.channelId === ch.id) { busy = true; break; }
        if (busy) continue; // в канале кто-то есть -- живём
        await ch.delete ('PANDAMIA: pustoy lichny kanal')
            .then (() => console.log ('[' + (d()) + '] [temp] deleted empty ' + ch.name))
            .catch (e => console.error ('[temp] error on delete: ' + e.message));
    }
}

// [v2.3.1] кто-то в лобби (в т.ч. с момента до старта бота) -- создать личный канал:
async function tempLobbyCheck (server)
{
    const guild = client.guilds.cache.get (server);
    const lobbyId = SERVERS[server].temp_lobby || '';
    if (!guild || !lobbyId) return;
    for (let [, vs] of guild.voiceStates.cache)
    {
        if (vs.channelId !== lobbyId) continue;
        let member = vs.member || await guild.members.fetch (vs.id).catch (() => null);
        if (member && !member.user.bot)
            await tempCreateFor (server, member).catch (e => console.error ('[temp] lobby error: ' + e.message));
    }
}

// [v2.5] Проверка id из config.json при старте: битый id вылезет сразу,
// а не загадочной ошибкой переноса/лога через час. Молчим, если всё цело.
async function checkConfigChannels (server)
{
    const guild = client.guilds.cache.get (server);
    if (!guild) return;
    for (let key of ['log_channel', 'pipe_channel_source', 'pipe_channel_target', 'channel_common', 'temp_lobby'])
    {
        let id = SERVERS[server][key];
        if (!id) continue;
        let ch = guild.channels.cache.get (id) || await guild.channels.fetch (id).catch (() => null);
        if (!ch)
        {
            console.error ('[config] ' + key + ' = ' + id + ': канала нет -- исправь config.json и ПЕРЕЗАПУСТИ бота');
            continue;
        }
        if ((key === 'channel_common' || key === 'temp_lobby') && !ch.isVoiceBased ())
            console.error ('[config] ' + key + ' = ' + id + ' ("' + ch.name + '"): не голосовой канал');
    }
}

// Один тик поллера по серверу:
async function pollMembers (server)
{
    try
    {
        const guild = client.guilds.cache.get (server);
        if (!guild) return;
        let current = await fetchAllMembersRest (server);
        let previous = $membersSnapshot[server];
        if (previous)
        {
            // [v2.5] Каждый участник -- в своём предохранителе, а снапшот
            // обновляется ВСЕГДА (finally). Раньше одно падение (например,
            // logMemberJoinLeave на сыром JSON) оставляло старый снапшот, и
            // следующие тики снова считали человека 'вошедшим' -- повторные
            // строки JOINED и повторные выдачи бан-таймаутов.
            try
            {
                // входы:
                for (let [uid, raw] of current)
                {
                    if (previous.has (uid)) continue;
                    try
                    {
                        let memberUser = await resolveUser (uid, raw);
                        console.log ('[' + (d()) + '] member ' + memberUser.username + ' JOINED ' + SERVERS[server].name);
                        await logMemberJoinLeave (server, memberUser, true);
                        await handleMemberJoin (server, uid, raw);
                    }
                    catch (e) { console.error ('[pollMembers] join ' + uid + ': ' + e.message); }
                }
                // выходы:
                for (let [uid, raw] of previous)
                {
                    if (current.has (uid)) continue;
                    try
                    {
                        let memberUser = await resolveUser (uid, raw);
                        console.log ('[' + (d()) + '] member ' + memberUser.username + ' LEFT ' + SERVERS[server].name);
                        await logMemberJoinLeave (server, memberUser, false);
                        await handleMemberLeave (server, uid, raw);
                    }
                    catch (e) { console.error ('[pollMembers] leave ' + uid + ': ' + e.message); }
                }
            }
            finally
            {
                $membersSnapshot[server] = current;
            }
        }
        else
        {
            $membersSnapshot[server] = current;
        }
    }
    catch (e)
    {
        console.error ('[pollMembers] error: ' + e.message);
    }
}

// Старт поллинга после готовности клиента:
client.on
(
    'clientReady', // [v2.4] 'ready' в v15 уйдёт -- без warnings в логе (только события)
    async () =>
    {
        for (let server in SERVERS)
        {
            if (!SERVERS[server].allow) continue;
            // Первый снапшот -- просто запоминаем (без логов и банов),
            // чтобы рестарт бота не разбудил ложные "выходы":
            $membersSnapshot[server] = await fetchAllMembersRest (server).catch (() => null);
            console.log ('[' + (d()) + '] [poll] snapshot ready: ' + ($membersSnapshot[server] ? $membersSnapshot[server].size : 'ERR') + ' members @ ' + SERVERS[server].name);
            // [v2.5] заодно проверить id из config.json (молчит, если всё цело):
            await checkConfigChannels (server);
            // Рестарт-безопасность: снять истёкшие бан-таймауты из SQLite:
            await sweepExpiredBans (server);
            // [v2.3] почистить пустые личные каналы после рестарта:
            await tempSweep (server);
        }            setInterval
            (
                async () =>
                {
                    for (let server in SERVERS)
                    {
                        if (!SERVERS[server].allow) continue;
                        // [FIX v2.3.1] КАЖДЫЙ шаг в своём предохранителе -- падение одного
                        // шага (сеть, кэш) больше не отменяет остальные (ключи, кабинеты):
                        let steps =
                        [
                            () => pollMembers (server),
                            () => sweepExpiredBans (server),
                            () => sweepNicks (server),        // ключи 🔑
                            () => tempSweep (server),         // пустые кабинеты
                            () => tempLobbyCheck (server),    // лобби -> кабинет
                        ];
                        for (let step of steps)
                        {
                            try { await step (); }
                            catch (e) { console.error ('[' + (d()) + '] [tick] ' + (step.name || 'step') + ': ' + e.message); }
                        }
                    }
                },
                POLL_PERIOD
            );
    }
);

// ============================================================================
// [v2.2] МУЗЫКА! ## DJ -- как у Cloudy ;-D
// Слэш-команды (работают БЕЗ Message Content интента):
//   /play <ссылка или поиск>   -- YouTube (ГЛАВНЫЙ), плейлисты, SoundCloud и
//                                 всё, что умеет yt-dlp
//   /stop  /skip  /pause  /resume  /queue  /nowplaying
// Право управления: роль DJ (config: role_dj) или админ/модер.
// Голос: @discordjs/voice; аудио: yt-dlp (o:-) -> ffmpeg -> Discord.
// ============================================================================

const
{
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    entersState,
    VoiceConnectionStatus,
    AudioPlayerStatus,
    StreamType,
} = require ('@discordjs/voice');
const ytdlp = require ('youtube-dl-exec');
const ffmpegPath = require ('ffmpeg-static');
const
{
    SlashCommandBuilder,
    REST,
    Routes,
    MessageFlags,
} = require ('discord.js');

// Прокси для yt-dlp (YouTube напрямую из РФ недоступен).
// [v2.2.2] Стратегия: сначала через прокси; если не отвечает 3 секунды -- DIRECT:
const MUSIC_PROXY = (typeof MUSIC !== 'undefined' && MUSIC && MUSIC.proxy) || (process.env.MUSIC_PROXY || 'socks5://127.0.0.1:10808');
const MUSIC_PROXY_TIMEOUT = 3000; // мс -- «не получилось за 3 сек» -> DIRECT
let proxyStreamDead = false;      // прокси отвечает по TCP, но стрим умер -> временно DIRECT
// Роль DJ -- задаётся в config.json сервера как role_dj.

// [v2.2.2] Быстрая TCP-проверка прокси (коннект за timeoutMs, иначе -- мёртв):
function pingProxy (timeoutMs = MUSIC_PROXY_TIMEOUT)
{
    return new Promise (resolve =>
    {
        let host, port;
        try
        {
            let u = new URL (MUSIC_PROXY);
            host = u.hostname;
            port = Number (u.port) || 1080;
        }
        catch { return resolve (false); }
        let s = new (require ('net').Socket) ();
        let done = false;
        let fin = ok => { if (done) return; done = true; try { s.destroy (); } catch {} resolve (ok); };
        s.setTimeout (timeoutMs, () => fin (false));
        s.once ('connect', () => fin (true));
        s.once ('error',    () => fin (false));
        s.connect (port, host);
    });
}

// [v2.2.2] Сетевая ли это ошибка (прокси/сеть), а не реальный ответ YouTube:
function isNetworkError (e)
{
    let s = String ((e && e.stderr) || (e && e.message) || e);
    return /SocksHTTPS|proxy|timed out|timeout|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|refused|reset|URLError|getaddrinfo|network/i.test (s);
}

// [v2.2.2] yt-dlp для метаданных: сначала прокси (проверка 3 сек), не вышло -- DIRECT:
async function ytDlpRun (query, optsBase)
{
    let viaProxy = !proxyStreamDead && await pingProxy ();
    let routes = viaProxy ? ['proxy', 'DIRECT'] : ['DIRECT'];
    let lastErr;
    for (let route of routes)
    {
        try
        {
            let opts = Object.assign ({}, optsBase, route === 'proxy'
                ? { proxy: MUSIC_PROXY, socketTimeout: 10 } // не висим вечно в мёртвом прокси
                : {});
            let r = await ytdlp (query, opts);
            if (route === 'proxy') proxyStreamDead = false; // прокси ожил
            return r;
        }
        catch (e)
        {
            lastErr = e;
            console.error ('[music] ' + route + ' failed: ' + String ((e && e.stderr) || (e && e.message) || e).slice (0, 150));
            if (!isNetworkError (e)) throw e; // реальная ошибка YouTube -- повторять бессмысленно
        }
    }
    throw lastErr;
}

// Очереди по гильдиям: guild_id -> {connection, player, tracks:[], current, volume, textChannelId}
const MUSIC_VOLUME = 0.5; // громкость (команды смены громкости нет -- это константа)
const $music = {}; // guild_id -> состояние (см. musicOf)

function musicOf (guildId)
{
    if (!$music[guildId])
        $music[guildId] =
        {
            connection: null,
            player: createAudioPlayer (),
            tracks: [],
            current: null,
            volume: MUSIC_VOLUME,
            textChannelId: null,
        };
    return $music[guildId];
}

function isDJ (interaction)
{
    const server = interaction.guildId;
    if (!(server in SERVERS)) return false;
    let role_dj = SERVERS[server].role_dj || '';
    let member = interaction.member;
    if (!member) return false;
    // Админ/модер -- всегда DJ:
    if (member._roles.includes (SERVERS[server].role_admin)) return true;
    if (SERVERS[server].role_moder && member._roles.includes (SERVERS[server].role_moder)) return true;
    // Явная DJ-роль (если задана):
    if (role_dj && member._roles.includes (role_dj)) return true;
    // Если DJ-роль не задана в конфиге -- разрешаем всем (для небольших серверов):
    return !role_dj;
}

// Метаданные трека (название, длительность, источник):
async function trackInfo (query)
{
    // [v2.2.2] прокси -> DIRECT (если прокси не отвечает за 3 секунды):
    const info = await ytDlpRun
    (
        query,
        {
            dumpSingleJson: true,
            noWarnings: true,
            noPlaylist: true, // один трек; плейлист разворачиваем отдельно
        }
    );
    return {
        url: info.webpage_url || query,
        streamUrl: query,
        title: info.title || 'Без названия',
        duration: info.duration || 0,
        author: info.uploader || info.channel || info.extractor_key || '',
        isLive: !!info.is_live,
        thumbnail: info.thumbnail || '',
    };
}

// Разворот плейлиста (до 50 треков):
async function playlistInfo (query)
{
    // [v2.2.2] прокси -> DIRECT:
    const info = await ytDlpRun (query, { dumpSingleJson: true, noWarnings: true, flatPlaylist: true });
    if (!info._type || info._type !== 'playlist')
        return [await trackInfo (query)];
    let entries = (info.entries || []).slice (0, 50);
    return entries.map
    (
        e =>
        ({
            url: e.url || e.webpage_url || e.id,
            streamUrl: e.url || e.webpage_url,
            title: e.title || 'Без названия',
            duration: e.duration || 0,
            author: e.uploader || '',
            isLive: false,
            thumbnail: e.thumbnail || '',
        })
    );
}

// Аудио-ресурс: yt-dlp стримит в stdout -> ffmpeg ресемплирует в Opus для Discord:
// [v2.2.2] стрим по той же стратегии, что и метаданные: прокси -> DIRECT:
async function createTrackStream (track)
{
    let viaProxy = !proxyStreamDead && await pingProxy ();
    const ytdlpStream = ytdlp.exec
    (
        track.url,
        {
            o: '-',                        // стрим в stdout [!!!!]
            quiet: true,
            noWarnings: true,
            noPlaylist: true,
            // [v2.2.2] через прокси, если жив; иначе DIRECT:
            ...(viaProxy ? { proxy: MUSIC_PROXY, socketTimeout: 10 } : {}),
            f: 'bestaudio[acodec!=none][ext=m4a]/bestaudio[acodec!=none]/bestaudio/best',
            // буфер под riff-сети:
            bufferSize: '4M',
            retries: 3,
        }
    );
    // [FIX v2.2.1] yt-dlp может упасть (видео недоступно, сеть, прокси) -- его промис раньше
    // никто не ловил, и НЕПОЙМАННЫЙ reject убивал весь процесс бота. Гасим здесь:
    if (ytdlpStream && typeof ytdlpStream.catch === 'function')
        ytdlpStream.catch (e => console.error ('[music] yt-dlp exited: ' + String ((e && e.message) || e).slice (0, 200)));
    // yt-dlp выдаёт m4a/webm -- ffmpeg конвертирует в 48kHz stereo PCM,
    // а @discordjs/voice сама упакует в Opus (ffmpegProcess -> StreamType.Raw):
    const resource = createAudioResource
    (
        ytdlpStream.stdout,
        {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
        }
    );
    if (resource.volume)
        resource.volume.setVolume (MUSIC_VOLUME); // [FIX v2.9.1] было musicOf('') -- создавало мусорную запись $music['']
    // [v2.9] source/proc отдаём наружу: у предзагрузки нужно уметь всё это глушить
    // (иначе непригодившийся трек оставил бы висеть yt-dlp, ждущий читателя в пайпе).
    return { resource, viaProxy, source: ytdlpStream.stdout, proc: ytdlpStream };
}

// Воспроизведение следующего трека:
async function playNext (guildId)
{
    const m = musicOf (guildId);
    if (m.leaving) return; // [v2.9] бот уже уходит -- новый трек не запускаем
    if (!m.tracks.length)
    {
        m.current = null;
        scheduleVoiceStatus (guildId); // [v2.7] «очередь: —» в статусе канала
        schedulePresence ();           // [v2.8] трек кончился -- «смотрит канал»
        return;
    }
    let track = m.tracks.shift ();
    m.current = track;
    console.log ('[' + (d()) + '] [music] играю: ' + (track.title || track.url || 'трек')); // [v2.4] активное событие в лог
    scheduleVoiceStatus (guildId, true); // [v2.7] сразу показать новый трек и очередь
    schedulePresence (true);             // [v2.8] «слушает» этот трек
    try
    {
        let resource = null, viaProxy = false;
        const p = m.preload;
        if (p && p.track === track)
        {
            // [v2.9] этот трек уже готовился пока играл предыдущий -- берём готовое
            m.preload = null; // вынули: теперь это обычный играющий ресурс, не предзагрузка
            const r = await p.promise; // в бою уже готова (песня играла минуты)
            if (r) { resource = r.resource; viaProxy = r.viaProxy; }
        }
        else
        {
            // готовили не этот трек (или вообще ничего) -- выкидываем, иначе утечёт ffmpeg
            dropPreload (m);
        }
        if (resource)
            console.log ('[' + (d()) + '] [music] предзагрузка сыграла: ' + (track.title || 'трек') + ' (без паузы)');
        else
            ({ resource, viaProxy } = await createTrackStream (track));
        wireStreamErrors (m, track, resource, viaProxy, guildId);
        m.player.play (resource);
        startPreload (guildId); // [v2.9] пока играет -- готовим следующий трек
    }
    catch (e)
    {
        console.error ('[music] play error: ' + e.message);
        m.current = null;
        playNext (guildId); // пропустить битый трек
    }
}

// ============================================================================
// [v2.9] ПРЕДЗАГРУЗКА следующего трека: пока играет текущий, поток следующего уже
// готовится (yt-dlp качает в пайп и упирается в backpressure -- память не растёт).
// Раньше yt-dlp запускался только после Idle, поэтому между песнями была слышна
// пауза на поиск/буферизацию; теперь следующая песня стартует мгновенно.
// ============================================================================

// Выбросить предзагрузку: чужие ffmpeg/yt-dlp должны умереть, а не висеть в памяти.
function dropPreload (m)
{
    const p = m && m.preload;
    if (!p) return;
    m.preload = null;
    p.cancelled = true;
    killStream ({ resource: p.resource, source: p.source, proc: p.proc });
}

// Глушим поток трека целиком: сам ресурс, поток yt-dlp и его процесс.
function killStream (r)
{
    if (!r) return;
    try { if (r.resource) r.resource.playStream.destroy (); } catch {}
    try { if (r.source) r.source.destroy (); } catch {}
    try { if (r.proc && typeof r.proc.kill === 'function') r.proc.kill (); } catch {}
}

// Начать готовить первый трек очереди (повторные вызовы безопасны).
function startPreload (guildId)
{
    const m = musicOf (guildId);
    const next = m.tracks[0];
    if (!next) { dropPreload (m); return; }
    if (m.preload && m.preload.track === next) return; // этот уже готовим
    dropPreload (m);                                   // готовили не то -- выкидываем
    const p = { track: next, resource: null, viaProxy: false, cancelled: false };
    m.preload = p;
    p.promise = createTrackStream (next).then
    (
        r =>
        {
            if (p.cancelled)
            {
                killStream (r); // предзагрузку уже выбросили -- глушим всё, что успело открыться
                return null;
            }
            p.resource = r.resource;
            p.viaProxy = r.viaProxy;
            p.source = r.source;
            p.proc = r.proc;
            // Обработчик ошибок вешаем сразу (а не когда трек начнёт играть): иначе
            // 'error' у потока без слушателя уронил бы процесс.
            wireStreamErrors (m, next, r.resource, r.viaProxy, guildId);
            console.log ('[' + (d()) + '] [music] предзагрузка готова: ' + (next.title || 'трек'));
            return r;
        },
        e =>
        {
            // не получилось -- не беда: playNext просто возьмёт свежий поток
            p.cancelled = true;
            console.error ('[music] предзагрузка не удалась (' + (next.title || 'трек') + '): ' + e.message);
            return null;
        }
    );
}

// [FIX v2.2.1] ошибка в потоке (битое/удалённое видео) раньше валила весь бот.
// [v2.9] теперь поток может быть (а) играющим -- пропускаем трек и едем дальше,
// или (б) только предзагруженным -- просто выбрасываем испорченную заготовку.
function wireStreamErrors (m, track, resource, viaProxy, guildId)
{
    // [FIX v2.9.1] Заготовка подписывается на ошибки СРАЗУ (иначе 'error' у потока без
    // слушателя уронил бы процесс), а когда трек начинает играть, playNext зовёт эту
    // функцию ВТОРОЙ раз. Без проверки на один поток вешались ДВА обработчика: одна
    // ошибка давала две строки в логе, причём вторая называла играющий трек
    // «предзагрузкой» (проверено стендом: listeners=2).
    if (resource.__errWired) return;
    resource.__errWired = true;
    resource.playStream.once ('error', e =>
    {
        const playing = m.current === track;
        console.error ('[music] stream error (' + (playing ? 'skip track' : 'предзагрузка') + '): ' + e.message);
        // [v2.2.2] сеть упала при стриме через прокси -- следующие треки временно DIRECT:
        if (viaProxy && isNetworkError (e))
            proxyStreamDead = true;
        if (playing)
        {
            m.current = null;
            let ch = m.textChannelId && client.channels.cache.get (m.textChannelId);
            if (ch)
                ch.send ('⚠️ **' + (track.title || 'Трек') + '** -- не удалось воспроизвести, пропускаю.').catch (() => {});
            m.player.stop (true); // Idle -> playNext
        }
        else if (m.preload && m.preload.track === track)
        {
            m.preload = null; // сломанную заготовку даже не пробуем ставить
        }
    });
}

// ============================================================================
// [v2.7] СТАТУС В ГОЛОСОВОМ КАНАЛЕ: что играет / очередь / сколько людей / сколько
// бот тут. Discord рисует эту строку в самом канале (PUT /channels/{id}/voice-status).
// У роута жёсткий лимит, поэтому вызовы склеиваются дебаунсом, а в лог идёт ТОЛЬКО
// ошибка -- иначе статус забил бы журнал событий (там должны быть люди, не интерфейс).
// ============================================================================
const VOICE_STATUS_MIN_GAP = 3000; // мс: не чаще одного раза в 3 сек на сервер (лимит роута)
const musicRest = new REST ({ version: '10' }).setToken (TOKEN);
const $voiceStatus = {}; // guildId -> { timer, last, text, channelId }

// «40 сек» / «12 мин» / «1 ч 5 мин» -- коротко, для строки статуса:
function fmtAgo (ms)
{
    let s = Math.max (0, Math.round (ms / 1000));
    let h = s / 3600 | 0, mi = (s % 3600) / 60 | 0;
    if (h) return h + ' ч ' + mi + ' мин';
    if (mi) return mi + ' мин';
    return s + ' сек';
}

// Сколько ЛЮДЕЙ в голосовом канале (боты и сам бот не считаются). Считаем по кэшу
// голосовых состояний: channel.members без интента GuildMembers пуст (в коде уже
// есть такое место -- tempSweep).
function humansInChannel (guildId, channelId)
{
    const guild = client.guilds.cache.get (guildId);
    if (!guild || !channelId) return 0;
    const selfId = client.user ? client.user.id : null; // до ready client.user может быть null
    let n = 0;
    for (const vs of guild.voiceStates.cache.values ())
        if (vs.channelId === channelId && vs.id !== selfId && !(vs.member && vs.member.user.bot))
            n++;
    return n;
}

// Обрезка длинного текста (названия трека) под лимит поля: с многоточием.
function clipText (s, max)
{
    s = String (s);
    max = Math.max (4, max | 0);
    return s.length <= max ? s : s.slice (0, max - 1) + '…';
}

// Текст статуса для текущего состояния. null -- бот не в голосовом канале.
function voiceStatusText (guildId)
{
    const m = $music[guildId];
    if (!m || !m.connection) return null;
    const chId = m.connection.joinConfig.channelId;
    const people = humansInChannel (guildId, chId);
    let parts = [];
    if (m.current)
        parts.push ((m.player.state.status === AudioPlayerStatus.Paused ? '⏸ ' : '🎶 ') +
            (m.current.title || 'трек') + ' — ' + fmtDur (m.current.duration));
    else
        parts.push ('😴 музыка не играет');
    parts.push ('📜 очередь: ' + (m.tracks.length ? m.tracks.length : '—'));
    parts.push ('🎧 в канале: ' + people);
    if (m.since) parts.push ('⏱ бот тут: ' + fmtAgo (Date.now () - m.since));
    return parts.join (' • ').slice (0, 500); // 500 -- лимит поля статуса
}

// Снять статус с канала (при выходе/переезде) -- иначе в нём останется старая строка:
function clearVoiceStatus (channelId)
{
    if (!channelId) return;
    // status: null -- это именно «снять статус» (по документации Discord):
    musicRest.put (Routes.channelVoiceStatus (channelId), { body: { status: null } })
        .catch (e => console.error ('[' + (d()) + '] [music] статус канала не снялся: ' + e.message));
}

// Записать текущий статус в канал, где сидит бот:
async function writeVoiceStatus (guildId)
{
    const st = $voiceStatus[guildId] = $voiceStatus[guildId] || {};
    const text = voiceStatusText (guildId);
    if (text === null)
    {
        // бота уже нет в канале -- статус снимаем и чистим память о нём
        const old = st.channelId;
        st.text = null;
        st.channelId = null;
        clearVoiceStatus (old);
        return;
    }
    const channelId = $music[guildId].connection.joinConfig.channelId;
    if (st.text === text && st.channelId === channelId) return; // не дёргаем API зря
    const prev = { text: st.text, channelId: st.channelId };
    st.text = text;
    st.channelId = channelId;
    st.last = Date.now ();
    try
    {
        await musicRest.put (Routes.channelVoiceStatus (channelId), { body: { status: text } });
    }
    catch (e)
    {
        console.error ('[' + (d()) + '] [music] статус канала не записался: ' + e.message);
        st.text = prev.text; // вернём, чтобы попробовать снова
        st.channelId = prev.channelId;
    }
}

// Дебаунс: события сыпятся пачками (вошёл человек, сменился трек) -- пишем один раз,
// причём пишется ВСЕГДА актуальный текст (он берётся в момент записи, а не в момент вызова).
// immediate=true -- «событие важное» (сменился трек, пауза, стоп): пишем сразу, если
// прошлый запрос был достаточно давно по меркам лимита.
function scheduleVoiceStatus (guildId, immediate = false)
{
    if (!guildId || !(guildId in SERVERS)) return;
    if (!$music[guildId] || !$music[guildId].connection) return; // не сидим -- нечего показывать
    const st = $voiceStatus[guildId] = $voiceStatus[guildId] || {};
    if (st.timer) return;
    const wait = immediate ? Math.max (VOICE_STATUS_MIN_GAP - (Date.now () - (st.last || 0)), 0) : VOICE_STATUS_MIN_GAP;
    st.timer = setTimeout
    (
        () =>
        {
            st.timer = null;
            writeVoiceStatus (guildId).catch (e => console.error ('[' + (d()) + '] [music] статус: ' + e.message));
        },
        wait
    );
}

// Раз в минуту обновляем счётчик «бот тут N мин» (в лог не пишется -- там только события):
const voiceStatusTick = setInterval
(
    () =>
    {
        for (let g in $music)
            if ($music[g].connection) scheduleVoiceStatus (g);
    },
    60 * 1000
);
if (voiceStatusTick.unref) voiceStatusTick.unref ();

// ============================================================================
// [v2.8] ПРОФИЛЬНЫЙ СТАТУС: «что бот делает» — видно везде, даже вне голосового.
//   слушает трек / смотрит канал, где сидит / свободен (ждёт команду).
// Discord лимитирует обновления presence, поэтому здесь та же схема, что у статуса
// канала: дебаунс + текст берётся В МОМЕНТ записи (на экране всегда актуальное).
// ============================================================================
const PRESENCE_MIN_GAP = 5000; // мс между обновлениями (лимит Discord на presence)
let $presenceTimer = null;
let $presenceLast = 0;
let $presenceDone = null; // что уже выставлено на экран (чтобы не дёргать API зря)

function presenceNow ()
{
    // если серверов несколько -- показываем самое интересное: трек важнее ожидания:
    let playing = null, waiting = null;
    for (let g in $music)
    {
        const m = $music[g];
        if (!m.connection) continue;
        const chId = m.connection.joinConfig.channelId;
        const ch = client.channels.cache.get (chId);
        const where = ch ? '«' + ch.name + '»' : 'голосовом канале';
        // хвост: что ещё ждёт и сколько людей в комнате (обе части -- только если есть)
        const people = humansInChannel (g, chId);
        const tail = (m.tracks.length ? ' · в очереди ' + m.tracks.length : '') +
            (people ? ' · в канале ' + people : '');
        if (m.current)
        {
            const icon = m.player.state.status === AudioPlayerStatus.Paused ? '⏸ ' : '🎶 ';
            const suffix = ' — ' + where + tail;
            // 128 символов -- лимит поля активности: режем НАЗВАНИЕ, а не хвост с очередью
            playing = icon + clipText (m.current.title || 'трек', 128 - icon.length - suffix.length) + suffix;
        }
        else if (!waiting)
            waiting = '🎧 ' + where + tail;
    }
    if (playing) return { type: ActivityType.Listening, name: playing };
    if (waiting) return { type: ActivityType.Watching, name: waiting };
    return { type: ActivityType.Playing, name: '/help · /play · /join' }; // свободен
}

function writePresence ()
{
    if (!client.user) return; // до ready менять нечего
    const want = presenceNow ();
    want.name = String (want.name).slice (0, 128); // лимит поля активности
    if ($presenceDone && $presenceDone.type === want.type && $presenceDone.name === want.name) return;
    $presenceDone = want;
    $presenceLast = Date.now ();
    try
    {
        client.user.setActivity ({ name: want.name, type: want.type });
    }
    catch (e)
    {
        console.error ('[' + (d()) + '] [presence] статус не выставился: ' + e.message);
        $presenceDone = null; // попробуем при следующем событии
    }
}

function schedulePresence (immediate = false)
{
    if ($presenceTimer) return; // уже запланировано -- текст возьмётся свежий в момент записи
    const wait = immediate ? Math.max (PRESENCE_MIN_GAP - (Date.now () - $presenceLast), 0) : PRESENCE_MIN_GAP;
    $presenceTimer = setTimeout (() => { $presenceTimer = null; writePresence (); }, wait);
}

// Подключение к голосовому каналу пользователя:
function connectTo (interaction)
{
    const m = musicOf (interaction.guildId);
    let voiceChannel = interaction.member.voice.channel;
    if (!m.connection)
    {
        m.connection = joinVoiceChannel
        (
            {
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
            }
        );
        console.log ('[' + (d()) + '] [music] подключился к «' + voiceChannel.name + '»'); // [v2.4] активное событие в лог
        m.since = Date.now (); // [v2.7] от этого считаем «бот тут N мин» в статусе
        m.player.on (AudioPlayerStatus.Idle, () =>
        {
            if (m.leaving) return; // [v2.9] это Idle от нашего же выхода, а не конец трека
            // трек кончился -- следующий:
            m.current = null;
            playNext (interaction.guildId);
        });
        m.player.on ('error', e => console.error ('[music] player error: ' + e.message));
        m.connection.subscribe (m.player);
        m.connection.on (VoiceConnectionStatus.Disconnected, async () =>
        {
            try
            {
                await entersState (m.connection, VoiceConnectionStatus.Signalling, 5_000);
            }
            catch
            {
                // канал закрылся -- уходим:
                destroyMusic (interaction.guildId);
            }
        });
        scheduleVoiceStatus (interaction.guildId, true); // [v2.7] показать статус сразу
        schedulePresence (true);                         // [v2.8] «смотрит канал»
    }
    else
    {
        // пересоединение в другой канал («вызвали в другую комнату»):
        if (m.connection.joinConfig.channelId !== voiceChannel.id)
        {
            const oldChId = m.connection.joinConfig.channelId;
            m.connection.rejoin ({ channelId: voiceChannel.id });
            // [v2.7] активное событие в лог: переезд раньше нигде не писался
            console.log ('[' + (d()) + '] [music] перешёл в «' + voiceChannel.name + '»');
            // [v2.7] статус живёт в канале: из старого снимаем, в новом пишем заново
            clearVoiceStatus (oldChId);
            scheduleVoiceStatus (interaction.guildId, true);
            schedulePresence (true); // [v2.8] название канала в статусе тоже сменилось
        }
    }
}

function destroyMusic (guildId)
{
    const m = $music[guildId];
    if (!m) return;
    // [v2.9] player.stop() синхронно шлёт Idle, а его обработчик запускает следующий трек.
    // На выходе это означало лишний yt-dlp: ставим флаг и обнуляем очередь ДО stop().
    m.leaving = true;
    m.tracks = [];
    m.current = null;
    // [v2.7] активное событие в лог: «вышел» раньше нигде не писалось,
    // а по логу должно быть видно и заход, и выход:
    const chId = m.connection && m.connection.joinConfig ? m.connection.joinConfig.channelId : null;
    const ch = chId ? client.channels.cache.get (chId) : null;
    dropPreload (m); // [v2.9] убираем за собой: заготовка следующего трека тоже не нужна
    try { m.player.stop (true); } catch {}
    try { m.connection.destroy (); } catch {}
    delete $music[guildId];
    // [v2.7] снимаем статус: иначе в канале останется старая строка
    clearVoiceStatus (chId);
    if ($voiceStatus[guildId] && $voiceStatus[guildId].timer)
        clearTimeout ($voiceStatus[guildId].timer);
    delete $voiceStatus[guildId];
    schedulePresence (true); // [v2.8] вышел -- статус снова «свободен»
    if (chId)
        console.log ('[' + (d()) + '] [music] вышел из «' + (ch ? ch.name : chId) + '»');
}

// Форматирование длительности:
function fmtDur (sec)
{
    if (!sec || sec <= 0) return '🔴 LIVE';
    let h = sec / 3600 | 0, m = sec % 3600 / 60 | 0, s = sec % 60 | 0;
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s);
}

// Определение: ссылка или текстовый поиск:
function isUrl (s)
{
    return /^https?:\/\//i.test (s);
}

// Слэш-команды:
const musicCommands =
[
    // [v2.6] /help -- та же инструкция, что в стартовой ЛС, видна только вызвавшему
    // (доступна всем, без DJ и без голосового канала):
    new SlashCommandBuilder ()
        .setName ('help')
        .setDescription ('Инструкция: как пользоваться ботом'),
    new SlashCommandBuilder ()
        .setName ('play')
        .setDescription ('Включить музыку: ссылка (YouTube/плейлист) или поиск')
        .addStringOption (o =>
            o.setName ('запрос')
             .setDescription ('Ссылка или название трека')
             .setRequired (true)),
    // [v2.7] /join -- просто зайти в канал и сидеть (музыка не нужна):
    new SlashCommandBuilder ()
        .setName ('join')
        .setDescription ('Зайти в твой голосовой канал и остаться там (даже без музыки)'),
    new SlashCommandBuilder ()
        .setName ('stop')
        .setDescription ('Остановить музыку и очистить очередь'),
    new SlashCommandBuilder ()
        .setName ('skip')
        .setDescription ('Пропустить текущий трек'),
    new SlashCommandBuilder ()
        .setName ('pause')
        .setDescription ('Пауза'),
    new SlashCommandBuilder ()
        .setName ('resume')
        .setDescription ('Продолжить воспроизведение'),
    new SlashCommandBuilder ()
        .setName ('queue')
        .setDescription ('Показать очередь треков'),
    new SlashCommandBuilder ()
        .setName ('leave')
        .setDescription ('Выйти из голосового канала'),
].map (c => c.toJSON ());

// Регистрация команд на всех разрешённых серверах (guild-команды -- мгновенно):
async function registerMusicCommands ()
{
    const rest = new REST ({ version: '10' }).setToken (TOKEN);
    for (let server in SERVERS)
    {
        if (!SERVERS[server].allow) continue;
        try
        {
            await rest.put
            (
                Routes.applicationGuildCommands (ID, server),
                { body: musicCommands }
            );
            console.log ('[' + (d()) + '] [music] slash-commands registered @ ' + SERVERS[server].name);
        }
        catch (e)
        {
            console.error ('[music] register error @ ' + server + ': ' + e.message);
        }
    }
}

// Обработка слэш-команд:
client.on ('interactionCreate', async (interaction) =>
{
    if (!interaction.isChatInputCommand ()) return;
    const name = interaction.commandName;
    // [v2.4] активное действие -- в лог: кто и что вызвал
    console.log
    (
        '[' + (d()) + '] [cmd] /' + name +
        ((interaction.options.data || []).length
            ? ' ' + interaction.options.data.map (o => o.name + '=' + String (o.value === undefined ? '' : o.value).slice (0, 120)).join (' ')
            : '') +
        ' -- ' + (interaction.member ? uuu (interaction.member) : (interaction.user ? interaction.user.username : '?')) +
        (interaction.channel && interaction.channel.name ? ' @ #' + interaction.channel.name : '')
    );
    // [v2.6] /help -- всем и всегда: без DJ-роли и без голосового канала, ephemeral.
    if (name === 'help')
        return interaction.reply ({ embeds: [helpEmbed ()], flags: MessageFlags.Ephemeral });
    if (!['play','join','stop','skip','pause','resume','queue','leave'].includes (name)) return;
    const guildId = interaction.guildId;
    const m = musicOf (guildId);

    try
    {
        // DJ-проверка (смотреть /queue может каждый):
        if (name !== 'queue' && !isDJ (interaction))
        {
            let role_dj = SERVERS[guildId].role_dj || '';
            return interaction.reply ({ content: '🚫 Музыка только для ' + (role_dj ? '<@&' + role_dj + '>' : 'DJ'), flags: MessageFlags.Ephemeral });
        }

        // [v2.7] /join -- «посидеть с ботом»: заходит в канал вызывающего и ОСТАЁТСЯ там.
        // Уходит только по /leave или когда его позвали в другую комнату (тогда connectTo
        // делает rejoin). Проверяем «уже здесь?» ДО connectTo -- иначе ответ соврёт.
        if (name === 'join')
        {
            const voiceChannel = interaction.member && interaction.member.voice ? interaction.member.voice.channel : null;
            if (!voiceChannel)
                return interaction.reply ({ content: '🔊 Сначала зайди в голосовой канал!', flags: MessageFlags.Ephemeral });
            const here = !!m.connection && m.connection.joinConfig.channelId === voiceChannel.id;
            connectTo (interaction);
            // [v2.7] куда писать уведомления (например «трек не воспроизвёлся»), если
            // /join был первым вызовом, а /play никто не делал:
            if (!m.textChannelId) m.textChannelId = interaction.channelId;
            return interaction.reply
            (
                here
                    ? '🎧 Я уже тут: **' + voiceChannel.name + '**. Выйти -- `/leave`.'
                    : '🎧 Зашёл в **' + voiceChannel.name + '** и остаюсь. Выйти -- `/leave`.'
            );
        }

        if (name === 'play')
        {
            if (!interaction.member.voice.channel)
                return interaction.reply ({ content: '🔊 Сначала зайди в голосовой канал!', flags: MessageFlags.Ephemeral });

            await interaction.deferReply ();
            let query = interaction.options.getString ('запрос');

            let tracks;
            try
            {
                tracks = isUrl (query) ? await playlistInfo (query) : [await trackInfo ('ytsearch1:' + query)];
            }
            catch (e)
            {
                return interaction.editReply ('❌ Не нашёл: `' + e.message.slice (0, 150) + '`');
            }
            if (!tracks.length)
                return interaction.editReply ('❌ Пустой результат.');

            connectTo (interaction);
            m.textChannelId = interaction.channelId;
            let wasIdle = !m.current && !m.tracks.length;
            m.tracks.push (...tracks);
            scheduleVoiceStatus (guildId); // [v2.7] очередь изменилась -- обновим статус канала
            schedulePresence ();           // [v2.8] «ещё N в очереди»
            if (!wasIdle) startPreload (guildId); // [v2.9] уже играет что-то -- готовим следующий
            await interaction.editReply
            (
                '🎶 Добавлено: **' + (tracks[0].title || query) + '**' +
                (tracks.length > 1 ? ' + ещё ' + (tracks.length - 1) + ' треков' : '') +
                '\nИсточник: `' + tracks[0].author + '` | Длина: `' + fmtDur (tracks[0].duration) + '`' +
                (wasIdle ? '\n▶️ Запускаю...' : '')
            );
            if (wasIdle)
                playNext (guildId);
        }
        else if (name === 'stop')
        {
            m.tracks = [];
            m.current = null;
            dropPreload (m); // [v2.9] очередь очищена -- заготовка больше не нужна
            m.player.stop (true);
            scheduleVoiceStatus (guildId, true); // [v2.7] статус: тишина, очередь пустая
            schedulePresence (true);             // [v2.8] больше не «слушает»
            return interaction.reply ('⏹ Остановлено, очередь очищена.');
        }
        else if (name === 'skip')
        {
            if (!m.current)
                return interaction.reply ({ content: '🤷 Сейчас ничего не играет.', flags: MessageFlags.Ephemeral });
            let skipped = m.current.title;
            m.player.stop (true); // Idle-хэндлер запустит следующий
            return interaction.reply ('⏭ Пропущено: **' + skipped + '**');
        }
        else if (name === 'pause')
        {
            m.player.pause ();
            scheduleVoiceStatus (guildId, true); // [v2.7] статус: ⏸
            schedulePresence (true);             // [v2.8] статус: ⏸ трек
            return interaction.reply ('⏸ Пауза.');
        }
        else if (name === 'resume')
        {
            m.player.unpause ();
            scheduleVoiceStatus (guildId, true);
            schedulePresence (true);
            return interaction.reply ('▶️ Продолжаем.');
        }
        else if (name === 'queue')
        {
            if (!m.current && !m.tracks.length)
                return interaction.reply ('🈳 Очередь пуста.');
            let list = m.tracks.slice (0, 10).map ((t, i) => (i + 1) + '. **' + t.title + '** `' + fmtDur (t.duration) + '`').join ('\n');
            return interaction.reply
            (
                '🎵 **Сейчас:** ' + (m.current ? '**' + m.current.title + '** `' + fmtDur (m.current.duration) + '`' : '—') +
                (m.tracks.length ? '\n\n**Далее (' + m.tracks.length + '):**\n' + list : '')
            );
        }
        else if (name === 'leave')
        {
            // [v2.7] раньше бот отвечал «вышел», даже если нигде не сидел:
            if (!m.connection)
                return interaction.reply ({ content: '🤷 Я и так не в голосовом канале.', flags: MessageFlags.Ephemeral });
            destroyMusic (guildId);
            return interaction.reply ('👋 Вышел из голосового канала.');
        }
    }
    catch (e)
    {
        console.error ('[music] interaction error: ' + e.message);
        if (interaction.deferred || interaction.replied)
            interaction.editReply ('❌ Ошибка: ' + e.message.slice (0, 150)).catch (() => {});
        else
            interaction.reply ({ content: '❌ Ошибка: ' + e.message.slice (0, 150), flags: MessageFlags.Ephemeral }).catch (() => {});
    }
});

// Регистрируем команды после готовности клиента:
client.once ('clientReady', () => registerMusicCommands ());
