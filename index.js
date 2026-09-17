// Discord PANDAMIA Bot ## panda ;D
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
// CHANGELOG v2.1 (работа БЕЗ привилегированных интентов -- заявку Discord подавать не надо!):
//   * интент GuildMembers УБРАН (привилегированный; после 09.10.2026 без одобрения
//     бот не запустился бы). Вход/выход участников ловим REST-поллингом
//     (см. pollMembers в конце файла) -- разрешено всем приложениям.
//   * Welcome-ЛС новичкам отключены (по решению владельца).
//   * Логи входов/выходов в журнал -- сохранены.
//   * Причины банов -- как было: 'Забанен ботом на N мин.'
//   * [БОНУС] ban-таймауты теперь рестарт-безопасны: при старте и в каждом тике
//     просроченные membersBanTimeout из SQLite снимаются (sweepExpiredBans).
// ## panda
// https://discord.com/developers/applications/707658265189941268
// https://discord.com/oauth2/authorize?client_id=707658265189941268&scope=bot&permissions=8
//
// TODO:
// * top ? ;-)
// * create rooms!
// * many room's...
// * /unban & /claim
// * democracy? ban/mod...

const
{
    ID, TOKEN, PREFIX, SERVERS,
    ERROR, DEBUG, NOTICE, STARTUP_DM,
}
= require ('./config.json');
const space = ' ';

// [v2.2] Инструкция по использованию -- рассылается в ЛС при каждом старте бота:
const STARTUP_DM_TEXT =
    '**Как пользоваться ботом** 🐼\n' +
    '\n' +
    '🎵 **Музыка** (слэш-команды; сначала зайди в голосовой канал):\n' +
    '`/play ссылка или запрос` -- трек или плейлист (YouTube, SoundCloud и др.)\n' +
    '`/skip` -- следующий • `/stop` -- стоп и очистить очередь\n' +
    '`/pause` / `/resume` -- пауза / продолжить • `/queue` -- что играет\n' +
    '`/leave` -- выйти из голосового канала\n' +
    '\n' +
    '💬 **Команды в чате** (префикс `panda `):\n' +
    '`panda ping` -- проверка связи (ответ: pong)\n' +
    '`panda file` + вложение -- бот вернёт файл обратно\n' +
    '`panda dm @юзер текст` -- ЛС от имени бота (только админы)\n' +
    '\n' +
    '🛡️ **Что бот делает сам:**\n' +
    '• мут/глухота в чужих каналах; жалоба -- зайди в общий канал 🆘\n' +
    '• выдаёт права владельцу канала и ставит тег 🔑 в ник\n' +
    '• бан на 20 минут за выход с сервера (таймаут на перезаход)\n' +
    '\n' +
    '🖥️ **Если бот выключен** -- напиши владельцу: <@!247110936115150848>';

const
{
    Client,
    GatewayIntentBits,
    Partials,
    ChannelType,
    PermissionsBitField,
    Collection,
} = require ('discord.js');

// [v2.1] GuildMembers интент УБРАН -- он привилегированный, без одобрения Discord
// бот после 09.10.2026 просто не запустился бы ('Used disallowed intents').
// Вход/выход участников теперь ловим БЕЗ интента -- REST-поллингом (см. pollMembers).
const client = new Client
(
    {
        intents:
        [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildBans,
            GatewayIntentBits.GuildMessages,
            // GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.DirectMessages,
        ],
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

// Heavy GO! +D
// here you go...
client.login (TOKEN).catch (e => console.error ('[login] error: ' + e.message));

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
        // [v2.2] Инструкция по использованию -- в ЛС владельцу и коллеге (STARTUP_DM из config.json):
        for (const uid of (STARTUP_DM || []))
        {
            await client.users.fetch (uid)
            .then
            (
                user =>
                user.send
                (
                    {
                        embeds:
                        [
                            {
                                color: 0x00CCFF,
                                title: '🐼 PANDAMIA Bot: инструкция',
                                description: STARTUP_DM_TEXT,
                                footer:
                                {
                                    text: SERVERS[Object.keys (SERVERS)[0]] ? SERVERS[Object.keys (SERVERS)[0]].name : 'PANDAMIA Bot',
                                },
                                timestamp: dt(), // [v14] только Date/number (locale-строка кидала 'Invalid time value'),
                            },
                        ],
                    }
                )
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
function attachOf (message)
{
    return {files: message.attachments};
}

// (node:16096) DeprecationWarning: The message event is deprecated. Use messageCreate instead
client.on ('messageCreate', message =>
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
            .then  (console.log)
            .catch (console.error);
            //message.reply ('Pika!');
        }

        // command 'test' ## Test POWER Function! >D
        if (message.content.startsWith (PREFIX + 'test'))
        {
            // to User (DM):
            const lapulya = '247110936115150848';//uid
            // v14: users.fetch с одним аргументом (cache/force убраны); resolve -> кэш:
            let destination = client.users.cache.get (lapulya);
            // sending...
            if (destination)
                destination.send
                (
                    {
                        embeds:
                        [
                            {
                                color: 0xFF0000, // 'RED',
                                description: `${destination}` + ', вам ограниченно общение в канале `оппозиция` 😉',
                            }
                        ],
                    }
                )
                .catch (console.error);
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
                /* delete source & send message */
                message.channel.bulkDelete(1);
                let attach = attachOf (message);
                // [v14] channels.resolve теперь асинхронный -- берём из кэша:
                let pipe_channel_target =
                    client.channels.cache.get
                        (_pipe_channel_target);
                if (pipe_channel_target) // check!
                {
                    pipe_channel_target.send
                    (
                        {
                            content: message.content
                                ? message.content
                                : undefined,
                            ...attach // || {}
                        }
                    )
                    .catch (console.error);
                    console.log
                    (
                        '[' + (d()) + '] ' +
                        'message from bot (by ' + message.author.username + '): ' +
                        (
                            message.content
                                ? '"' + message.content + '"' + (attach.files.length ? ' + <ATTACH>' : '')
                                : '<ATTACH>'
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
                            message.content
                                ? '"' + message.content + '"' + (attach.files.length ? ' + <ATTACH>' : '')
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
                    let admin = message.member._roles.includes (SERVERS[server].role_admin);
                    if (admin)
                    {
                        message.channel.bulkDelete(1); // Tss... ;]
                        // https://discordjs.guide/miscellaneous/parsing-mention-arguments.html#how-discord-mentions-work
                        let mention = message.mentions.users.first();
                        if (mention) // <@!696094527328616569>
                        {
                            let letter = message.content.slice
                            (
                                (PREFIX + 'dm').length
                            )
                            .replace
                            (
                                u (mention.id),  // <@!...> // !
                                    '' // <--|
                            )
                            .trim();
                            let attach = attachOf (message);
                            if (letter || attach.files.length)
                            {
                                mention.send ({content: letter ? letter : undefined, ...attach})
                                .catch (console.error);
                                console.log
                                (
                                    '[' + (d()) + '] ' +
                                        'DM from ' + message.author.username + ' to ' + mention.username + ': ' +
                                        (
                                            letter
                                                ? '"' + letter + '"' + (attach.files.length ? ' + <ATTACH>' : '')
                                                : '<ATTACH>' // we have an empty message content... // ;)
                                        )
                                );
                            }
                        }
                    }
                }
                // command 'test' ## Block test in TEXT channels... ;)
                else if (message.content.startsWith (PREFIX + 'test'))
                {
                    message.channel.bulkDelete(1); // delete command?
                }
            }
        }
    }
});
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

client.on ('voiceStateUpdate', async (oldState, newState) =>
{
    const server = newState.guild.id; // Guild need!
    if (server in SERVERS && SERVERS[server].allow)
    {
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
                                    console.log ('[' + (d()) + '] ' + newState.member.user.username + ' get mute in ' + channel.name);
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
                            channel =>
                            {
                                if (channel_common && channel.id !== channel_common)
                                {
                                    newState.setChannel (channel_common)
                                    .catch (e => console.error ('[voiceStateUpdate] error on newState.setChannel: ' + e.message));
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
                                console.log ('[' + (d()) + '] ' + newState.member.user.username + ' get deaf in ' + channel.name);
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
                                console.log ('[' + (d()) + '] ' + newState.member.user.username + ' get unmute in ' + channel.name);
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
                                console.log ('[' + (d()) + '] ' + newState.member.user.username + ' get undeaf in ' + channel.name);
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

// Лог входа/выхода участника в журнал (как было на событиях):
function logMemberJoinLeave (server, memberUser, isJoin)
{
    let log_channel = SERVERS[server].log_channel || '';
    if (!log_channel) return;
    let log_text = isJoin
        ? `${memberUser} **зашёл** 👋 на сервер \`${SERVERS[server].name}\` 🟩`
        : `${memberUser} **вышел** 🚪 с сервера \`${SERVERS[server].name}\` 🟥`;
    client.channels.resolve(log_channel).send
    (
        {
            content: `${memberUser}`,
            embeds:
            [
                {
                    author:
                    {
                        name: memberUser.username,
                        icon_url: memberUser.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                    },
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
            // входы:
            for (let [uid, raw] of current)
            {
                if (!previous.has (uid))
                {
                    let memberUser = raw.user;
                    console.log ('[' + (d()) + '] member ' + memberUser.username + ' JOINED ' + SERVERS[server].name);
                    logMemberJoinLeave (server, memberUser, true);
                    await handleMemberJoin (server, uid, raw);
                }
            }
            // выходы:
            for (let [uid, raw] of previous)
            {
                if (!current.has (uid))
                {
                    let memberUser = raw.user;
                    console.log ('[' + (d()) + '] member ' + memberUser.username + ' LEFT ' + SERVERS[server].name);
                    logMemberJoinLeave (server, memberUser, false);
                    await handleMemberLeave (server, uid, raw);
                }
            }
        }
        $membersSnapshot[server] = current;
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
const $music = {};

function musicOf (guildId)
{
    if (!$music[guildId])
        $music[guildId] =
        {
            connection: null,
            player: createAudioPlayer (),
            tracks: [],
            current: null,
            volume: 0.5,
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
        resource.volume.setVolume (musicOf('').volume || 0.5);
    return { resource, viaProxy };
}

// Воспроизведение следующего трека:
async function playNext (guildId)
{
    const m = musicOf (guildId);
    if (!m.tracks.length)
    {
        m.current = null;
        return;
    }
    let track = m.tracks.shift ();
    m.current = track;
    try
    {
        let { resource, viaProxy } = await createTrackStream (track);
        // [FIX v2.2.1] ошибка в потоке (битое/удалённое видео) раньше валила весь бот:
        // теперь пропускаем трек и играем следующий, с уведомлением в чат:
        resource.playStream.once ('error', e =>
        {
            console.error ('[music] stream error (skip track): ' + e.message);
            // [v2.2.2] сеть упала при стриме через прокси -- следующие треки временно DIRECT:
            if (viaProxy && isNetworkError (e))
                proxyStreamDead = true;
            if (m.current === track)
            {
                m.current = null;
                let ch = m.textChannelId && client.channels.cache.get (m.textChannelId);
                if (ch)
                    ch.send ('⚠️ **' + (track.title || 'Трек') + '** -- не удалось воспроизвести, пропускаю.').catch (() => {});
                m.player.stop (true); // Idle -> playNext
            }
        });
        m.player.play (resource);
    }
    catch (e)
    {
        console.error ('[music] play error: ' + e.message);
        m.current = null;
        playNext (guildId); // пропустить битый трек
    }
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
        m.player.on (AudioPlayerStatus.Idle, () =>
        {
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
    }
    else
    {
        // пересоединение в другой канал:
        if (m.connection.joinConfig.channelId !== voiceChannel.id)
            m.connection.rejoin ({ channelId: voiceChannel.id });
    }
}

function destroyMusic (guildId)
{
    const m = $music[guildId];
    if (!m) return;
    try { m.player.stop (true); } catch {}
    try { m.connection.destroy (); } catch {}
    delete $music[guildId];
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
    new SlashCommandBuilder ()
        .setName ('play')
        .setDescription ('Включить музыку: ссылка (YouTube/плейлист) или поиск')
        .addStringOption (o =>
            o.setName ('запрос')
             .setDescription ('Ссылка или название трека')
             .setRequired (true)),
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
    if (!['play','stop','skip','pause','resume','queue','leave'].includes (name)) return;
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
            m.player.stop (true);
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
            return interaction.reply ('⏸ Пауза.');
        }
        else if (name === 'resume')
        {
            m.player.unpause ();
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
