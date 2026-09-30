// PANDAMIA Bot -- главные вехи (круглые партии; подробности и пояснения к коду --
// в личном README.local.md, короткий список вех -- в README.md).
// v2     -- переход на discord.js v14 / keyv v5 / node 24
// v2.10  -- по итогам разбора живого лога
// v2.20  -- шифрование сохранённых данных в базе (AES-256-GCM)
// v2.30  -- лог: время на каждой строке, читаемые коды, без шума от своих же глушений
// v2.40  -- приветствие ведёт в публичный канал, а не в закрытую «архивную»
// v2.50  -- перемотать чужой трек нельзя -- ни командой, ни кнопками
// v2.60  -- прокси может быть несколько -- обрыв одного не тушит музыку
// v2.70  -- сбой сети/прокси не тратит очередь
// v2.80  -- маршрут музыки -- только владельцу; `node . config`; честные слова
// v2.90  -- пачки пронумерованы, /push по номеру пачки, запрет -- только у DJ
// v2.100 -- в /history осталось только «кто, когда и какие треки»
// v2.110 -- сервисная команда возвращает консоль и говорит об этом
// v2.118 -- пачка -- это ВСЕ треки автора; «подвинуть» вместо «поднять», и это только staff
// v2.120 -- справочник имя↔адрес живёт как сам справочник: берётся из живой системы, обновляется по сроку, списков нет
// v2.121 -- собранное о сети разбирается: одна таблица, графики по часам и дням, поиск зацепок и прогноз, который сверяется с фактом
// v2.122 -- связки адресов: один адрес на много имён; первым идёт тот, через кого музыка уже шла
// v2.123 -- голос: после обрыва бот сам возвращается к слушателям и продолжает с того же места; лог сети молчит без перемен
// v2.124 -- запасной путь: YouTube недоступен -- трек играет со своей копии (проигранное остаётся на диске), в лог идёт путь; об обрыве и возвращении бот говорит в текстовый канал
// v2.125 -- запас вперёд: пока играет музыка, бот сам догружает на диск очередь (по одному треку, до 20 вперёд) -- один трек это один файл, дважды одно и то же не качается; место кончилось -- первым уходит давно проигранное, а то, что впереди, в последнюю очередь; `node . cache` говорит, чего ещё не хватает
// v2.132 -- свой маршрут по адресам засчитывается путём для музыки только если проверен делом: бот раз в 10 минут прогоняет через него yt-dlp и, если тот не дошёл, за путь его не считает и говорит об этом прямо (проверка самим ботом, а не «мне кажется, работает»)
// v2.131 -- голос видно по-настоящему: в /health у владельца есть кнопка «Проверить голос по-настоящему» -- если бот в канале и к медиа-адресу ходят пакеты (udp-пинг), она отвечает сразу и музыку не трогает, а если пинга нет -- выходит из канала, входит заново (это и есть проверка медиа-адреса), возвращает музыку на то же место и пишет результат; в самой /health видно и пинг медиа-пути
// v2.130 -- обход под присмотром и видно, кто за ним следит: сторож (он же хранитель -- пункт 6 в tools/obhod.cmd) сам переподбирает стратегию, автозапуск (пункт 7) только поднимает сторожа при входе, и это решает человек; при старте, если ни один путь к YouTube не работает, владельцу уходит короткое «что сделать сейчас» с готовой командой; дальше бот следит за службой zapret, движком и сторожем -- встал обход или сторожа нет, напишет и скажет, что поставить, а когда поднимется -- сообщит отдельно; состояние сторожа видно в /health и `node . obhod`
// v2.129 -- обход замечает собственную смерть: если движок работает, а ютуб или дискорд (шлюз, api, голос) не отвечают -- бот говорит владельцу, что стратегия устарела и нужен подбор, а когда отпустит -- сообщает; `node . obhod --start` и кнопка «Поднять обход» возвращают сохранённую стратегию после перезагрузки за пару секунд (один запрос прав, в автозапуск ничего не пишется)
// v2.128 -- обход можно вести из консоли: `node . obhod` показывает, что с движком, службой и драйвером (и ничего не меняет), `--engine` приносит движок без прав, `--pick` подбирает и оставляет стратегию, `--stop` возвращает как было; подбор идёт с одним запросом прав Windows, в автозапуск бот ничего не ставит, а кнопка у владельца в /health делает то же
// v2.127 -- связь видно и лечится сама: /health говорит, сколько было обрывов голоса и сети, вернулся ли бот сам и каким путём идёт звук; когда ни один путь не работает, бот сам приносит движок обхода и запускает хранителя из планировщика, а если прав не хватило -- честно пишет владельцу, чего именно (ключ MUSIC.dpi_heal)
// v2.126 -- пути и обрывы: при старте одна строка -- что сейчас работает (прямой путь, обход DPI, прокси, свой DoH-маршрут по адресам) и что включить, если не работает ничего; обрывы голоса и сети считаются (когда, сколько ждал, вернулся ли сам и с какой попытки) и видны в `node . net`; в /queue и /nowplaying видно, каким путём идёт звук; запас на диске по умолчанию 2 ГБ

function earlyConfigCrash (e)
{
    try
    {
        const _fs = require ('fs');
        const _dir = __dirname + '/logs';
        const _now = new Date ();
        const _two = n => String (n).padStart (2, '0');
        _fs.mkdirSync (_dir, {recursive: true});
        const _p = _dir + '/crash-' + _now.getFullYear () + '-' + _two (_now.getMonth () + 1) + '-' + _two (_now.getDate ()) +
            '_' + _two (_now.getHours ()) + '-' + _two (_now.getMinutes ()) + '-' + _two (_now.getSeconds ()) + '.txt';
        _fs.writeFileSync (_p, [
            'ОТЧЁТ О СБОЕ -- 🐼 PANDAMIA Bot',
            'когда: ' + _now.toLocaleString ('ru-RU'),
            'что: бот не смог прочитать config.json (упал на старте)',
            'причина: ' + String ((e && e.message) || e),
            '',
            'СТЕК:',
            (e && e.stack) ? String (e.stack) : '(стека нет)',
            '',
            'ЧТО ДЕЛАТЬ: проверь config.json -- почти всегда это лишняя/потерянная запятая или кавычка.',
            'Сверить можно с config.example.json (там всё то же, но с комментариями), а значения -- не трогать:',
            'в файле лежат token и db_key, без которых бота не запустить. Живого лога тут нет -- этот сбой',
            'случается раньше первой строки.',
        ].join ('\n') + '\n');
        process.stderr.write ('[crash] бот не смог прочитать config.json -- отчёт: ' + _p + '\n');
    }
    catch (e2) {}
    process.exit (2);
}
let CONFIG_RAW = null;
try { CONFIG_RAW = require ('./config.json'); }
catch (e) { earlyConfigCrash (e); }

const
{
    ID, TOKEN, PREFIX, SERVERS,
    DEBUG, STARTUP_DM,
    MESSAGE_CONTENT,
    GUILD_MEMBERS,
    OWNER, MUSIC,
    db_key, db_key_prev,
    privacy_url,
    show_privacy_url,
    backup_minutes,
    backup_keep,
    log_dir, log_keep_months,
}
= CONFIG_RAW;
const space = ' ';

const BOT_RUN = process.argv.slice (2).length === 0;
const utilMod = require ('util');
const fsLog = require ('fs');
const pathMod = require ('path');
const LOG_DIR = (() =>
{
    const cfg = String (log_dir === undefined || log_dir === null ? '' : log_dir).trim ();
    if (!cfg) return pathMod.join (__dirname, 'logs');
    return pathMod.isAbsolute (cfg) ? pathMod.normalize (cfg) : pathMod.join (__dirname, cfg);
}) ();
function logBaseName (p)
{
    const _s = String (p === undefined || p === null ? '' : p).trim ()
        .replace (/\s+/g, '-')
        .replace (/[^0-9A-Za-zА-Яа-яЁё_-]/g, '-')
        .replace (/-+/g, '-')
        .replace (/^[-_]+|[-_]+$/g, '');
    return _s || 'bot';
}
const LOG_BASE = logBaseName (PREFIX);
const LOG_KEEP_MONTHS = Math.max (0, Math.round (Number (log_keep_months) || 0));
const logMonthKey = t => t.getFullYear () + '-' + String (t.getMonth () + 1).padStart (2, '0');
let $logMonthPath = '', $logKey = '', $logWarned = false;
function logFilePath () { return $logMonthPath; }
function logPruneMonths (keep, now)
{
    if (!keep) return 0;
    let gone = 0;
    try
    {
        for (const name of fsLog.readdirSync (LOG_DIR))
        {
            const mm = /^(?:.+)-(\d{4})-(\d{2})\.log$/.exec (name);
            if (!mm) continue;
            const age = (now.getFullYear () - Number (mm[1])) * 12 + (now.getMonth () + 1 - Number (mm[2]));
            if (age >= keep) { try { fsLog.unlinkSync (pathMod.join (LOG_DIR, name)); gone++; } catch (e) {} }
        }
    }
    catch (e) {}
    return gone;
}
function logFileWrite (line)
{
    if ($logWarned) return;
    try
    {
        const now = new Date ();
        const key = logMonthKey (now);
        if (key !== $logKey)
        {
            fsLog.mkdirSync (LOG_DIR, {recursive: true});
            const gone = logPruneMonths (LOG_KEEP_MONTHS, now);
            $logMonthPath = pathMod.join (LOG_DIR, LOG_BASE + '-' + key + '.log');
            $logKey = key;
            if (gone)
                fsLog.appendFileSync ($logMonthPath, '[' + d () + '] [log] убрал старых файлов лога: ' + gone +
                    ' (log_keep_months: ' + LOG_KEEP_MONTHS + ')\n');
        }
        fsLog.appendFileSync ($logMonthPath, line + '\n');
    }
    catch (e)
    {
        $logWarned = true;
        $logMonthPath = '';
        conOut ('[' + d () + '] [log] в файл не пишу (' + ((e && e.message) || e) +
            ') -- живой лог остаётся только в консоли');
    }
}

const CON_QUEUE_MAX_BYTES = 512 * 1024;
let $conWrite = null, $conDrain = null, $conHalt = null, $conMode = '', $conNote = '', $conCpBefore = 0;
function conOut (text)
{
    if ($conWrite) { $conWrite (text); return; }
    try { process.stderr.write (text + '\n'); } catch (e) {}
}
function consoleCodePage ()
{
    try
    {
        const out = String (require ('child_process').execSync ('chcp',
            {encoding: 'latin1', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000}) || '');
        const m = /(\d{3,5})/.exec (out);
        return m ? Number (m[1]) : 0;
    }
    catch (e) { return 0; }
}
function setConsoleCodePage (cp)
{
    try { require ('child_process').execSync ('chcp ' + cp, {stdio: 'ignore', timeout: 4000}); return true; }
    catch (e) { return false; }
}
function consoleRestoreCodePage ()
{
    if ($conCpBefore) { const was = $conCpBefore; $conCpBefore = 0; setConsoleCodePage (was); }
}
function consoleByteSafe ()
{
    if (!process.stdout.isTTY) return {ok: true, note: ''};
    const cp = consoleCodePage ();
    if (cp === 65001) return {ok: true, note: ''};
    if (setConsoleCodePage (65001)) { $conCpBefore = cp || 0; return {ok: true, note: 'кодовую страницу окна перевёл в UTF-8 (была ' + (cp || '?') + ')'}; }
    return {ok: false, note: cp ? String (cp) : 'не прочиталась'};
}
function consoleWriter ()
{
    const q = [];
    let bytes = 0, sending = false, dead = false, stalled = false, dropped = 0;
    function pump ()
    {
        if (sending || dead || !q.length) return;
        const buf = q[0];
        sending = true;
        fsLog.write (1, buf, 0, buf.length, null, (err, written) =>
        {
            sending = false;
            if (err)
            {
                dead = true; q.length = 0; bytes = 0;
                logFileWrite ('[' + d () + '] [log] в консоль больше не пишу (' + ((err && err.message) || err) +
                    ') -- живой лог остаётся в файле');
                return;
            }
            if (written && written < buf.length) { q[0] = buf.subarray (written); bytes -= written; }
            else { q.shift (); bytes -= buf.length; }
            if (!q.length && stalled)
            {
                stalled = false;
                logFileWrite ('[' + d () + '] [log] окно консоли снова принимает вывод -- продолжаю писать в него ' +
                    '(пока оно молчало, ' + dropped + ' строк в консоль не пошло: все они есть в файле)');
                dropped = 0;
            }
            pump ();
        });
    }
    return {
        write: text =>
        {
            if (dead) return;
            const buf = Buffer.from (String (text) + '\n', 'utf8');
            if (bytes + buf.length > CON_QUEUE_MAX_BYTES)
            {
                dropped++;
                if (!stalled)
                {
                    stalled = true;
                    logFileWrite ('[' + d () + '] [log] окно консоли НЕ принимает вывод (зависло, выделен текст или не отрисовывается) -- ' +
                        'бот работает дальше, строки идут в файл; в консоль молчу, пока она не освободится');
                }
                return;
            }
            q.push (buf); bytes += buf.length; pump ();
        },
        drain: ms => new Promise (resolve =>
        {
            const till = Date.now () + Math.max (0, Number (ms) || 0);
            const step = () =>
            {
                if (dead || (!sending && !q.length)) return resolve (true);
                if (Date.now () >= till) return resolve (false);
                setTimeout (step, 20);
            };
            step ();
        }),
        halt: () => { dead = true; q.length = 0; bytes = 0; },
    };
}

if (BOT_RUN)
{
    const _safe = consoleByteSafe ();
    const _con = _safe.ok ? consoleWriter () : null;
    $conMode = _con ? 'async' : 'sync';
    $conNote = _safe.note;
    if (_con) { $conWrite = _con.write; $conDrain = _con.drain; $conHalt = _con.halt; }
    const _mirror = (syncSink, asyncSink) => (...args) =>
    {
        const line = utilMod.format (...args);
        logFileWrite (line);
        return asyncSink ? asyncSink (line) : syncSink (line);
    };
    console.log = _mirror (console.log.bind (console), _con ? _con.write : null);
    console.error = _mirror (console.error.bind (console), _con ? _con.write : null);
}

const CRASH_TAIL_LINES = 40;
let $crashAt = 0, $crashCount = 0, $crashWritten = false;

function logTailLines (n)
{
    try
    {
        const p = logFilePath () || pathMod.join (LOG_DIR, LOG_BASE + '-' + logMonthKey (new Date ()) + '.log');
        const arr = fsLog.readFileSync (p, 'utf8').split ('\n').filter (l => l !== '');
        return arr.slice (Math.max (0, arr.length - n));
    }
    catch (e) { return []; }
}

function crashMusicSummary ()
{
    const out = [];
    try
    {
        for (const g of Object.keys ($music))
        {
            const m = $music[g];
            if (!m) continue;
            const where = SERVERS[g] ? SERVERS[g].name : g;
            out.push ('  ' + where + ': ' + (m.current ? 'играет «' + (m.current.title || '?') + '»' : 'ничего не играет') +
                ', в очереди ' + ((m.tracks && m.tracks.length) || 0) +
                (m.connection ? ', в канале ' + (m.connection.joinConfig.channelId || '?') : ', не в канале'));
        }
    }
    catch (e) { out.push ('  (состояние музыки ещё не успело появиться)'); }
    return out.length ? out : ['  (бот ещё не успел ничего заиграть)'];
}

function crashReport (kind, e, note)
{
    if (!BOT_RUN || $crashWritten) return '';
    const now = new Date ();
    const two = n => String (n).padStart (2, '0');
    const path = pathMod.join (LOG_DIR, 'crash-' + now.getFullYear () + '-' + two (now.getMonth () + 1) + '-' + two (now.getDate ()) +
        '_' + two (now.getHours ()) + '-' + two (now.getMinutes ()) + '-' + two (now.getSeconds ()) + '.txt');
    const reason = e ? String ((e && e.message) || e) : '(без исключения -- выход с ненулевым кодом)';
    const stack = (e && e.stack) ? String (e.stack) : '(стека нет)';
    const tail = logTailLines (CRASH_TAIL_LINES);
    const lines = [];
    lines.push ('ОТЧЁТ О СБОЕ -- 🐼 PANDAMIA Bot');
    lines.push ('когда: ' + now.toLocaleString ('ru-RU'));
    lines.push ('что: ' + kind);
    lines.push ('причина: ' + reason);
    if (note) lines.push ('примечание: ' + note);
    lines.push ('повторов сбоя в этой сессии: ' + $crashCount);
    lines.push ('');
    lines.push ('СОСТОЯНИЕ: узел ' + process.version + ', поднят ' + Math.round (process.uptime ()) + ' сек назад, папка ' + __dirname);
    lines.push ('музыка:');
    for (const l of crashMusicSummary ()) lines.push (l);
    lines.push ('');
    lines.push ('СТЕК:');
    lines.push (stack);
    lines.push ('');
    lines.push ('ПОСЛЕДНИЕ СТРОКИ ЛОГА (' + tail.length + '; полный лог -- ' + (logFilePath () || 'logs/') + '):');
    if (tail.length) for (const l of tail) lines.push (l);
    else lines.push ('  (лог ещё пуст -- сбой случился раньше первой строки)');
    lines.push ('');
    lines.push ('Что дальше: этого файла достаточно, чтобы понять, с чего всё началось; сам бот можно');
    lines.push ('запустить снова командой `node .` -- очередь и позиция в треке не теряются.');
    try { fsLog.mkdirSync (LOG_DIR, {recursive: true}); } catch (e2) {}
    try { fsLog.writeFileSync (path, lines.join ('\n') + '\n'); }
    catch (e2) { return ''; }
    $crashWritten = true;
    return path;
}

function crashIncident (kind, e, note)
{
    $crashCount++;
    const now = Date.now ();
    if (now - $crashAt < 60000) return '';
    $crashAt = now;
    $crashWritten = false;
    return crashReport (kind, e, note);
}

process.on ('exit', code =>
{
    consoleRestoreCodePage ();
    if (!code || !BOT_RUN) return;
    const p = crashReport ('аварийный выход (код ' + code + ')', null,
        'бот завершился не сам -- например, упал на старте или его закрыли');
    if (p) { try { process.stderr.write ('[' + d () + '] [crash] отчёт о сбое: ' + p + '\n'); } catch (e2) {} }
});

const crypto = require ('crypto');
const DB_ENC_PREFIX = 'enc1:';
const DB_ENC_SALT = 'pandamia-db-v1';
const DB_ENC_HEX = /^[0-9a-fA-F]{64}$/;

const CONSOLE_CMDS = ['help', 'config', 'keygen', 'dump', 'net', 'files', 'cache', 'privacy', 'backup', 'checkpoint', 'backups', 'restore', 'clearstatus', 'unkey', 'fixauthors', 'cookies', 'ytdlp', 'voice', 'obhod'];
const CONSOLE_HELP =
[
    ['node .',                    'запустить бота и смотреть живой лог (Ctrl+C -- выйти)'],
    ['node . help',               'этот список'],
    ['node . keygen',             'напечатать новый ключ шифрования базы (для строки db_key)'],
    ['node . dump [id]',          'посмотреть базу глазами (только чтение, бот не запускается)'],
    ['node . net',                'разбор сети: сколько знаем имён и адресов, кто отвечает, что подписано, что давно'],
    ['node . config',             'чем бот РЕАЛЬНО работает: все ключи, их значения и откуда взяты (бот не запускается)'],
    ['node . files',              'что за каждый файл в папке и что можно удалять'],
    ['node . cache [--clear]',    'кэш музыки: что скачано, сколько занимает, чего ещё не хватает в запасе по очереди, что удалять (--clear -- стереть всё)'],
    ['node . cookies [--save [бр]]', 'cookie для YouTube: что задано и принял ли их YouTube (--save -- собрать файл из браузера: firefox, helium, chrome, edge...)'],
    ['node . ytdlp [--update]',   'версия yt-dlp и её возраст (--update -- обновить: yt-dlp -U)'],
    ['node . privacy [--check]',  'пересобрать PRIVACY.md из шаблона (--check -- только проверить)'],
    ['node . privacy --offline',  'то же, но без обращения к Discord за именами'],
    ['node . backup',             'сделать копию базы с датой в имени (как при старте и по таймеру)'],
    ['node . checkpoint [метка]', 'сделать контрольную точку (файл с датой в имени; бот их не удаляет)'],
    ['node . backups',            'что есть: база, копии с датой и контрольные точки'],
    ['node . restore [метка]',    'вернуть базу из самой свежей копии (без метки) или из копии/точки по метке'],
    ['node . clearstatus <id>',   'разово снять свою строку из статуса голосового канала'],
    ['node . voice [id канала]',  'проверить вход в голосовой канал по-настоящему (музыка играет именно там)'],
    ['node . obhod',              'обход блокировки: что сейчас, что можно сделать (--engine --pick --start --stop; нужны права -- один запрос)'],
    ['node . fixauthors <id> [имя] [--dry]', 'проставить автора трекам в очереди, где его нет'],
];
function printConsoleHelp ()
{
    const _w = CONSOLE_HELP.reduce ((a, _c) => Math.max (a, _c[0].length), 0) + 1;
    console.log ('Команды в папке бота (регистр не важен), пример: node . backup');
    for (const _c of CONSOLE_HELP) console.log ('  ' + _c[0].padEnd (_w) + ' -- ' + _c[1]);
    console.log ('Всё, что открывает ключи и базу, делается ТОЛЬКО здесь, в консоли, а не в Discord.');
}
const $cliHold = ['fixauthors', 'cookies', 'ytdlp', 'voice'].some (_c =>
    CONSOLE_CMDS.includes (_c) && process.argv.slice (2).some (_a => new RegExp ('^' + _c + '$', 'i').test (_a)));
if (BOT_RUN && !$cliHold)
{
    const _busy = botAlreadyRunning ();
    if (_busy)
    {
        const _msg = '[' + (d()) + '] [bot] ' + _busy + ' Два бота рвут друг другу голос '
            + '(у слушателей тишина, а в логе -- пачки «IP discovery»), поэтому второй запуск не открываю.';
        logFileWrite (_msg);
        try { process.stderr.write (_msg + '\n'); } catch (e) { }
        process.exit (0);
    }
    process.on ('exit', botLockRelease);
}
{
    const _first = String (process.argv[2] === undefined ? '' : process.argv[2]).trim ();
    if (/^help$/i.test (_first))
    {
        printConsoleHelp ();
        process.exit (0);
    }
    if (_first && !CONSOLE_CMDS.includes (_first.toLowerCase ()))
    {
        console.log ('Неизвестная команда: ' + _first);
        printConsoleHelp ();
        process.exit (2);
    }
}

if (process.argv.slice (2).some (_a => /^keygen$/i.test (_a)))
{
    console.log ('новый db_key (вставь его в config.json в строку "db_key"):');
    console.log (crypto.randomBytes (32).toString ('hex'));
    process.exit (0);
}

let $cliOwnScreen = () => { };
if (!BOT_RUN)
{
    const _realLog = console.log.bind (console), _realErr = console.error.bind (console);
    const _held = [];
    let _own = false;
    const _push = (_fn, a) => { if (_own) _fn (...a); else _held.push ([_fn, a]); };
    console.log = (...a) => _push (_realLog, a);
    console.error = (...a) => _push (_realErr, a);
    $cliOwnScreen = () => { _own = true; _held.length = 0; };
    process.on ('exit', () => { if (!_own) for (const [_fn, _a] of _held) try { _fn (..._a); } catch (e) { } });
}
let cliCmdName = '';
if (!BOT_RUN)
{
    const _argv = process.argv.slice (2).map (_a => String (_a).toLowerCase ());
    cliCmdName = CONSOLE_CMDS.find (_c => _argv.includes (_c)) || _argv[0] || '';
}
const CLI_BUDGET_S = { fixauthors: 600, backup: 300, restore: 300, checkpoint: 300, privacy: 300,
    cache: 300, ytdlp: 300, cookies: 120, voice: 120, obhod: 3600 };
const CLI_BUDGET_DEFAULT_S = 120;
function $cliDone (_code)
{
    const _line = '[' + (cliCmdName || 'bot') + '] команда закончена (код ' + _code + ') -- управление возвращается в консоль';
    try { logFileWrite ('[' + (d()) + '] ' + _line + '\n'); } catch (e) { }
    try { process.stdout.write (_line + '\n'); } catch (e) { }
    process.exit (_code);
}
if (!BOT_RUN && cliCmdName)
{
    const _sec = CLI_BUDGET_S[cliCmdName] || CLI_BUDGET_DEFAULT_S;
    const _watch = setTimeout (() =>
    {
        const _why = 'сторож: команда идёт дольше ' + _sec + ' с (сеть, прокси или браузер не отвечают?)' +
            ' -- завершаю процесс, чтобы управление вернулось в консоль';
        try { logFileWrite ('[' + (d()) + '] [' + cliCmdName + '] ' + _why + '\n'); } catch (e) { }
        try { process.stderr.write ('[' + cliCmdName + '] ' + _why + '\n'); } catch (e) { }
        process.exit (1);
    }, _sec * 1000);
    if (_watch.unref) _watch.unref ();
}

function dbKeyMake (_raw)
{
    const _s = String (_raw === undefined || _raw === null ? '' : _raw).trim ();
    if (!_s) return null;
    if (DB_ENC_HEX.test (_s)) return Buffer.from (_s, 'hex');
    return crypto.scryptSync (_s, DB_ENC_SALT, 32);
}
const _key0 = dbKeyMake (db_key);
const DB_KEYS = _key0
    ? [_key0, ...(Array.isArray (db_key_prev) ? db_key_prev : []).map (dbKeyMake).filter (Boolean)]
    : [];
let _dbEncWarn = 0;
const dbRawStr = (_raw) => Buffer.isBuffer (_raw) ? _raw.toString ('utf8')
    : String (_raw === undefined || _raw === null ? '' : _raw);

function dbEncKey (_key, _text)
{
    const _iv = crypto.randomBytes (12);
    const _c = crypto.createCipheriv ('aes-256-gcm', _key, _iv);
    const _body = Buffer.concat ([_c.update (_text, 'utf8'), _c.final ()]);
    return DB_ENC_PREFIX + Buffer.concat ([_iv, _c.getAuthTag (), _body]).toString ('base64');
}
function dbDecKey (_key, _text)
{
    try
    {
        const _all = Buffer.from (String (_text).slice (DB_ENC_PREFIX.length), 'base64');
        const _d = crypto.createDecipheriv ('aes-256-gcm', _key, _all.subarray (0, 12));
        _d.setAuthTag (_all.subarray (12, 28));
        return Buffer.concat ([_d.update (_all.subarray (28)), _d.final ()]).toString ('utf8');
    }
    catch (e) { return null; }
}
function dbEnc (_text) { return dbEncKey (DB_KEYS[0], _text); }
function dbDec (_text)
{
    for (const _k of DB_KEYS)
    {
        const _t = dbDecKey (_k, _text);
        if (_t !== null) return _t;
    }
    return null;
}
function dbPeekValue (_rows, _name)   // одна запись из чужой базы: только чтение (консольный разбор)
{
    const _r = (_rows || []).find (x => String (x.key) === String (_name));
    if (!_r) return null;
    let _raw = dbRawStr (_r.value);
    if (_raw.startsWith (DB_ENC_PREFIX))
    {
        const _t = DB_KEYS.length ? dbDec (_raw) : null;
        if (_t === null) return null;
        _raw = _t;
    }
    let _val = null;
    try { _val = JSON.parse (_raw); } catch (e) { return null; }
    return (_val && typeof _val === 'object' && 'value' in _val) ? _val.value : _val;   // в базе значение лежит в обёртке
}
function dbSerialize (_value)
{
    const _json = JSON.stringify (_value);
    return DB_KEYS.length ? dbEnc (_json) : _json;
}
function dbDeserialize (_raw)
{
    const _s = dbRawStr (_raw);
    const empty = { value: undefined, expires: undefined };
    if (_s.startsWith (DB_ENC_PREFIX))
    {
        if (!DB_KEYS.length)
        {
            if (_dbEncWarn++ < 3) console.log ('[' + new Date ().toLocaleString () +
                '] [db] запись зашифрована, а db_key в config.json пуст -- пропускаю её');
            return empty;
        }
        const _t = dbDec (_s);
        if (_t === null)
        {
            if (_dbEncWarn++ < 3) console.log ('[' + new Date ().toLocaleString () +
                '] [db] запись не расшифровалась (db_key изменился?) -- пропускаю её');
            return empty;
        }
        try { return JSON.parse (_t); } catch (e) { return empty; }
    }
    try { return JSON.parse (_s); }
    catch (e) { return empty; }
}

let _srvReal = 0;
const _srvPlaceholders = [];
for (const _key of Object.keys (SERVERS))
{
    if (/^\d{17,20}$/.test (_key)) { _srvReal++; continue; }
    if (!/_comment$/.test (_key))
    {
        if (/^ID_/.test (_key)) _srvPlaceholders.push (_key);
        else
            console.log ('[' + new Date ().toLocaleString () + '] [config] ключ "' + _key +
                '" в SERVERS -- не похож на id сервера -- пропускаю его');
    }
    delete SERVERS[_key];
}
if (_srvPlaceholders.length)
    console.log ('[' + new Date ().toLocaleString () + '] [config] в SERVERS осталась заготовка (' +
        _srvPlaceholders.join (', ') + ') -- вместо неё впиши id своего сервера ' +
        '(ПКМ по серверу -> Копировать ID, режим разработчика включён)');
if (!_srvReal)
    console.log ('[' + new Date ().toLocaleString () + '] [config] рабочих серверов нет: бот запустится, ' +
        'но делать ничего не будет -- заполни config.json (образец: config.example.json)');

function dbDumpDate (_t) { return new Date (_t).toLocaleString (); }
function dbDumpDur (_sec)
{
    let _s = Math.max (0, Math.round (Number (_sec) || 0));
    const _h = Math.floor (_s / 3600); _s -= _h * 3600;
    const _m = Math.floor (_s / 60);
    return (_h ? _h + ' ч ' : '') + (_h || _m ? _m + ' мин' : _s + ' сек');
}
function dbDumpLeft (_until)
{
    let _s = Math.max (0, Math.round ((_until - Date.now ()) / 1000));
    const _h = Math.floor (_s / 3600); _s -= _h * 3600;
    const _m = Math.floor (_s / 60); _s -= _m * 60;
    return (_h ? _h + ' ч ' : '') + (_h || _m ? _m + ' мин ' : '') + _s + ' сек';
}

function _qMsgTxt (_saved)
{
    const _list = (_saved ? (Array.isArray (_saved) ? _saved : [_saved]) : []).filter (w => w && w.id);
    if (!_list.length) return '';
    const _shown = _list.slice (0, 3);
    return ' | живых сообщений /queue: ' + _list.length + ': ' + _shown.map (w =>
        '<#' + (w.ch || '?') + '>, id ' + w.id + ', стр. ' + (Number (w.page) || 1) +
        (w.actorName ? ', открыл ' + clipText (String (w.actorName), 30) : '') +
        (w.actorId ? ' (' + String (w.actorId) + ')' : '')).join ('; ') +
        (_list.length > _shown.length ? ' и ещё ' + (_list.length - _shown.length) : '');
}

function dbDumpFmt (_ns, _key, _value)
{
    const _head = '[' + _ns + '] ' + _key;
    if (_value === undefined || _value === null) return _head + ' -- значение пустое';
    if (_ns === 'memberRoles')
    {
        const _roles = Array.isArray (_value.roles) ? _value.roles : [];
        return _head + ' -- ролей ' + _roles.length + ': ' + (_roles.join (', ') || '--') +
            ' | записано ' + (_value.at ? dbDumpDate (_value.at) : 'без даты');
    }
    if (_ns === 'banHistory')
    {
        const _ev = Array.isArray (_value.events) ? _value.events : [];
        const _cnt = _k => _ev.filter (_e => _e && _e.kind === _k).length;
        const _last = _ev.length ? _ev[_ev.length - 1] : null;
        return _head + ' -- событий ' + _ev.length + ': выходов ' + _cnt ('exit') +
            ', таймаутов ' + _cnt ('timeout') + ', банов ' + _cnt ('ban') + ', снятий ' + _cnt ('unban') +
            ' | последнее: ' + (_last && _last.at ? dbDumpDate (_last.at) + ' (' + _last.kind + ')' : '--');
    }
    if (_ns === 'membersBanTimeout')
    {
        const _until = Number (_value);
        if (!Number.isFinite (_until)) return _head + ' -- ' + clipText (JSON.stringify (_value), 200);
        return _head + ' -- до ' + dbDumpDate (_until) + ' (' +
            (_until > Date.now () ? 'осталось ' + dbDumpLeft (_until) : 'срок истёк') + ')';
    }
    if (_ns === 'musicState')
    {
        if (Array.isArray (_value.list))
        {
            const _list = _value.list;
            const _tr = _list.reduce ((s, _e) => s + Math.max (1, Number (_e && _e.n) || 1), 0);
            const _new = _list[0] || null;
            return _head + ' -- пачек ' + _list.length + ', треков ' + _tr +
                ' | последняя: ' + (_new
                    ? dbDumpDate (_new.at) + ' -- ' + clipText (String (_new.byName || 'без автора'), 40) +
                      ' (' + Math.max (1, Number (_new.n) || 1) + ' ' +
                      plural (Math.max (1, Number (_new.n) || 1), 'трек', 'трека', 'треков') + ')'
                    : '--') +
                ' | показывается в /history, переживает перезапуск';
        }
        if (!Array.isArray (_value.tracks))
            return _head + ' -- ' + (_value.left ? 'вышел по /leave' : 'сижу в канале ' + (_value.channelId || '--')) +
                ' (присутствие; очередь и позиция -- в отдельной записи queue)';
        const _tr = Array.isArray (_value.tracks) ? _value.tracks : [];
        const _cur = _value.current && _value.current.title ? _value.current.title : '';
        const _dur = [_value.current].concat (_tr).reduce
            ((s, t) => s + ((t && !t.isLive) ? Math.max (0, Number (t.duration) || 0) : 0), 0);
        return _head + ' -- в очереди ' + _tr.length +
            (_cur ? ', играет «' + clipText (String (_cur), 60) + '»' : ', играющего нет') +
            ' | канал ' + (_value.channelId || '--') +
            (Number (_value.elapsed) ? ', позиция ' + Math.floor (Number (_value.elapsed)) + ' сек' : '') +
            (_value.left ? ' | вышел по /leave' : '') +
            (_dur ? ' | всего звучания ~' + dbDumpDur (_dur) + ' (на диск целиком -- ~' +
                Math.max (1, Math.round (_dur / 64)) + ' МБ)' : '') +
            _qMsgTxt (_value.qMsg);
    }
    return _head + ' -- ' + clipText (JSON.stringify (_value), 300);
}

function dbDumpCli ()
{
    $cliOwnScreen ();
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) {  }
    if (!DatabaseSync)
    {
        console.log ('[dump] нужен Node 23+ (встроенный node:sqlite): запусти через node.cmd или портативный Node из папки бота');
        return;
    }
    const _fs = require ('fs');
    const _only = (process.argv.slice (2).filter (_a => !/^dump$/i.test (_a)).find (_a => /^\d{17,20}$/.test (_a)) || '');
    console.log ('[dump] режим: только чтение, базы не меняются, бот не запускается');
    console.log ('[dump] ключи шифрования из config.json: ' + (DB_KEYS.length
        ? 'есть (' + DB_KEYS.length + ': db_key' + (DB_KEYS.length > 1 ? ' + db_key_prev' : '') + ')'
        : 'НЕТ -- зашифрованные записи показать не смогу'));
    if (_only) console.log ('[dump] фильтр по id участника: ' + _only);
    const _servers = Object.keys (SERVERS).filter (_k => /^\d{17,20}$/.test (_k));
    if (!_servers.length)
    {
        console.log ('[dump] в config.json нет ни одного id сервера');
        return;
    }
    for (const _srv of _servers)
    {
        const _file = __dirname + '/' + _srv + '.sqlite';
        console.log ('');
        console.log ('[dump] === сервер ' + _srv +
            ((SERVERS[_srv] || {}).name ? ' («' + SERVERS[_srv].name + '»)' : '') + ' ===');
        if (!_fs.existsSync (_file))
        {
            console.log ('[dump] файла базы нет: ' + _file);
            continue;
        }
        let _db = null, _rows = [];
        try
        {
            _db = new DatabaseSync (_file, { readOnly: true });
            _rows = _db.prepare ('SELECT key, value FROM keyv').all ();
        }
        catch (e)
        {
            console.log ('[dump] не смог прочитать базу: ' + ((e && e.message) || e));
        }
        try { if (_db) _db.close (); } catch (e) {  }
        const _byNs = new Map ();
        let _plain = 0, _enc = 0, _bad = 0, _shown = 0;
        for (const _r of _rows)
        {
            const _raw = dbRawStr (_r.value);
            const _full = String (_r.key);
            const _cut = _full.indexOf (':');
            const _ns = _cut > 0 ? _full.slice (0, _cut) : '(без неймспейса)';
            const _k = _cut > 0 ? _full.slice (_cut + 1) : _full;
            let _json = null, _line = '';
            if (_raw.startsWith (DB_ENC_PREFIX))
            {
                _enc++;
                const _t = DB_KEYS.length ? dbDec (_raw) : null;
                if (_t === null)
                {
                    _bad++;
                    _line = '[' + _ns + '] ' + _k + ' -- зашифровано, ' + (DB_KEYS.length
                        ? 'но ни одним ключом из config.json не открывается'
                        : 'а db_key пуст -- показать нечего (данные целы, нужен прежний ключ)');
                }
                else
                {
                    try { _json = JSON.parse (_t); }
                    catch (e) { _line = '[' + _ns + '] ' + _k + ' -- расшифровалось, но это не JSON'; }
                }
            }
            else
            {
                _plain++;
                try { _json = JSON.parse (_raw); }
                catch (e) { _line = '[' + _ns + '] ' + _k + ' -- значение не JSON: ' + clipText (_raw, 120); }
            }
            if (!_line)
                _line = dbDumpFmt (_ns, _k, (_json && typeof _json === 'object' && 'value' in _json) ? _json.value : _json);
            if (_only && _k !== _only && !_k.includes (_only)) continue;
            if (!_byNs.has (_ns)) _byNs.set (_ns, []);
            _byNs.get (_ns).push (_line);
            _shown++;
        }
        console.log ('[dump] записей ' + _rows.length + ': открытых ' + _plain + ', зашифрованных ' + _enc +
            ', нечитаемых ' + _bad + (_only ? ' | по фильтру: ' + _shown + ' из ' + _rows.length : ''));
        const _order = ['memberRoles', 'banHistory', 'membersBanTimeout', 'musicState', 'channelsBusy'];
        const _nsKeys = [..._byNs.keys ()].sort ((a, b) =>
        {
            const _ia = _order.indexOf (a), _ib = _order.indexOf (b);
            return ((_ia < 0 ? 99 : _ia) - (_ib < 0 ? 99 : _ib)) || a.localeCompare (b);
        });
        if (!_nsKeys.length)
            console.log ('[dump] ' + (_only ? 'по этому id ничего не нашлось' : 'записей нет -- база пустая'));
        for (const _ns of _nsKeys)
        {
            const _list = _byNs.get (_ns);
            console.log ('[dump] --- ' + _ns + ' (' + _list.length + ') ---');
            for (const _line of _list.slice (0, 40)) console.log ('[dump] ' + _line);
            if (_list.length > 40)
                console.log ('[dump] ...и ещё ' + (_list.length - 40) + ' (задай id участника, чтобы посмотреть одного)');
        }
    }
}

if (process.argv.slice (2).some (_a => /^dump$/i.test (_a)))
{
    try { dbDumpCli (); }
    catch (e) { console.log ('[dump] ошибка: ' + ((e && e.message) || e)); }
    process.exit (0);
}

// Эти три числа нужны и боту, и консольному разбору, а консоль работает раньше остального кода,
// поэтому они объявлены здесь: ниже они уже были бы ещё не готовы.
const IP_TRY_TIMEOUT_MS = 2500;    // столько жду один адрес, дальше -- следующий
const IP_TRY_MAX = 3;              // столько адресов пробую по очереди при соединении
const DNS_FAIL_ASLEEP = 120000;    // столько не предлагаю адрес после сбоя по нему

function netCli ()       // разбор собранного: что знаем о сети и как это выглядит со стороны
{
    $cliOwnScreen ();
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) { }
    if (!DatabaseSync)
    {
        console.log ('[net] нужен Node 23+ (встроенный node:sqlite): запусти через node.cmd или портативный Node из папки бота');
        return;
    }
    const _fs = require ('fs');
    const _when = t => { try { return t ? new Date (t).toLocaleString ('ru-RU') : '--'; } catch (e) { return String (t); } };
    const _servers = Object.keys (SERVERS).filter (_k => /^\d{17,20}$/.test (_k));
    if (!_servers.length)
    {
        console.log ('[net] в config.json нет ни одного id сервера');
        return;
    }
    for (const _srv of _servers)
    {
        const _file = __dirname + '/' + _srv + '.sqlite';
        console.log ('');
        console.log ('[net] === что бот знает о сети (сервер ' + _srv +
            ((SERVERS[_srv] || {}).name ? ', «' + SERVERS[_srv].name + '»' : '') + ') ===');
        if (!_fs.existsSync (_file))
        {
            console.log ('[net] файла базы нет: ' + _file);
            continue;
        }
        let _db = null, _rows = [];
        try
        {
            _db = new DatabaseSync (_file, { readOnly: true });
            _rows = _db.prepare ('SELECT key, value FROM keyv').all ();
        }
        catch (e) { console.log ('[net] не смог прочитать базу: ' + ((e && e.message) || e)); }
        try { if (_db) _db.close (); } catch (e) { }
        const _get = name => dbPeekValue (_rows, name);
        const book = _get ('dnsbook:map') || {};
        const stats = _get ('dnsbook:stats') || {};
        const pools = _get ('netState:ip_map') || {};
        const rev = _get ('netState:ip_names') || {};
        const route = _get ('netState:route_memory') || null;
        const guess = _get ('netState:guess') || null;
        const gscore = _get ('netState:guess_score') || null;
        const boneMem = _get ('netState:bone') || null;
        const keys = Object.keys (book);
        const now = Date.now ();
        let ips = 0, signed = 0, agree = 0, oldNames = 0, oldIps = 0, asleep = 0, newest = 0, oldest = 0, newestName = '', oldestName = '';
        const many = [];
        for (const k of keys)
        {
            const rec = book[k] || {};
            const list = rec.ips || [];
            ips += list.length;
            many.push ([k, list.length]);
            const at = rec.at || 0;
            if (at > newest) { newest = at; newestName = k; }
            if (at && (!oldest || at < oldest)) { oldest = at; oldestName = k; }
            if (rec.old) oldNames++;
            for (const x of list)
            {
                if (x.ad) signed++;
                if ((Number (x.cnt) || 0) > 1) agree++;
                if (x.old) oldIps++;
                if (x.fail && (now - x.fail) < 120000) asleep++;
            }
        }
        console.log ('[net] книга: имён ' + keys.length + ', адресов ' + ips);
        console.log ('[net]   с проверенной подписью (DNSSEC): ' + signed + ' адр.; подтверждены несколькими справочниками: ' + agree);
        console.log ('[net]   помечено древними: имён ' + oldNames + ', адресов ' + oldIps + ' (хранятся и используются, но уходят в конец выбора)');
        console.log ('[net]   сейчас после сбоя отложены: ' + asleep + ' адр.');
        if (newestName) console.log ('[net]   свежайшее имя: ' + newestName + ' (' + _when (newest) + '); самое давнее: ' + (oldestName || '--') + ' (' + _when (oldest) + ')');
        many.sort ((a, b) => b[1] - a[1]);
        if (many.length) console.log ('[net]   больше всего адресов: ' + many.slice (0, 5).map (x => x[0] + ' -- ' + x[1]).join (', '));
        const srcs = Object.keys (stats).map (k => ({ n: k, ok: (stats[k] || {}).ok || 0, fail: (stats[k] || {}).fail || 0, ms: (stats[k] || {}).ms || 0 }))
            .sort ((a, b) => (b.ok - a.ok) || (a.ms - b.ms));
        if (srcs.length)
        {
            console.log ('[net] источники (успех/отказ, средняя скорость):');
            for (const s of srcs.slice (0, 8))
                console.log ('[net]   ' + s.n.padEnd (24) + s.ok + '/' + s.fail + (s.ms ? ', ' + Math.round (s.ms) + ' мс' : ''));
        }
        const pkeys = Object.keys (pools).filter (k => k.indexOf ('pool:') === 0);
        if (pkeys.length)
            console.log ('[net] копилки адресов: ' + pkeys.map (k => k.slice (5) + ' -- ' + Object.keys ((pools[k] || {}).ips || {}).length).join (', '));
        console.log ('[net] обрывы связи (счёт бота: когда пропало, сколько ждал, вернулся ли сам):');
        for (const _l of netVoiceLines (_get ('netState:voice')))
            console.log ('[net]   ' + _l);
        const ipKeys = Object.keys (rev);
        let multi = 0, namesTotal = 0;
        for (const ip of ipKeys)
        {
            const rec = rev[ip] || {};
            const list = rec.names ? Object.keys (rec.names) : (rec.name ? [rec.name] : []);
            namesTotal += list.length;
            if (list.length > 1) multi++;
        }
        console.log ('[net] обратная таблица: адресов ' + ipKeys.length + ', имён на них ' + namesTotal + ', адресов с несколькими именами ' + multi);
        if (route) console.log ('[net] память о сети: ' + (route.fingerprint || '--') + ' | вид: ' + (route.kind || '--') +
            (route.at ? ' | обновлено ' + _when (route.at) : ''));
        const hours = _get ('netState:hours') || {};
        const hKeys = Object.keys (hours).sort ();
        if (hKeys.length)
        {
            let hIps = 0, hOk = 0, hFail = 0;
            for (const k of hKeys) { hIps += (hours[k] || {}).ips || 0; hOk += (hours[k] || {}).ok || 0; hFail += (hours[k] || {}).fail || 0; }
            console.log ('[net] измерено часов: ' + hKeys.length + ' (с ' + hKeys[0] + ' по ' + hKeys[hKeys.length - 1] +
                '), ответов ' + hOk + ', отказов ' + hFail + ', новых адресов ' + hIps);
        }
        console.log ('[net] объединённая картина:');
        for (const l of netMergedLines (book, pools, rev)) console.log ('[net]   ' + l);
        console.log ('[net] разбор и выводы:');
        for (const l of netAnalyticsLines (book, hours)) console.log ('[net]   ' + l);
        console.log ('[net] графики:');
        for (const l of netChartsLines (hours, 3)) console.log ('[net]   ' + l);
        console.log ('[net] прогноз (и сверка прежних):');
        for (const l of netForecastLines (hours, guess, gscore)) console.log ('[net]   ' + l);
        if (guess && Array.isArray (guess.checks) && guess.checks.length)
            for (const l of guess.checks.slice (-3)) console.log ('[net]   сверка: ' + l);
        const glog = _get ('netState:guess_log') || null;
        if (glog && glog.length) console.log ('[net]   в архиве сверок: ' + glog.length + ' (хранятся все: старые переехали туда, а не пропали)');
        console.log ('[net] за что зацепиться:');
        for (const l of netBonesLines (book, hours, rev)) console.log ('[net]   ' + l);
        const _bv = netBoneVerdict (boneMem, book, hours);
        if (_bv) console.log ('[net]   ' + _bv);
        else if (boneMem && boneMem.text) console.log ('[net]   прежняя зацепка (' + (boneMem.kind || '--') + '): ' + boneMem.text);
        console.log ('[net] связки адресов (что с чем связано):');
        for (const l of netLinksLines (book, pools, rev, 5)) console.log ('[net]   ' + l);
        console.log ('[net] как этим пользоваться:');
        for (const l of netPlanLines (book, pools, rev)) console.log ('[net]   ' + l);
        if (route && route.wins) console.log ('[net]   маршрут «' + (route.kind || '--') + '» уже качал музыку: ' + route.wins + ' трек(ов)');
    }
    console.log ('');
    console.log ('[net] сырые записи целиком -- `node . dump`; живое состояние -- в логе при запуске.');
}

if (process.argv.slice (2).some (_a => /^net$/i.test (_a)))
{
    try { netCli (); }
    catch (e) { console.log ('[net] ошибка: ' + ((e && e.message) || e)); }
    process.exit (0);
}

function filesCli ()
{
    $cliOwnScreen ();
    const _fs = require ('fs'), _path = require ('path');
    const _dir = __dirname;
    const _d = stamp => (stamp ? new Date (stamp).toLocaleString () : '?');
    const _kb = n => (n >= 1024 * 1024 ? (n / (1024 * 1024)).toFixed (1) + ' МБ'
        : (n >= 1024 ? Math.round (n / 1024) + ' КБ' : n + ' Б'));
    const _what = _name =>
    {
        if (_name === 'index.js') return ['сам бот -- весь код: сообщения, музыка, модерация, база', 'НЕТ'];
        if (_name === 'README.md') return ['инструкция: запуск, команды, хранение данных', 'НЕТ'];
        if (_name === 'PRIVACY.md') return ['политика конфиденциальности: что и зачем бот хранит (собрана командой `node . privacy`; ЛИЧНАЯ для этого бота -- в репозиторий не попадает)', 'НЕТ -- её читают люди по ссылке из privacy_url, а собрать заново -- `node . privacy`'];
        if (_name === 'config.json') return ['ТВОИ настройки: токен, ключ базы (db_key), каналы, роли (в git не попадает)', 'НЕТ -- потеряешь db_key, и зашифрованные записи не прочитаются'];
        if (_name === 'config.example.json') return ['образец конфига с комментариями (для тех, кто ставит бота с нуля)', 'МОЖНО -- вернётся из репозитория'];
        if (_name === 'config.minimal.json') return ['самый короткий конфиг: только обязательные поля (token и id сервера)', 'МОЖНО -- вернётся из репозитория'];
        if (_name === 'privacy.template.md') return ['шаблон политики: из него команда `node . privacy` собирает PRIVACY.md', 'НЕТ -- без него политику не пересобрать'];
        if (_name === 'package.json' || _name === 'package-lock.json') return ['список зависимостей для npm', 'МОЖНО -- npm i восстановит'];
        if (/^node\.(cmd|exe|bat)$/i.test (_name)) return ['«шим»/портативный Node: благодаря ему привычное `node .` запускает бота', 'НЕТ -- сломается запуск'];
        if (/^console\.bat$/i.test (_name)) return ['личная мелочь владельца (в git не попадает)', 'можно, если не нужна'];
        if (_name === '.gitignore' || _name === '.gitattributes') return ['что не попадает в git (токены, базы, точки)', 'НЕТ'];
        if (/^\d{17,20}\.sqlite$/i.test (_name)) return ['ВСЕ ДАННЫЕ БОТА: роли для возврата, история наказаний, таймауты, очередь музыки (зашифрованы)', 'НЕТ'];
        if (/\.backup-.*\.sqlite$/i.test (_name)) return ['копия базы с датой в имени (сделана при старте, по таймеру backup_minutes или командой `node . backup`)', 'можно (самые старые уходят сами по backup_keep)'];
        if (/\.broken\.sqlite$/i.test (_name)) return ['побитая база, отложенная командой restore', 'можно, когда убедишься, что не нужна'];
        if (/\.unkey\.sqlite$/i.test (_name)) return ['копия базы ОТКРЫТЫМ ТЕКСТОМ (красная кнопка `node . unkey`)', 'ДА, и прямо сейчас'];
        if (/\.check-.*\.sqlite$/i.test (_name)) return ['контрольная точка базы (`node . checkpoint`); бот их не удаляет', 'можно, когда сам решишь'];
        if (/\.sqlite-(journal|wal|shm)$/i.test (_name)) return ['хвост незакрытой транзакции SQLite', 'можно, когда бот выключен'];
        if (_name === 'tools') return ['инструменты рядом с ботом: обход блокировки (`obhod.cmd` и `zapret-pick.ps1`) и его журнал в `zapret-work`',
            'НЕТ -- без них бот не сможет ни подбирать обход, ни сказать о нём правду (`node . obhod`)'];
        if (_name === 'music_cache') return ['кэш музыки (MUSIC.cache): скачанные треки и запас вперёд -- бот сам догружает сюда очередь, '
            + 'пока играет музыка. Это НЕ данные бота -- просто музыка',
            'можно ВСЁ -- бот скачает заново (отчёт, в том числе чего ещё нет в запасе, и очистка: `node . cache`); ' +
            'но недокачанное ему полезно: если позиция трека внутри записанного куска, продолжение идёт с диска сразу'];
        if (/^intents-.*\.md$/i.test (_name)) return ['заявка/шпаргалка по интентам (данные реального сервера -- в git не попадает)', 'можно (но заявка ещё может пригодиться)'];
        if (/\.log$/i.test (_name)) return ['старый лог', 'можно'];
        if (/^crash-.*\.txt$/i.test (_name)) return ['отчёт о сбое (бот сам кладёт его рядом с логом при падении: причина, стек, последние строки лога)',
            'можно, когда разберёшься со сбоем'];
        if (/^node-v?\d/i.test (_name)) return ['портативный Node: именно на нём запускается бот', 'НЕТ -- бот не запустится'];
        if (_name === '.freebuff') return ['служебная папка инструмента разработки (Freebuff) -- к боту не относится', 'можно, если инструментом не пользуешься'];
        return ['не знаю такой файл -- скорее всего твой личный', 'решай сам'];
    };
    let _list = [];
    try { _list = _fs.readdirSync (_dir, {withFileTypes: true}); }
    catch (e) { console.log ('[files] не смог прочитать папку: ' + String ((e && e.message) || e)); return 1; }
    console.log ('[files] папка бота: ' + _dir);
    console.log ('[files] только чтение: ничего не создаю, не меняю и не удаляю');
    console.log ('');
    let _files = 0, _dirs = 0, _bytes = 0;
    const _lines = [];
    for (const _e of _list.sort ((a, b) => a.name.localeCompare (b.name)))
    {
        const _p = _path.join (_dir, _e.name);
        let _st = null;
        try { _st = _fs.statSync (_p); } catch (err) { continue; }
        let _sizeTxt = '';
        if (_e.isDirectory ())
        {
            _dirs++;
            let _n = 0;
            try { _n = _fs.readdirSync (_p).length; } catch (err) { _n = 0; }
            let _dirBytes = 0;
            if (_e.name === 'music_cache')
                try { for (const _c of _fs.readdirSync (_p)) _dirBytes += _fs.statSync (_path.join (_p, _c)).size; } catch (err) {}
            _sizeTxt = 'папка, ' + _n + ' элем.' + (_dirBytes ? ', ' + _kb (_dirBytes) : '');
        }
        else
        {
            _files++; _bytes += _st.size;
            _sizeTxt = _kb (_st.size);
        }
        const _info = _e.name === 'node_modules' ? ['скачанные зависимости npm', 'МОЖНО -- npm i вернёт, и в git они не попадают']
            : _e.name === 'images' ? ['старые картинки из истории бота (код их не использует)', 'можно (оставлены как память)']
            : _e.name === '.git' ? ['история git (коммиты): отсюда можно откатиться', 'НЕТ']
            : _e.name === 'logs' ? ['ЖИВОЙ ЛОГ бота (' + LOG_BASE + '-ГГГГ-ММ.log -- файл на месяц, имя из PREFIX; рядом crash-*.txt -- отчёты о сбоях, если они были)',
                'можно -- файлы создадутся заново; старые месяцы уходят по log_keep_months']
            : (_e.isDirectory () ? _what (_e.name) : _what (_e.name));
        _lines.push ('  ' + _e.name.padEnd (34).slice (0, 34) + ' ' + _sizeTxt.padStart (14) + '  ' +
            _d (_st.mtimeMs).padEnd (21) + '  ' + _info[0] + '\n    удалять: ' + _info[1]);
    }
    for (const _l of _lines) console.log (_l);
    console.log ('');
    console.log ('[files] всего: файлов ' + _files + ' (' + _kb (_bytes) + '), папок ' + _dirs +
        ' (без учёта содержимого node_modules/.git)');
    console.log ('[files] если чего-то тут нет -- так и должно быть: лишнего версия не создаёт');
    console.log ('');
    console.log ('[files] консольные команды (набираются В ЭТОЙ ПАПКЕ; в справке бота их нет -- это сервис):');
    console.log ('  node .                        -- запустить бота (это окно = живой лог)');
    console.log ('  node . keygen                 -- напечатать НОВЫЙ ключ шифрования (вставить в config.json -> db_key)');
    console.log ('  node . dump                   -- что лежит в базе, по серверам (только чтение)');
    console.log ('  node . dump 123456789012345678 -- то же, но по одному человеку (фильтр по id)');
    console.log ('  node . backup                 -- сделать копию базы с датой в имени прямо сейчас');
    console.log ('  node . checkpoint             -- контрольная точка базы (файл с датой в имени; бот их не удаляет)');
    console.log ('  node . checkpoint before-cleanup -- то же, но с меткой (её видно в имени файла)');
    console.log ('  node . backups                -- что есть: база, копии с датой и все точки');
    console.log ('  node . restore                -- вернуть базу из самой свежей копии');
    console.log ('  node . restore before-cleanup -- вернуть из копии или точки по метке (часть имени или дата)');
    console.log ('  node . clearstatus 123456789012345678 -- снять свою строку из шапки канала (id канала)');
    console.log ('  node . privacy                -- пересобрать PRIVACY.md из шаблона (имена спросит у Discord)');
    console.log ('  node . privacy --offline      -- то же, но без обращения к сети');
    console.log ('  node . config                 -- чем бот РЕАЛЬНО работает: все ключи, значения и откуда взяты');
    console.log ('  node . files                  -- этот отчёт');
    console.log ('  node . cache                  -- кэш музыки: что скачано, сколько занимает и чего ещё не хватает в запасе');
    console.log ('  node . cache --clear          -- стереть кэш целиком (бот скачает заново)');
    console.log ('  node . cache --prune          -- убрать из кэша самое старое по лимиту MUSIC.cache_max_mb');
    console.log ('  node . obhod                  -- обход блокировки: что сейчас и что можно сделать (--engine, --pick, --stop);');
    console.log ('                                  смена стратегии -- один запрос прав Windows, в автозапуск ничего не ставится');
    return 0;
}

if (process.argv.slice (2).some (_a => /^files$/i.test (_a)))
{
    let _code = 1;
    try { _code = filesCli (); } catch (e) { console.log ('[files] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}

function privacyRetention (days, ru)
{
    const _d = Number (days);
    if (!isFinite (_d) || _d <= 0) return ru ? 'бессрочно' : 'indefinitely';
    if (!ru) return _d + ' day' + (_d === 1 ? '' : 's');
    const _t = _d % 10, _h = _d % 100;
    const _w = (_t === 1 && _h !== 11) ? 'день'
        : (_t >= 2 && _t <= 4 && (_h < 12 || _h > 14)) ? 'дня' : 'дней';
    return _d + ' ' + _w;
}
function privacyDiscordNames ()
{
    if (!String (TOKEN || '').trim ()) return null;
    const _script = [
        "const H = { Authorization: 'Bot ' + (process.env.PB_TOKEN || '') };",
        "const g = (p) => fetch ('https://discord.com/api/v10' + p, { headers: H })",
        "    .then (r => r.ok ? r.json () : null).catch (() => null);",
        "(async () => {",
        "    const app = await g ('/applications/@me');",
        "    const bot = await g ('/users/@me');",
        "    const own = process.env.PB_OWNER ? await g ('/users/' + process.env.PB_OWNER) : null;",
        "    process.stdout.write (JSON.stringify ({ app: (app && app.name) || null,",
        "        bot: (bot && bot.username) || null, owner: (own && own.username) || null }));",
        "}) ();"
    ].join ('\n');
    try
    {
        const _env = Object.assign ({}, process.env,
            { PB_TOKEN: String (TOKEN), PB_OWNER: String (OWNER || '') });
        const _out = require ('child_process').execFileSync (process.execPath, ['-e', _script],
            { timeout: 9000, stdio: ['ignore', 'pipe', 'ignore'], env: _env }).toString ();
        return JSON.parse (_out);
    }
    catch (e) { return null; }
}
function privacyCli (_check, _offline)
{
    $cliOwnScreen ();
    const _fs = require ('fs'), _path = require ('path');
    const _tplFile = _path.join (__dirname, 'privacy.template.md');
    const _outFile = _path.join (__dirname, 'PRIVACY.md');
    if (!_fs.existsSync (_tplFile))
    {
        console.log ('[privacy] нет файла privacy.template.md -- это шаблон политики, без него собирать нечего');
        return 1;
    }
    const _tpl = _fs.readFileSync (_tplFile, 'utf8');
    const _def = {};
    const _head = /^\s*<!--([\s\S]*?)-->/.exec (_tpl);
    if (_head) for (const _m of _head[1].matchAll (/^\s*([A-Z][A-Z_0-9]*)\s*=\s*(.+?)\s*$/gm)) _def[_m[1]] = _m[2];
    const _markM = /const TAG_DEFAULT = '([^']+)';/.exec (_fs.readFileSync (_path.join (__dirname, 'index.js'), 'utf8'));
    const _mark = _markM ? _markM[1] : (_def.MARK || '🔑');
    const _srv = Object.keys (SERVERS).filter (_k => /^\d{17,20}$/.test (_k) && serverOn (_k));
    const _names = _srv.map (_k => SERVERS[_k].name || ('сервер ' + _k));
    const _timeouts = _srv.map (_k => Number (SERVERS[_k].onLeaveBanTimeout) || 0);
    const _timeout = _timeouts.length ? Math.max.apply (null, _timeouts) : 0;
    const _rolesOff = _srv.length > 0 && _srv.every (_k => SERVERS[_k].save_roles === false);
    const _days = _srv.map (_k => Number (SERVERS[_k].save_roles_days) || 0);
    const _histDays = _srv.map (_k => Number (SERVERS[_k].bans_history_days) || 0);
    const _pick = (_a) => _a.every (_v => !_v) ? 0 : Math.max.apply (null, _a);
    console.log ('[privacy] шаблон: privacy.template.md, значок ключа из кода: ' + _mark);
    console.log ('[privacy] из config.json: включённых экземпляров ' + _srv.length + ': ' + (_names.join (', ') || '--') +
        ', таймаут за выход: ' + (_timeout ? _timeout + ' мин' : 'выключен') +
        ', роли: ' + (_rolesOff ? 'НЕ хранятся' : privacyRetention (_pick (_days), true)) +
        ', история: ' + privacyRetention (_pick (_histDays), true));
    const _off = Object.keys (SERVERS).filter (_k => /^\d{17,20}$/.test (_k) && !serverOn (_k));
    if (_off.length)
        console.log ('[privacy] в политику не попали выключенные (' + _off.length + '): ' +
            _off.map (_k => (_k + (SERVERS[_k] && SERVERS[_k].name ? ' («' + SERVERS[_k].name + '»)' : ''))).join (', ') +
            ' -- бот их не обслуживает (allow: false или ключа нет)');
    let _dc = null;
    if (_offline) console.log ('[privacy] --offline: к Discord не обращаюсь, имена беру из шаблона');
    else
    {
        _dc = privacyDiscordNames ();
        if (_dc) console.log ('[privacy] из Discord: приложение «' + (_dc.app || '?') + '», бот ' +
            (_dc.bot || '?') + ', владелец ' + (_dc.owner || '?') + (OWNER ? '' : ' (OWNER не задан в config.json)'));
        else console.log ('[privacy] Discord не ответил (нет сети?): имена беру из шаблона');
    }
    const _facts = Object.assign ({}, _def, {
        DATE: new Date ().toLocaleDateString ('ru-RU'),
        MARK: _mark,
        OWNER_ID: /^\d{17,20}$/.test (String (OWNER || '')) ? String (OWNER) : (_def.OWNER_ID || ''),
        SERVERS: _names.join (', '),
        SERVERS_COUNT: String (_srv.length),
        TIMEOUT_MIN: String (_timeout || _def.TIMEOUT_MIN || 20),
        ROLES_RETENTION_EN: privacyRetention (_pick (_days), false),
        ROLES_RETENTION_RU: privacyRetention (_pick (_days), true),
        HISTORY_RETENTION_EN: privacyRetention (_pick (_histDays), false),
        HISTORY_RETENTION_RU: privacyRetention (_pick (_histDays), true),
        FORGET_CMD: '/forget user:@кто'
    });
    if (_dc)
    {
        if (_dc.app) _facts.APP = _dc.app;
        if (_dc.bot) _facts.BOT_NICK = _dc.bot;
        if (_dc.owner) _facts.OWNER_NICK = _dc.owner;
    }
    let _text = _tpl.replace (/\{\{([A-Z_0-9]+)\}\}/g, (_all, _n) => (_n in _facts ? _facts[_n] : _all));
    _text = _text.replace (/^\s*<!--[\s\S]*?-->\s*/, '');
    _text = _text.replace (/\r\n/g, '\n');
    const _left = Array.from (new Set ((_text.match (/\{\{[^}]+\}\}/g) || [])));
    if (_left.length)
    {
        console.log ('[privacy] в шаблоне есть подстановки без значения: ' + _left.join (', '));
        console.log ('[privacy] ничего не записываю: допиши их в шапку шаблона (строки вида «ИМЯ = значение»)');
        return 1;
    }
    const _old = _fs.existsSync (_outFile) ? _fs.readFileSync (_outFile, 'utf8').replace (/\r\n/g, '\n') : '';
    if (_check)
    {
        const _noDate = _s => _s.replace (/^_Last updated: .*_$/m, '_Last updated: <дата>_');
        const _dateIn = _s => { const _m = /^_Last updated: (.*)_$/m.exec (_s); return _m ? _m[1] : ''; };
        if (_noDate (_old) === _noDate (_text))
        {
            const _dOld = _dateIn (_old), _dNew = _dateIn (_text);
            console.log (_dOld === _dNew
                ? '[privacy] PRIVACY.md совпадает с шаблоном -- обновлять нечего'
                : '[privacy] PRIVACY.md совпадает с шаблоном ПО ТЕКСТУ; отличается только дата в шапке ' +
                  '(в файле ' + (_dOld || '--') + ', сейчас ' + (_dNew || '--') + ') -- обновить при желании: `node . privacy`');
            return 0;
        }
        console.log ('[privacy] PRIVACY.md ОТЛИЧАЕТСЯ от шаблона (' + Buffer.byteLength (_old) + ' байт -> ' +
            Buffer.byteLength (_text) + '): пересобрать -- `node . privacy`');
        const _lo = _noDate (_old).split ('\n'), _ln = _noDate (_text).split ('\n');
        let _shown = 0;
        for (let _i = 0; _i < Math.max (_lo.length, _ln.length) && _shown < 3; _i++)
        {
            if (_lo[_i] === _ln[_i]) continue;
            _shown++;
            console.log ('[privacy]   строка ' + (_i + 1) + ':');
            console.log ('[privacy]     в файле:  ' + String (_lo[_i] === undefined ? '-- строки нет' : _lo[_i]).slice (0, 120));
            console.log ('[privacy]     шаблон:   ' + String (_ln[_i] === undefined ? '-- строки нет' : _ln[_i]).slice (0, 120));
        }
        if (_shown === 3) console.log ('[privacy]   ...и ещё различия -- смотри `node . privacy` целиком');
        return 1;
    }
    _fs.writeFileSync (_outFile, _text);
    console.log ('[privacy] PRIVACY.md собран: ' + Buffer.byteLength (_text) + ' байт (было ' +
        Buffer.byteLength (_old) + ')');
    if (_rolesOff) console.log ('[privacy] ВНИМАНИЕ: роли не сохраняются ни на одном сервере, ' +
        'а в тексте шаблона они описаны -- поправь privacy.template.md');
    if (_srv.length && !_timeout) console.log ('[privacy] ВНИМАНИЕ: таймаут за выход выключен ' +
        '(onLeaveBanTimeout: 0 у всех рабочих серверов), а в тексте шаблона он описан -- ' +
        'поправь privacy.template.md');
    console.log ('[privacy] если политика выложена по ссылке (privacy_url), обнови и ту копию');
    return 0;
}

if (process.argv.slice (2).some (_a => /^privacy$/i.test (_a)))
{
    let _code = 1;
    try { _code = privacyCli (process.argv.includes ('--check'), process.argv.includes ('--offline')); }
    catch (e) { console.log ('[privacy] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}

function dbUnkeyCli (_arg)
{
    $cliOwnScreen ();
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) {  }
    if (!DatabaseSync)
    {
        console.log ('[unkey] нужен Node 23+ (встроенный node:sqlite): запускай через node.cmd или портативный Node из папки бота');
        return 1;
    }
    const _fs = require ('fs'), _path = require ('path');
    const _a = String (_arg === undefined || _arg === null ? '' : _arg).trim ();
    let _src = '';
    if (/^\d{17,20}$/.test (_a)) _src = __dirname + '/' + _a + '.sqlite';
    else if (_a) _src = _path.isAbsolute (_a) ? _a : (__dirname + '/' + _a);
    if (!_src)
    {
        console.log ('[unkey] укажи id сервера или путь к файлу базы, например: node . unkey 123456789012345678');
        return 2;
    }
    if (!_fs.existsSync (_src))
    {
        console.log ('[unkey] файла нет: ' + _src);
        return 2;
    }
    const _dst = _src.replace (/\.sqlite$/i, '') + '.unkey.sqlite';
    if (!DB_KEYS.length)
    {
        console.log ('[unkey] в config.json нет db_key -- расшифровывать нечего (записи и так открыты либо недоступны)');
        return 1;
    }
    let _rows = [], _db = null;
    try
    {
        _db = new DatabaseSync (_src, {readOnly: true});
        _rows = _db.prepare ('SELECT key, value FROM keyv').all ();
    }
    catch (e)
    {
        console.log ('[unkey] не смог прочитать базу: ' + String ((e && e.message) || e));
        return 1;
    }
    try { if (_db) _db.close (); } catch (e) {  }
    const _fix = [], _badKeys = [];
    let _plain = 0;
    for (const _r of _rows)
    {
        const _raw = dbRawStr (_r.value);
        if (!_raw.startsWith (DB_ENC_PREFIX)) { _plain++; continue; }
        const _t = dbDec (_raw);
        if (_t === null) { _badKeys.push (String (_r.key)); continue; }
        _fix.push ([String (_r.key), _t]);
    }
    console.log ('[unkey] база: ' + _src);
    console.log ('[unkey] записей ' + _rows.length + ': зашифрованных ' + _fix.length + ', и так открытых ' + _plain +
        (_badKeys.length ? ', НЕ открылись (' + _badKeys.length + ')' : ''));
    let _out = null, _wrote = 0;
    try
    {
        try { if (_fs.existsSync (_dst)) _fs.unlinkSync (_dst); } catch (e) {  }
        const _ro = new DatabaseSync (_src, {readOnly: true});
        try
        {
            _ro.exec ("VACUUM INTO '" + String (_dst).replace (/'/g, "''") + "'");
        }
        catch (e2)
        {
            try { _ro.close (); } catch (e3) {  }
            _fs.copyFileSync (_src, _dst);
        }
        try { _ro.close (); } catch (e2) {  }
        _out = new DatabaseSync (_dst);
        const _upd = _out.prepare ('UPDATE keyv SET value = ? WHERE key = ?');
        for (const [_k, _v] of _fix) { _upd.run (_v, _k); _wrote++; }
    }
    catch (e)
    {
        console.log ('[unkey] не удалось записать копию: ' + String ((e && e.message) || e));
        try { if (_out) _out.close (); } catch (e2) {  }
        return 1;
    }
    try { if (_out) _out.close (); } catch (e) {  }
    let _left = 0;
    let _chk = null;
    try
    {
        _chk = new DatabaseSync (_dst, {readOnly: true});
        for (const _r of _chk.prepare ('SELECT value FROM keyv').all ())
            if (dbRawStr (_r.value).startsWith (DB_ENC_PREFIX)) _left++;
    }
    catch (e) {  }
    try { if (_chk) _chk.close (); } catch (e) {  }
    console.log ('[unkey] копия записана: ' + _dst + ' (расшифровано ' + _wrote + ')');
    console.log ('[unkey] проверка чтением: ' + (_left
        ? 'остались зашифрованные (' + _left + ') -- их не открыл ни один ключ из config.json'
        : 'открытого текста -- всё, что можно было, расшифровано'));
    if (_badKeys.length)
        console.log ('[unkey] не открылись ключи: ' + _badKeys.slice (0, 10).join (', ') +
            (_badKeys.length > 10 ? ' и ещё ' + (_badKeys.length - 10) : ''));
    console.log ('[unkey] [!] ФАЙЛ ОТКРЫТЫМ ТЕКСТОМ. Посмотрел -- УДАЛИ его: ' + _dst);
    return 0;
}

if (process.argv.slice (2).some (_a => /^unkey$/i.test (_a)))
{
    let _code = 1;
    try { _code = dbUnkeyCli (dbArgAfter ('unkey')); }
    catch (e) { console.log ('[unkey] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}

const USE_MESSAGE_CONTENT = MESSAGE_CONTENT !== false;

const USE_GUILD_MEMBERS = GUILD_MEMBERS !== false;

const OWNER_HOSTER = /^\d{17,20}$/.test (String (OWNER || '')) ? String (OWNER) : '';
const STARTUP_DMS = (Array.isArray (STARTUP_DM) ? STARTUP_DM
        : (STARTUP_DM === undefined || STARTUP_DM === null ? [] : [STARTUP_DM]))
    .map (_u => String (_u === undefined || _u === null ? '' : _u).trim ())
    .filter (_u => /^\d{17,20}$/.test (_u));

const PRIVACY_URL = /^https?:\/\/\S+$/i.test (String (privacy_url || '').trim ())
    ? String (privacy_url).trim () : '';

const SHOW_PRIVACY_URL = show_privacy_url !== false;
function showPrivacyUrl (server)
{
    const s = SERVERS[server] || {};
    return (s.show_privacy_url === undefined) ? SHOW_PRIVACY_URL : (s.show_privacy_url !== false);
}
function privacyUrlOf (server) { return (PRIVACY_URL && showPrivacyUrl (server)) ? PRIVACY_URL : ''; }

function isBotOwner (_id) { return !!OWNER_HOSTER && String (_id) === OWNER_HOSTER; }

function contactsText (server)
{
    const s = SERVERS[server] || {};
    let list = [];
    const hoster = (s.show_owner_hoster === false) ? '' : OWNER_HOSTER;
    const owner  = (s.show_owner_server === false)
        ? ''
        : (/^\d{17,20}$/.test (String (s.owner_server || '')) ? String (s.owner_server) : '');
    if (hoster) list.push (u (hoster) + ' (хостинг бота)');
    if (owner && owner !== hoster) list.push (u (owner) + ' (владелец сервера)');
    return list.length ? list.join (', ') : 'администрации сервера';
}

const STARTUP_DM_TEXT =
    '**🐼 Что умеет бот и как этим пользоваться**\n' +
    '\n' +
    '🎧 **Слушать музыку**\n' +
    'Заходи в голосовой канал, где сидит бот, -- и слушай. Включает и добавляет музыку тот, у кого есть роль **DJ** (её выдают администраторы и модеры).\n' +
    '`/play` ссылка или запрос -- поставить трек, плейлист или прямой эфир\n' +
    '`/queue` -- что играет сейчас и что дальше: кто что поставил и сколько ещё ждать (сообщение обновляется само, пока музыка играет)\n' +
    '`/nowplaying` -- коротко про текущий трек: позиция, кто поставил, что дальше\n' +
    '`/history` -- кто и когда ставил музыку: последние добавления (треки, эфиры, плейлисты)\n' +
    '`/health` -- здорова ли связь: сколько было обрывов голоса и сети, вернулся ли бот сам и каким путём сейчас идёт звук (у владельца есть кнопка «Проверить голос по-настоящему»)\n' +
    'Если в канале никого, музыка встаёт на паузу и продолжается, когда кто-то зашёл: бот помнит и трек, и место в нём -- перезапуск и обрыв связи их не сбрасывают.\n' +
    '\n' +
    '🔑 **Свой голосовой канал**\n' +
    'Создал свой канал -- ты его владелец: бот выдаёт права и ставит ключ в ник (по умолчанию 🔑). Ключ = права в этом канале есть; у админов и модеров ключа нет -- у них права и так.\n' +
    '\n' +
    '🛡️ **Что бот делает сам**\n' +
    '• мут и глухота действуют только в том канале, где выданы: в других говорить можно, а вернёшься -- ограничение на месте\n' +
    '• замучен несправедливо -- зайди в общий канал 🆘: он создаст для тебя отдельный канал, где ограничение снимается и ты сам можешь говорить\n' +
    '• вышел с сервера -- таймаут (в этом конфиге 20 мин); вернёшься раньше срока -- бан до его конца\n' +
    '• роли не теряются: вышел и вернулся -- бот вернёт их обратно\n' +
    '\n' +
    '🙋 **Про тебя**\n' +
    '`/welcome` -- посмотреть, какое приветствие видят новички\n' +
    '`/mydata` -- что бот о тебе помнит и как это удалить (видно только тебе)\n' +
    'Остальные команды видны в Discord: набери `/` -- там подсказки (часть из них -- для админов, модеров и роли DJ).\n' +
    '\n' +
    'Не работает или непонятно -- напиши администрации.\n' +
    '\n' +
    '🖥️ **Если бот выключен** -- напиши ';

function helpText (server)
{
    const _purl = privacyUrlOf (server);
    return STARTUP_DM_TEXT + contactsText (server) + '.' +
        (_purl ? '\n\n📄 **Что бот хранит и как это удалить:** ' + _purl : '');
}

const HELP_EMBED_MAX = 3900;
function sliceByLines (text, max)
{
    const out = [];
    let cur = '';
    for (const line of text.split ('\n'))
    {
        if (cur && cur.length + line.length + 1 > max) { out.push (cur); cur = ''; }
        cur += (cur ? '\n' : '') + line;
    }
    if (cur) out.push (cur);
    return out;
}

const HELP_MSG_MAX = 5900;
function helpMessages (server)
{
    const s = SERVERS[server];
    const first = server && s ? server : Object.keys (SERVERS)[0];
    const msgs = sliceByLines (helpText (first), HELP_MSG_MAX)
        .map (chunk => sliceByLines (chunk, HELP_EMBED_MAX)
            .map (desc => ({ color: 0x00CCFF, description: desc })));
    if (!msgs.length) return [[{ color: 0x00CCFF, description: helpText (first) }]];
    msgs[0][0].title = '🐼 PANDAMIA Bot: инструкция';
    const tail = msgs[msgs.length - 1];
    tail[tail.length - 1].footer =
        { text: (first && SERVERS[first]) ? SERVERS[first].name : 'PANDAMIA Bot' };
    tail[tail.length - 1].timestamp = dt();
    return msgs;
}

function helpEmbeds (server) { return helpMessages (server).flat (); }

async function sendHelpDm (user, server)
{
    const msgs = helpMessages (server);
    for (const embeds of msgs) await sendFit (user, { embeds });
    return msgs.length;
}

function helpEmbed (server) { return helpEmbeds (server)[0]; }

const
{
    Client,
    GatewayIntentBits,
    IntentsBitField,
    Partials,
    ChannelType,
    PermissionsBitField,
    Collection,
    AuditLogEvent,
    ActivityType,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    LabelBuilder,
} = require ('discord.js');

const INTENTS =
[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
];
if (USE_GUILD_MEMBERS)
    INTENTS.push (GatewayIntentBits.GuildMembers);
if (USE_MESSAGE_CONTENT)
    INTENTS.push (GatewayIntentBits.MessageContent);

const client = new Client
(
    {
        intents: INTENTS,
        partials:
        [
            Partials.Channel,
        ],
    }
);

const GATEWAY_RELOGIN_MS = 90 * 1000;
const WS_STATUS = { 0: 'готов', 1: 'соединяюсь', 2: 'переподключаюсь', 3: 'idle', 4: 'почти готов', 5: 'отключён', 6: 'жду гильдии', 7: 'возобновляю сессию' };
let $bootOnce = false;
let $pollBooted = false;
let $gwDown = null;
let $gwDrops = 0;
let $gwRelogins = 0;
let $gwReloginning = false;

function gwWhen (ms) { try { return d (ms); } catch (e) { return new Date (ms).toLocaleString (); } }

function gwDropText (logged, drops, id, code, reason)
{
    if (logged) return null;
    const tail = (drops > 1 ? ' (за этот запуск уже ' + drops + ' ' + plural (drops, 'раз', 'раза', 'раз') + ')' : '') +
        ' -- музыка и очередь это не затрагивает';
    if (code)
        return '[gw] связь с Discord потеряна (код ' + code +
            ((reason && String (reason).trim ()) ? ' ' + oneLine (reason, 80) : '') + ')' + tail +
            '; сам discord.js её уже не поднимет -- сторож перезапустит подключение (до ' +
            Math.round (GATEWAY_RELOGIN_MS / 1000) + ' с)';
    return '[gw] связь с Discord оборвалась (шард ' + id + ') -- переподключаюсь сам' + tail;
}
function gwUpText (gapMs, how)
{
    if (!gapMs) return null;
    return '[gw] связь с Discord восстановлена (были без связи ' + fmtAgo (gapMs) + ')' +
        (how ? ', ' + how : '') +
        ' -- если это повторяется часто, проверь интернет (бот поднял связь сам)';
}
function gwOn (kind, info)
{
    info = info || {};
    const now = Date.now ();
    if (kind === 'drop' || kind === 'hard')
    {
        const logged = ($gwDown !== null);
        if (!logged) { $gwDown = now; $gwDrops++; }
        const text = gwDropText (logged, $gwDrops, info.id, kind === 'hard' ? info.code : null, info.reason);
        if (text) (kind === 'hard' ? console.error : console.log) ('[' + gwWhen (now) + '] ' + text);
        return;
    }
    const gap = $gwDown ? now - $gwDown : 0;
    $gwDown = null;
    const text = gwUpText (gap, kind === 'resume'
        ? (info.replayed ? 'событий добрано: ' + info.replayed : 'сессия продолжена')
        : 'вход выполнен заново');
    if (text) console.log ('[' + gwWhen (now) + '] ' + text);
}
client.on ('shardReconnecting', id => gwOn ('drop', { id: id }));
client.on ('shardDisconnect', (ev, id) => gwOn ('hard', { id: id, code: ev && ev.code, reason: ev && ev.reason }));
client.on ('shardResume', (id, replayed) => gwOn ('resume', { replayed: replayed }));
client.on ('shardReady', id => gwOn ('ready', { id: id }));
client.on ('shardError', (e, id) =>
{
    console.error ('[' + gwWhen (Date.now ()) + '] [gw] ошибка связи (шард ' + id + '): ' + oneLine ((e && e.message) || e));
});
client.on ('invalidated', () =>
{
    console.error ('[' + gwWhen (Date.now ()) + '] [gw] сессия Discord признана недействительной (сеть лежала долго или вход отозван) -- захожу заново');
    forceRelogin ('сессия недействительна');
});
client.on ('error', e =>
{
    console.error ('[' + gwWhen (Date.now ()) + '] [gw] ошибка клиента: ' + oneLine ((e && e.message) || e));
});

function forceRelogin (why)
{
    if ($gwReloginning) return;
    $gwReloginning = true;
    $gwRelogins++;
    console.log ('[' + gwWhen (Date.now ()) + '] [gw] перезапускаю подключение к Discord (' + why +
        ') -- то же, что раньше делал руками, но без остановки музыки');
    (async () =>
    {
        try { client.destroy (); } catch (e) { }
        await new Promise (r => setTimeout (r, 3000));
        try
        {
            await client.login (TOKEN);
            $gwDown = null;
            console.log ('[' + gwWhen (Date.now ()) + '] [gw] подключение поднято заново' +
                ($gwRelogins > 1 ? ' (всего автоперезапусков: ' + $gwRelogins + ')' : '') +
                ' -- если это повторяется, проверь интернет и токен');
        }
        catch (e)
        {
            console.error ('[' + gwWhen (Date.now ()) + '] [gw] заново подключиться не вышло: ' +
                oneLine ((e && e.message) || e) + ' -- попробую ещё через ' + Math.round (GATEWAY_RELOGIN_MS / 1000) + ' с');
        }
        finally { $gwReloginning = false; }
    }) ();
}

function gwShouldRelogin (gapMs, status, busy)
{
    if (busy) return null;
    if (!(gapMs >= GATEWAY_RELOGIN_MS)) return null;
    if (status === 0) return null;
    return 'связи нет ' + fmtAgo (gapMs) + ', состояние gateway: ' + (WS_STATUS[status] || status);
}
setInterval (() =>
{
    if (!$gwDown) return;
    const _gap = Date.now () - $gwDown;
    const _st = (client.ws && typeof client.ws.status === 'number') ? client.ws.status : -1;
    const _why = gwShouldRelogin (_gap, _st, $gwReloginning);
    if (_why) forceRelogin (_why);
}, 30000);

function dbFileOf (_srv)   { return __dirname + '/' + _srv + '.sqlite'; }
function dbBackupStampOf (_srv) { return __dirname + '/' + _srv + '.backup-' + dbCheckStamp (); }
function dbBrokenOf (_srv) { return __dirname + '/' + _srv + '.broken.sqlite'; }
function dbServerList ()   { return Object.keys (SERVERS).filter (_k => /^\d{17,20}$/.test (_k)); }
function serverOn (_srv) { return !!(SERVERS[_srv] && SERVERS[_srv].allow === true); }
function flagOn (_srv, _key) { return !!(SERVERS[_srv] && SERVERS[_srv][_key] === true); }
function dbServerListOn ()  { return dbServerList ().filter (_k => serverOn (_k)); }

function dbIntegrity (_file)
{
    const _f = require ('fs');
    if (!_f.existsSync (_file)) return { exists: false, ok: true, rows: 0, why: 'файла нет' };
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) {  }
    if (!DatabaseSync) return { exists: true, ok: true, rows: 0, why: 'нет node:sqlite' };
    let _db = null;
    try
    {
        _db = new DatabaseSync (_file, { readOnly: true });
        const _ic = _db.prepare ('PRAGMA integrity_check').all ();
        const _verdict = _ic && _ic[0] ? String (Object.values (_ic[0])[0]) : '';
        if (!/^ok$/i.test (_verdict))
            return { exists: true, ok: false, rows: 0, why: 'integrity_check: ' + clipText (_verdict, 120) };
        let _rows = 0;
        try { _rows = Number ((_db.prepare ('SELECT COUNT(*) AS n FROM keyv').get () || {}).n || 0); }
        catch (e) { _rows = 0; }
        return { exists: true, ok: true, rows: _rows, why: 'ok' };
    }
    catch (e)
    {
        return { exists: true, ok: false, rows: 0, why: 'не открылась: ' + clipText (String ((e && e.message) || e), 160) };
    }
    finally { try { if (_db) _db.close (); } catch (e) { } }
}

function dbCopyAndVerify (_src, _dst, _expectRows)
{
    const _f = require ('fs');
    const _tmp = _dst + '.tmp';
    try
    {
        _f.copyFileSync (_src, _tmp);
        const _chk = dbIntegrity (_tmp);
        if (!_chk.ok) { _f.rmSync (_tmp, { force: true }); return { ok: false, why: 'копия не читается: ' + _chk.why }; }
        if (Number.isFinite (_expectRows) && _chk.rows !== _expectRows)
        {
            _f.rmSync (_tmp, { force: true });
            return { ok: false, why: 'в копии ' + _chk.rows + ' записей, а в базе ' + _expectRows };
        }
        try { _f.renameSync (_tmp, _dst); }
        catch (e) { _f.copyFileSync (_tmp, _dst); _f.rmSync (_tmp, { force: true }); }
        return { ok: true, rows: _chk.rows };
    }
    catch (e)
    {
        try { _f.rmSync (_tmp, { force: true }); } catch (e2) { }
        return { ok: false, why: String ((e && e.message) || e) };
    }
}

function dbStartupGuard ()
{
    const _f = require ('fs');
    const _good = [], _bad = [];
    for (const _srv of dbServerListOn ())
    {
        const _file = dbFileOf (_srv);
        const _nm = (_srv + ((SERVERS[_srv] || {}).name ? ' («' + SERVERS[_srv].name + '»)' : ''));
        const _cur = dbIntegrity (_file);
        const _last = dbBackupLatest (_srv);
        const _old = _last ? dbIntegrity (_last.path) : { exists: false, ok: true, rows: 0, why: '' };
        if (_cur.exists && !_cur.ok) { _bad.push ({ nm: _nm, why: _cur.why, old: _old }); continue; }
        if (_cur.exists && _cur.rows === 0 && _old.exists && _old.rows > 0)
        {
            _bad.push ({ nm: _nm, why: 'в базе 0 записей, а в свежей копии ' + _old.rows, old: _old });
            continue;
        }
        let _tail = ' (базы ещё нет)';
        if (_cur.exists)
        {
            const _res = dbBackupMake (_srv);
            _tail = ' -- ' + _cur.rows + ' ' + plural (_cur.rows, 'запись', 'записи', 'записей') +
                (_res.ok
                    ? ', копия ' + dbTail (_res.path).replace (_srv + '.backup-', '') +
                      (_res.gone.length ? ' (старых копий убрал ' + _res.gone.length + ')' : '')
                    : ', копия НЕ сделана: ' + _res.why);
            if (_f.existsSync (_file + '-journal') || _f.existsSync (_file + '-wal'))
                _tail += ', был аварийный выход (журнал на диске -- SQLite откатит сам)';
        }
        _good.push (_nm + _tail);
    }
    if (_good.length)
        console.log ('[' + new Date ().toLocaleString () + '] [db] базы: ' + _good.join (' | '));
    for (const _srv of dbServerList ())
    {
        if (serverOn (_srv)) continue;
        const _left = [_srv + '.sqlite'].filter (_x => _f.existsSync (_x));
        if (!_left.length) continue;
        console.log ('[' + new Date ().toLocaleString () + '] [db] ' + _srv +
            ((SERVERS[_srv] || {}).name ? ' («' + SERVERS[_srv].name + '»)' : '') +
            ' выключен в конфиге (allow: false или ключа нет) -- базу ему не веду' +
            ', но лежит ' + _left[0] + ' (не нужен -- удали)');
    }
    if (!_bad.length) return;
    console.log ('' + '='.repeat (72));
    console.log ('[db] БАЗА ПОВРЕЖДЕНА -- БОТ НЕ ЗАПУСКАЕТСЯ, чтобы не потерять данные.');
    for (const _b of _bad)
    {
        console.log ('[db] ' + _b.nm + ': ' + _b.why +
            (_b.old.exists ? ' | копия: ' + _b.old.rows + ' ' + plural (_b.old.rows, 'запись', 'записи', 'записей') +
                ', ' + (_b.old.ok ? 'читается' : 'тоже не читается') : ' | копии нет'));
    }
    console.log ('[db] что делать: `node . restore` -- вернуть базу из САМОЙ СВЕЖЕЙ копии (текущую отложит рядом как <имя>.broken.sqlite).');
    console.log ('[db] если база пуста ОСОЗНАННО (чистка, /forget всех), а в свежей копии старые записи: `node . backup` --');
    console.log ('[db] он сделает новую копию с текущим (пустым) состоянием, а прежние копии с датой останутся -- их бот не трогает.');
    console.log ('[db] если копия не нужна и данные не жалко -- переименуй или удали файл базы и запусти снова.');
    console.log ('='.repeat (72));
    process.exit (1);
}

function dbBackupCli ()
{
    $cliOwnScreen ();
    let _fail = 0;
    console.log ('[backup] копия базы: <имя>.sqlite -> <имя>.backup-<дата>_<время>.sqlite' +
        (BACKUP_KEEP ? ' (самых свежих держу ' + BACKUP_KEEP + ', самая старая уходит сама; backup_keep)' : ' (старые копии не убираю: backup_keep = 0)'));
    for (const _srv of dbServerListOn ())
    {
        const _res = dbBackupMake (_srv);
        if (!_res.ok)
        {
            console.log ('[backup] ' + _srv + ': ' + _res.why +
                (dbIntegrity (dbFileOf (_srv)).exists ? ' -- прежние копии не тронуты' : ''));
            _fail++;
            continue;
        }
        console.log ('[backup] ' + _srv + ': копия сделана -- ' + dbTail (_res.path) + ' (' + _res.rows + ' ' +
            plural (_res.rows, 'запись', 'записи', 'записей') + ', файл прочитан)' +
            (_res.empty ? ' -- база сейчас пуста, так и записано' : '') +
            (_res.gone.length ? ', старых копий убрал ' + _res.gone.length + ' (backup_keep: ' + BACKUP_KEEP + ')' : ''));
    }
    return _fail ? 1 : 0;
}

const BACKUP_KEEP = (() =>
{
    const _v = Number (backup_keep);
    if (!Number.isFinite (_v) || _v < 0) return 5;
    return Math.floor (_v);
}) ();
const dbTail = _p => String (_p).replace (/^.*[\\/]/, '');
function dbCheckStamp ()
{
    const _d = new Date (), _p = _n => ('0' + _n).slice (-2);
    return _d.getFullYear () + '-' + _p (_d.getMonth () + 1) + '-' + _p (_d.getDate ()) + '_' +
        _p (_d.getHours ()) + '-' + _p (_d.getMinutes ()) + '-' + _p (_d.getSeconds ());
}
function dbStampFiles (_prefix)
{
    const _f = require ('fs');
    let _list = [];
    try { _list = _f.readdirSync (__dirname); } catch (e) { return []; }
    const _stamp = _n => _n.slice (_prefix.length, _prefix.length + 19);
    const _mtime = _p => { try { return _f.statSync (_p).mtimeMs; } catch (e) { return 0; } };
    const _nat = _n =>
    {
        const _m = /^([\s\S]*?)(?:-(\d+))?\.sqlite$/.exec (_n);
        return { base: _m ? _m[1] : _n, num: _m && _m[2] ? Number (_m[2]) : 0 };
    };
    return _list
        .filter (_n => _n.startsWith (_prefix) && _n.endsWith ('.sqlite'))
        .map (_n => ({ name: _n, path: __dirname + '/' + _n }))
        .sort ((a, b) =>
        {
            const _sa = _stamp (a.name), _sb = _stamp (b.name);
            if (_sa !== _sb) return _sa < _sb ? -1 : 1;
            const _ma = _mtime (a.path), _mb = _mtime (b.path);
            if (_ma !== _mb) return _ma - _mb;
            const _ka = _nat (a.name), _kb = _nat (b.name);
            if (_ka.base !== _kb.base) return _ka.base < _kb.base ? -1 : 1;
            if (_ka.num !== _kb.num) return _ka.num - _kb.num;
            return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
        });
}
function dbCheckFiles (_srv)  { return dbStampFiles (_srv + '.check-'); }
function dbBackupFiles (_srv) { return dbStampFiles (_srv + '.backup-'); }
function dbBackupLatest (_srv)
{
    const _all = dbBackupFiles (_srv);
    if (_all.length) return { name: dbTail (_all[_all.length - 1].name), path: _all[_all.length - 1].path };
    return null;
}
function dbBackupRotate (_srv)
{
    const _f = require ('fs');
    if (!BACKUP_KEEP) return [];
    const _all = dbBackupFiles (_srv);
    const _gone = [];
    while (_all.length > BACKUP_KEEP)
    {
        const _old = _all.shift ();
        try { _f.rmSync (_old.path, { force: true }); _gone.push (_old.name); } catch (e) { }
    }
    return _gone;
}
function dbBackupMake (_srv)
{
    const _file = dbFileOf (_srv), _cur = dbIntegrity (_file);
    if (!_cur.exists) return { ok: false, why: 'базы ещё нет -- копировать нечего' };
    if (!_cur.ok) return { ok: false, why: 'база ПОВРЕЖДЕНА (' + _cur.why + ') -- копию не делаю' };
    const _f = require ('fs');
    const _base = dbBackupStampOf (_srv);
    let _dst = _base + '.sqlite', _n = 1;
    while (_f.existsSync (_dst)) { _n++; _dst = _base + '-' + _n + '.sqlite'; }
    const _res = dbCopyAndVerify (_file, _dst, _cur.rows);
    if (!_res.ok) return { ok: false, why: _res.why };
    return { ok: true, path: _dst, rows: _res.rows, empty: _cur.rows === 0, gone: dbBackupRotate (_srv) };
}
function dbCheckpointMake (_srv, _label)
{
    const _file = dbFileOf (_srv);
    const _cur = dbIntegrity (_file);
    if (!_cur.exists) return { ok: false, why: 'базы ещё нет -- точку делать не из чего' };
    if (!_cur.ok) return { ok: false, why: 'база ПОВРЕЖДЕНА (' + _cur.why + ')' };
    if (_cur.rows === 0) return { ok: false, why: 'в базе 0 записей -- точка не нужна' };
    const _lab = String (_label === undefined || _label === null ? '' : _label).trim ()
        .replace (/[^\w\u0400-\u04FF-]+/g, '-').replace (/^-+|-+$/g, '').slice (0, 24);
    const _f = require ('fs');
    const _base = __dirname + '/' + _srv + '.check-' + dbCheckStamp () + (_lab ? '-' + _lab : '');
    let _dst = _base + '.sqlite', _n = 1;
    while (_f.existsSync (_dst)) { _n++; _dst = _base + '-' + _n + '.sqlite'; }
    const _res = dbCopyAndVerify (_file, _dst, _cur.rows);
    if (!_res.ok) return { ok: false, why: _res.why };
    return { ok: true, path: _dst, rows: _res.rows };
}

function dbCheckpointCli (_label)
{
    $cliOwnScreen ();
    let _fail = 0;
    for (const _srv of dbServerListOn ())
    {
        const _r = dbCheckpointMake (_srv, _label);
        if (!_r.ok) { console.log ('[checkpoint] ' + _srv + ': ' + _r.why); _fail++; continue; }
        console.log ('[checkpoint] ' + _srv + ': точка создана -- ' + dbTail (_r.path) + ' (' + _r.rows + ' ' +
            plural (_r.rows, 'запись', 'записи', 'записей') + ', файл прочитан)');
    }
    console.log ('[checkpoint] точки бот не удаляет сам: когда не нужны -- удаляй вручную (лимит backup_keep к ним не применяется)');
    return _fail ? 1 : 0;
}

function dbBackupsCli ()
{
    $cliOwnScreen ();
    const _f = require ('fs');
    const _size = _p => { try { return Math.max (1, Math.round (_f.statSync (_p).size / 1024)) + ' КБ'; } catch (e) { return '?'; } };
    const _when = _p => { try { return _f.statSync (_p).mtime.toLocaleString (); } catch (e) { return '?'; } };
    const _line = (_tag, _p, _i) => '[backups]   ' + _tag + ' ' + (_i.exists
        ? _i.rows + ' ' + plural (_i.rows, 'запись', 'записи', 'записей') + ', ' + _size (_p) + ', изменена ' + _when (_p) +
          (_i.ok ? '' : ' -- НЕ ЧИТАЕТСЯ (' + _i.why + ')')
        : 'нет');
    const _lbl = (_srv, _name) => dbTail (_name).replace (_srv + '.check-', '').replace (_srv + '.backup-', '');
    for (const _srv of dbServerListOn ())
    {
        const _nm = _srv + ((SERVERS[_srv] || {}).name ? ' («' + SERVERS[_srv].name + '»)' : '');
        console.log ('[backups] ' + _nm + ':');
        const _file = dbFileOf (_srv);
        console.log (_line ('база сейчас', _file, dbIntegrity (_file)));
        const _bakAll = dbBackupFiles (_srv).reverse ();
        if (!_bakAll.length)
            console.log ('[backups]   копий с датой нет (сделать: node . backup)');
        else
            for (const _c of _bakAll)
                console.log (_line ('копия ' + _lbl (_srv, _c.name), _c.path, dbIntegrity (_c.path)));
        if (_bakAll.length)
            console.log ('[backups]   копий с датой: ' + _bakAll.length +
                (BACKUP_KEEP ? ' (держу до ' + BACKUP_KEEP + ': backup_keep)' : ' (старые не убираю: backup_keep = 0)'));
        const _ch = dbCheckFiles (_srv);
        if (!_ch.length)
            console.log ('[backups]   точек нет (сделать: node . checkpoint [метка]; бот их не удаляет)');
        else
            for (const _c of _ch)
                console.log (_line ('точка ' + _lbl (_srv, _c.name), _c.path, dbIntegrity (_c.path)));
        console.log ('[backups]   вернуть: node . restore -- из самой свежей копии (' +
            (_bakAll.length ? _lbl (_srv, _bakAll[0].name) : 'копий нет') +
            ') | node . restore <метка> -- из копии или точки');
    }
    return 0;
}

function dbRestoreCli (_sel)
{
    $cliOwnScreen ();
    const _f = require ('fs');
    const _want = String (_sel === undefined || _sel === null ? '' : _sel).trim ();
    let _fail = 0;
    for (const _srv of dbServerListOn ())
    {
        const _file = dbFileOf (_srv), _broken = dbBrokenOf (_srv);
        const _latest = dbBackupLatest (_srv);
        let _src = _latest ? _latest.path : '';
        let _what = _latest ? ('копии ' + dbTail (_latest.name)) : 'копии (её нет)';
        if (_want && !/^latest$/i.test (_want) && _want !== '-')
        {
            const _low = _want.toLowerCase ();
            const _lbl = _c => dbTail (_c.name).replace (_srv + '.check-', '').replace (_srv + '.backup-', '');
            const _all = [...dbCheckFiles (_srv), ...dbBackupFiles (_srv)];
            const _hit = _all.filter (_c => _c.name.toLowerCase ().includes (_low));
            if (!_hit.length)
            {
                console.log ('[restore] ' + _srv + ': по запросу «' + _want + '» ничего не нашёл' +
                    (_all.length ? '. Есть: ' + _all.map (_lbl).join (', ')
                                 : ' -- ни копий, ни точек нет'));
                _fail++; continue;
            }
            if (_hit.length > 1)
            {
                console.log ('[restore] ' + _srv + ': по запросу «' + _want + '» нашлось несколько файлов -- уточни запрос: ' +
                    _hit.map (_lbl).join (', '));
                _fail++; continue;
            }
            _src = _hit[0].path;
            _what = (/\.[\w-]*check-/.test (_hit[0].name) ? 'точки ' : 'копии ') + _lbl (_hit[0]);
        }
        const _b = dbIntegrity (_src);
        if (!_b.exists) { console.log ('[restore] ' + _srv + ': восстанавливать нечего -- нет ' + _what); _fail++; continue; }
        if (!_b.ok) { console.log ('[restore] ' + _srv + ': ' + _what + ' сама не читается (' + _b.why + ') -- ничего не трогаю'); _fail++; continue; }
        if (_b.rows === 0) { console.log ('[restore] ' + _srv + ': ' + _what + ' пустая -- восстанавливать нечего'); _fail++; continue; }
        const _cur = dbIntegrity (_file);
        if (_cur.exists && _cur.ok && _cur.rows > 0)
        {
            const _c = dbCheckpointMake (_srv, 'before-restore');
            if (_c.ok) console.log ('[restore] ' + _srv + ': на всякий случай сохранил текущую базу точкой ' + dbTail (_c.path));
        }
        if (_cur.exists)
        {
            try { _f.copyFileSync (_file, _broken); console.log ('[restore] ' + _srv + ': текущая база отложена в ' + dbTail (_broken)); }
            catch (e) { console.log ('[restore] ' + _srv + ': не смог отложить текущую базу: ' + clipText (String ((e && e.message) || e), 160) + ' -- ничего не трогаю'); _fail++; continue; }
        }
        const _res = dbCopyAndVerify (_src, _file, _b.rows);
        if (_res.ok) console.log ('[restore] ' + _srv + ': база восстановлена из ' + _what + ' -- ' + _res.rows + ' ' +
            plural (_res.rows, 'запись', 'записи', 'записей') + ', файл прочитан');
        else { console.log ('[restore] ' + _srv + ': не вышло: ' + _res.why + ' (' + _what + ' цела, можно повторить)'); _fail++; }
    }
    return _fail ? 1 : 0;
}

function dbArgAfter (_cmd)
{
    const _a = process.argv.slice (2);
    const _i = _a.findIndex (_x => new RegExp ('^' + _cmd + '$', 'i').test (_x));
    return _i >= 0 ? (_a[_i + 1] || '') : '';
}

if (process.argv.slice (2).some (_a => /^backup$/i.test (_a)))
{
    let _code = 1;
    try { _code = dbBackupCli (); } catch (e) { console.log ('[backup] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}
if (process.argv.slice (2).some (_a => /^checkpoint$/i.test (_a)))
{
    let _code = 1;
    try { _code = dbCheckpointCli (dbArgAfter ('checkpoint')); } catch (e) { console.log ('[checkpoint] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}
if (process.argv.slice (2).some (_a => /^backups$/i.test (_a)))
{
    let _code = 1;
    try { _code = dbBackupsCli (); } catch (e) { console.log ('[backups] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}
if (process.argv.slice (2).some (_a => /^restore$/i.test (_a)))
{
    let _code = 1;
    try { _code = dbRestoreCli (dbArgAfter ('restore')); } catch (e) { console.log ('[restore] ошибка: ' + ((e && e.message) || e)); }
    $cliDone (_code);
}
dbStartupGuard ();

const BACKUP_EVERY_MINUTES = (() =>
{
    const _v = Number (backup_minutes);
    if (!Number.isFinite (_v) || _v < 0) return 60;
    return Math.floor (_v);
}) ();

let _backupLastAt = Date.now ();

function dbBackupTick ()
{
    const _now = Date.now ();
    const _gapMs = _now - _backupLastAt;
    _backupLastAt = _now;
    if (BACKUP_EVERY_MINUTES > 0 && _gapMs > BACKUP_EVERY_MINUTES * 60 * 1000 * 1.5)
        console.log ('[' + (d()) + '] [backup] прошлый проход был ' + fmtAgo (_gapMs) +
            ' назад, а расписание -- каждые ' + BACKUP_EVERY_MINUTES + ' мин: делаю копию сейчас');
    for (const _srv of dbServerListOn ())
    {
        const _name = _srv + ((SERVERS[_srv] || {}).name ? ' («' + SERVERS[_srv].name + '»)' : '');
        const _res = dbBackupMake (_srv);
        if (!_res.ok)
        {
            if (/базы ещё нет/.test (_res.why))
                console.log ('[' + (d()) + '] [backup] ' + _name + ': базы ещё нет -- копировать нечего');
            else if (/ПОВРЕЖДЕНА/.test (_res.why))
                console.error ('[' + (d()) + '] [backup] ' + _name + ': ' + _res.why + ' -- прежние копии не трогаю');
            else
                console.error ('[' + (d()) + '] [backup] ' + _name + ': копия не сделалась: ' + _res.why);
            continue;
        }
        console.log ('[' + (d()) + '] [backup] ' + _name + ': копия ' + dbTail (_res.path).replace (_srv + '.backup-', '') +
            ' (' + _res.rows + ' ' + plural (_res.rows, 'запись', 'записи', 'записей') + ', файл прочитан)' +
            (_res.empty ? ' -- база сейчас пуста, так и записано' : '') +
            (_res.gone.length ? ', старых копий убрал ' + _res.gone.length + ' (держу ' + BACKUP_KEEP + ')' : ''));
    }
}
if (BACKUP_EVERY_MINUTES > 0)
{
    console.log ('[' + new Date ().toLocaleString () + '] [db] плановые копии базы: каждые ' +
        BACKUP_EVERY_MINUTES + ' мин, пока бот работает (backup_minutes; 0 -- только при старте и вручную) -- ' +
        'каждый проход видно в логе [backup]; ' +
        (BACKUP_KEEP ? 'держу последние ' + BACKUP_KEEP + ' копий с датой в имени (backup_keep; 0 -- не убирать старые)'
                     : 'старые копии с датой не удаляю (backup_keep: 0)') +
        ', контрольные точки бот не удаляет');
    setInterval (dbBackupTick, BACKUP_EVERY_MINUTES * 60 * 1000);
}

const { Keyv } = require ('keyv');
const { KeyvSqlite } = require ('@keyv/sqlite');

function dbMake (_server, _namespace)
{
    if (!serverOn (_server))
        return new Keyv ({ namespace: _namespace, serialize: dbSerialize, deserialize: dbDeserialize });
    const kv = new Keyv
    (
        {
            store: new KeyvSqlite ({ uri: 'sqlite://' + __dirname + '/' + _server + '.sqlite' }),
            namespace: _namespace,
            serialize: dbSerialize,
            deserialize: dbDeserialize,
        }
    );
    kv.on ('error', e => console.error ('[db] ' + _namespace + ': ' + String ((e && e.message) || e).slice (0, 200)));
    return kv;
}

var $db = {};
for (let _server in SERVERS)
{
    $db[_server] = {};
    $db[_server]['membersBanTimeout'] = dbMake (_server, 'membersBanTimeout');
    $db[_server]['channelsBusy']      = dbMake (_server, 'channelsBusy');
    $db[_server]['musicState']        = dbMake (_server, 'musicState');
    $db[_server]['netState']          = dbMake (_server, 'netState');
    $db[_server]['dnsbook']           = dbMake (_server, 'dnsbook');   // своя книга имён и адресов (DNS -- только справочная)
    $db[_server]['memberRoles']       = dbMake (_server, 'memberRoles');
    $db[_server]['banHistory']        = dbMake (_server, 'banHistory');
}

async function dbFixAuthorsCli ()
{
    $cliOwnScreen ();
    const _args = process.argv.slice (2).filter (_x => !/^fixauthors$/i.test (_x));
    const _dry = _args.some (_x => /^--dry$/i.test (_x));
    const _id = _args.find (_x => /^\d{17,20}$/.test (_x)) || '';
    const _name = _args.find (_x => !/^--/.test (_x) && !/^\d{17,20}$/.test (_x)) || '';
    console.log ('[fixauthors] режим: ' + (_dry ? 'только посчитать (--dry), база не меняется' : 'дописать автора трекам, у которых его нет'));
    if (!_id)
    {
        console.log ('[fixauthors] нужен id того, кто добавлял эти треки.');
        console.log ('[fixauthors] пример: node . fixauthors 123456789012345678 "НикАвтора"');
        console.log ('[fixauthors] id берётся в Discord: правый клик по человеку -> «Копировать ID пользователя».');
        return 2;
    }
    console.log ('[fixauthors] автор, которого дописываю: ' + _id + (_name ? ' («' + _name + '»)' : ' (без имени -- в /queue будет виден id)'));
    let _total = 0, _servers = 0;
    for (const _srv of dbServerListOn ())
    {
        const _title = _srv + ((SERVERS[_srv] || {}).name ? ' («' + SERVERS[_srv].name + '»)' : '');
        let _st = null;
        try { _st = await db (_srv, 'musicState', 'queue'); }
        catch (e)
        {
            console.log ('[fixauthors] ' + _title + ': не смог прочитать очередь: ' + oneLine ((e && e.message) || e));
            continue;
        }
        if (!_st || typeof _st !== 'object')
        {
            console.log ('[fixauthors] ' + _title + ': очереди в базе нет -- ничего не делаю');
            continue;
        }
        let _fixed = 0, _had = 0;
        const _mark = t =>
        {
            if (!t || typeof t !== 'object') return;
            if (t.byId) { _had++; return; }
            t.byId = _id;
            t.byName = _name || _id;
            _fixed++;
        };
        _mark (_st.current);
        for (const _t of (_st.tracks || [])) _mark (_t);
        if (!_fixed)
        {
            console.log ('[fixauthors] ' + _title + ': без автора ничего нет (у ' + _had + ' треков автор уже есть) -- ничего не менял');
            continue;
        }
        if (!_dry)
        {
            try { await db (_srv, 'musicState', 'queue', _st); }
            catch (e)
            {
                console.log ('[fixauthors] ' + _title + ': не смог записать: ' + oneLine ((e && e.message) || e));
                continue;
            }
        }
        _total += _fixed;
        _servers++;
        console.log ('[fixauthors] ' + _title + ': дописал автора ' + _fixed + ' ' +
            plural (_fixed, 'треку', 'трекам', 'трекам') + (_had ? ', у ' + _had + ' автор уже был' : '') +
            (_dry ? ' [--dry: НЕ записывал]' : ' -- сохранено'));
    }
    console.log ('[fixauthors] итог: ' + _total + ' ' + plural (_total, 'трек', 'трека', 'треков') +
        ' на ' + _servers + ' ' + plural (_servers, 'сервере', 'серверах', 'серверах') +
        (_dry ? ' (ничего не записано)' : ''));
    if (_total && !_dry)
    {
        console.log ('[fixauthors] готово. В /queue у этих треков теперь будет автор, а обычный DJ сможет их убирать и двигать.');
        console.log ('[fixauthors] на всякий случай: копию базы можно сделать до/после --  node . checkpoint before-fixauthors');
    }
    return 0;
}

if (process.argv.slice (2).some (_a => /^fixauthors$/i.test (_a)))
{
    dbFixAuthorsCli ()
        .then (_code => $cliDone (_code || 0))
        .catch (e => { console.log ('[fixauthors] ошибка: ' + oneLine ((e && e.message) || e)); $cliDone (1); });
}

console.log ('[' + new Date ().toLocaleString () + '] [db] шифрование записей: ' +
    (DB_KEYS.length ? 'ВКЛЮЧЕНО (db_key), AES-256-GCM -- не потеряй config.json: без ключа записи не прочитаются'
                    : 'выключено (нет db_key в config.json)'));

function dbWarnLocked ()
{
    if (DB_KEYS.length) return;
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) { return; }
    const _fs = require ('fs');
    for (const _srv of dbServerListOn ())
    {
        const _file = dbFileOf (_srv);
        if (!_fs.existsSync (_file)) continue;
        let _db = null, _rows = [];
        try
        {
            _db = new DatabaseSync (_file, {readOnly: true});
            _rows = _db.prepare ('SELECT value FROM keyv').all ();
        }
        catch (e) { _rows = []; }
        try { if (_db) _db.close (); } catch (e) {  }
        let _n = 0;
        for (const _r of _rows)
            if (dbRawStr (_r.value).startsWith (DB_ENC_PREFIX)) _n++;
        if (_n)
            console.log ('[' + new Date ().toLocaleString () + '] [db] ВНИМАНИЕ: db_key в config.json ПУСТ, а в базе ' +
                _srv + ' ' + _n + ' ' + plural (_n, 'зашифрованная запись', 'зашифрованные записи', 'зашифрованных записей') +
                ' -- они НЕ ЧИТАЮТСЯ (роли для возврата, таймауты, история, очередь музыки).\n' +
                '     Впиши прежний db_key (или db_key_prev) в config.json и перезапусти бота -- записи целы, они просто ждут ключ.');
    }
}
dbWarnLocked ();

async function dbEncryptLegacy (_server)
{
    if (!DB_KEYS.length) return { n: 0, bad: 0 };
    let n = 0, bad = 0;
    for (const _ns of Object.keys ($db[_server] || {}))
    {
        const _store = $db[_server][_ns] && $db[_server][_ns].store;
        if (!_store || typeof _store.iterator !== 'function') continue;
        const _legacy = [];
        try
        {
            for await (const [_key, _raw] of _store.iterator (_ns))
            {
                const _s = dbRawStr (_raw);
                if (_s && !_s.startsWith (DB_ENC_PREFIX)) _legacy.push ([_key, _s]);
            }
            for (const [_key, _s] of _legacy) { await _store.set (_key, dbEnc (_s)); n++; }
        }
        catch (e)
        {
            bad++;
            console.log ('[' + new Date ().toLocaleString () + '] [db] ' + _ns +
                ': старые записи не удалось зашифровать -- ' + String ((e && e.message) || e));
        }
    }
    return { n: n, bad: bad };
}
(async () =>
{
    if (!DB_KEYS.length) return;
    let _n = 0;
    for (const _s in $db)
    {
        const _r = await dbEncryptLegacy (_s);
        _n += _r.n;
    }
    if (_n) console.log ('[' + new Date ().toLocaleString () + '] [db] перевёл на шифрование ' + _n +
        ' записей от прошлых версий -- открытого текста в базе больше нет');
}) ();

const fsMod = require ('fs');
const CONFIG_PATH = __dirname + '/config.json';

async function dbRekey (_newKey)
{
    const res = { enc: 0, plain: 0, bad: 0, ns: 0, abort: false, why: '' };
    for (const _srv in $db)
    {
        for (const _ns of Object.keys ($db[_srv] || {}))
        {
            const _store = $db[_srv][_ns] && $db[_srv][_ns].store;
            if (!_store || typeof _store.iterator !== 'function') continue;
            const _rows = [];
            try
            {
                for await (const [_key, _raw] of _store.iterator (_ns))
                {
                    const _s = dbRawStr (_raw);
                    if (!_s) continue;
                    if (_s.startsWith (DB_ENC_PREFIX))
                    {
                        const _t = dbDec (_s);
                        if (_t === null) { res.bad++; continue; }
                        _rows.push ([_key, _t, true]);
                    }
                    else _rows.push ([_key, _s, false]);
                }
                for (const [_key, _t, _wasEnc] of _rows)
                {
                    await _store.set (_key, dbEncKey (_newKey, _t));
                    const _back = dbRawStr (await _store.get (_key));
                    if (dbDecKey (_newKey, _back) !== _t) throw new Error ('проверка не сошлась: ' + _key);
                    if (_wasEnc) res.enc++; else res.plain++;
                }
                res.ns++;
            }
            catch (e)
            {
                res.abort = true;
                res.why = _ns + ': ' + String ((e && e.message) || e);
                break;
            }
        }
        if (res.abort) break;
    }
    return res;
}

function dbKeysSaveToConfig (_primary, _prev)
{
    try
    {
        if (!fsMod.existsSync (CONFIG_PATH)) return false;
        let _src = fsMod.readFileSync (CONFIG_PATH, 'utf8');
        if (!/"db_key"\s*:/.test (_src)) return false;
        const _hex = _primary ? _primary.toString ('hex') : '';
        const _prevJson = JSON.stringify ((_prev || []).map (k => k.toString ('hex')));
        _src = _src.replace (/("db_key"\s*:\s*)"[^"]*"/, '$1"' + _hex + '"');
        if (/"db_key_prev"\s*:/.test (_src))
            _src = _src.replace (/("db_key_prev"\s*:\s*)\[[^\]]*\]/, '$1' + _prevJson);
        else
            _src = _src.replace (/"db_key"\s*:\s*"[^"]*"/, '$&,\n  "db_key_prev": ' + _prevJson);
        fsMod.writeFileSync (CONFIG_PATH + '.tmp', _src, 'utf8');
        fsMod.renameSync (CONFIG_PATH + '.tmp', CONFIG_PATH);
        return true;
    }
    catch (e)
    {
        console.log ('[' + new Date ().toLocaleString () + '] [db] новый ключ не удалось вписать в config.json: ' +
            String ((e && e.message) || e));
        return false;
    }
}

async function db (server, namespace, id, value = undefined, item = undefined)
{
    if (id === '!!!WIPE!!!')
        return await $db[server][namespace].clear();
    else
        if (item === undefined)
            if (value === undefined)
                return await $db[server][namespace].get (id);
            else
                if (value === null)
                    return await $db[server][namespace].delete (id);
                else
                    return await $db[server][namespace].set (id, value);
        else
        {
            let obj = await $db[server][namespace].get (id);
            if (typeof obj !== 'object') obj = {};
            if (value === undefined)
                return obj[item];
            else
                if (value === null)
                {
                    delete obj[item];
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

process.on ('unhandledRejection', e =>
{
    console.error ('[' + (d()) + '] [unhandledRejection] ' + String ((e && e.message) || e).slice (0, 300));
    const p = crashIncident ('unhandledRejection', e, 'бот продолжает работу -- это необработанный промис, а не падение');
    if (p) console.error ('[' + (d()) + '] [crash] отчёт о сбое: ' + p);
});
process.on ('uncaughtException',  e =>
{
    console.error ('[' + (d()) + '] [uncaughtException] '  + String ((e && e.message) || e).slice (0, 300));
    const p = crashIncident ('uncaughtException', e, 'бот продолжает работу -- сработала страховка уровня процесса');
    if (p) console.error ('[' + (d()) + '] [crash] отчёт о сбое: ' + p);
});

async function messageContentAllowed ()
{
    try
    {
        const r = await fetch
        (
            'https://discord.com/api/v10/applications/@me',
            {headers: {Authorization: 'Bot ' + TOKEN}, signal: AbortSignal.timeout (5000)}
        );
        if (!r.ok) return true;
        const app = await r.json();
        return Boolean (app.flags & ((1 << 18) | (1 << 19)));
    }
    catch (e) { return true; }
}

async function guildMembersAllowed ()
{
    try
    {
        const r = await fetch
        (
            'https://discord.com/api/v10/applications/@me',
            {headers: {Authorization: 'Bot ' + TOKEN}, signal: AbortSignal.timeout (5000)}
        );
        if (!r.ok) return true;
        const app = await r.json ();
        return Boolean ((app.flags || 0) & ((1 << 14) | (1 << 15)));
    }
    catch (e) { return true; }
}

function dropIntent (bit)
{
    const bitfield = client.options.intents.bitfield & ~bit;
    client.options.intents = new IntentsBitField (bitfield);
    return !client.options.intents.has (bit);
}

const INTENT_NAMES = new Map
([
    [GatewayIntentBits.GuildMembers, 'Guild Members (мгновенные вход/выход)'],
    [GatewayIntentBits.MessageContent, 'Message Content (текст сообщений и команды "panda ...")'],
]);

{
    const _alreadyStamped = s => /^\[\s*\d{1,4}[.\/]\d{1,2}[.\/]\d{1,4}/.test (s);
    const _withStamp = fn => (...args) =>
    {
        if (args.length && typeof args[0] === 'string' && !_alreadyStamped (args[0]))
            args[0] = '[' + d () + '] ' + args[0];
        return fn (...args);
    };
    console.log = _withStamp (console.log.bind (console));
    console.error = _withStamp (console.error.bind (console));
}

function botLockFile ()
{
    return pathMod.join (LOG_DIR, 'bot.pid');
}
function botPidAlive (pid)
{
    if (!pid || pid === process.pid) return false;
    try { process.kill (pid, 0); return true; }
    catch (e) { return !!(e && e.code === 'EPERM'); }
}
function botAlreadyRunning ()
{
    const _f = botLockFile ();
    try
    {
        if (fsLog.existsSync (_f))
        {
            const _pid = parseInt (String (fsLog.readFileSync (_f, 'utf8')).replace (/\D+/g, ''), 10);
            if (botPidAlive (_pid))
                return 'бот уже запущен (pid ' + _pid + ', замок ' + _f + ') -- этот запуск останавливаю. ' +
                    'Закрыть прежний: Ctrl+C в его окне или `taskkill /PID ' + _pid + ' /F`. ' +
                    'Замок снимется сам, когда прежний бот выйдет.';
        }
        fsLog.mkdirSync (LOG_DIR, { recursive: true });
        fsLog.writeFileSync (_f, String (process.pid));
    }
    catch (e)
    {
    }
    return '';
}
function botLockRelease ()
{
    try
    {
        const _f = botLockFile ();
        if (!fsLog.existsSync (_f)) return;
        const _pid = parseInt (String (fsLog.readFileSync (_f, 'utf8')).replace (/\D+/g, ''), 10);
        if (_pid === process.pid) fsLog.unlinkSync (_f);
    }
    catch (e) { }
}

(async () =>
{
    if ($cliHold)
    {
        console.log ('[' + (d()) + '] [login] пропускаю вход: сейчас работает консольная команда');
        return;
    }

    if (logFilePath ())
        console.log ('[' + (d()) + '] [log] живой лог пишу ещё и в файл: ' + logFilePath () +
            ' (файл на месяц; папка и файлы лога в git не попадают' +
            (LOG_KEEP_MONTHS ? ', держу последних месяцев: ' + LOG_KEEP_MONTHS : ', старые месяцы не удаляю') + ')');
    if (BOT_RUN && $conMode)
    {
        if ($conMode === 'async')
            console.log ('[' + (d()) + '] [log] консоль: пишу асинхронно -- зависшее окно консоли бота НЕ останавливает' +
                ' (строки пойдут в него, когда оно освободится; до тех пор они копятся в файле)' +
                ($conNote ? ' [' + $conNote + ']' : ''));
        else
            console.log ('[' + (d()) + '] [log] консоль: пишу синхронно, как раньше -- байтами нельзя (кодовая страница окна ' +
                $conNote + ', UTF-8 поставить не удалось). Если окно перестанет читать вывод, бот может встать: ' +
                'перезапусти его в окне с `chcp 65001`');
    }
    if (USE_MESSAGE_CONTENT && !(await messageContentAllowed ()))
    {
        console.error ('[' + (d()) + '] [login] Message Content у приложения ОТКЛЮЧЁН -- запускаю без него' +
            ' (пересылка из пандалогии и команды "panda ..." работать не будут)');
        dropIntent (GatewayIntentBits.MessageContent);
    }
    if (!client.options.intents.has (GatewayIntentBits.MessageContent))
        console.log ('[' + (d()) + '] [login] без интента Message Content: текст сообщений недоступен');
    if (USE_GUILD_MEMBERS && !(await guildMembersAllowed ()))
    {
        console.error ('[' + (d()) + '] [login] Guild Members у приложения ОТКЛЮЧЁН -- запускаю без него' +
            ' (вход/выход только опросом раз в 45 сек)' +
            ' [а полный список участников требует тот же интент: без него приветствие, таймаут за выход и возврат ролей работать не будут]');
        dropIntent (GatewayIntentBits.GuildMembers);
    }
    const PRIVILEGED = [GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent];
    for (let attempt = 0; attempt <= PRIVILEGED.length; attempt++)
    {
        try
        {
            await client.login (TOKEN);
            break;
        }
        catch (e)
        {
            const msg = String ((e && e.message) || e);
            const drop = /disallowed intent/i.test (msg) ? PRIVILEGED.find (i => client.options.intents.has (i)) : null;
            if (!drop)
            {
                console.error ('[login] ошибка: ' + msg);
                break;
            }
            dropIntent (drop);
            const isMembers = drop === GatewayIntentBits.GuildMembers;
            console.error ('[' + (d()) + '] [login] Discord запретил интент ' + (INTENT_NAMES.get (drop) || 'привилегированный') +
                ' -- переподключаюсь без него (это не сбой бота: так работает откат)' +
                (isMembers
                    ? ' [вход/выход придётся ловить опросом -- а он требует тот же интент: без него приветствие, таймаут за выход и возврат ролей работать не будут]'
                    : ' [пересылка из пандалогии и команды "panda ..." работать не будут]'));
        }
    }
})();

client.on
(
    'clientReady',
    async () =>
    {
        const _again = $bootOnce;
        console.log
        (
            '[' + (d()) + '] ' +
            `Logged in as ${client.user.tag}!` +
            (_again ? ' (вход после переподключения -- отчёты и музыка не дублируются)' : '')
        );
        if (_again) { schedulePresence (true); return; }
        $bootOnce = true;
        musicNormalizeReady = await probeNormalize ();
        console.log ('[' + (d()) + '] [music] выравнивание громкости (MUSIC.normalize): ' +
            (musicNormalizeReady
                ? 'включено -- ' + MUSIC_NORMALIZE_FILTER
                : (MUSIC_NORMALIZE ? 'НЕДОСТУПНО (ffmpeg не осилил фильтр) -- играю как есть' : 'выключено в конфиге')));
        schedulePresence (true);
        for (const uid of STARTUP_DMS)
        {
            await client.users.fetch (uid)
            .then
            (
                user => sendHelpDm (user, Object.keys (SERVERS)[0])
            )
            .then (() => console.log ('[' + (d()) + '] стартовая ЛС отправлена ' + uid))
            .catch (e => console.error ('[' + (d()) + '] стартовая ЛС не ушла ' + uid + ': ' + e.message));
        }
    }
);

var pad = (n,z=2)=>('0'+n).slice(-z);
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
function dt (t = 0)
{
    return t ? new Date(t) : new Date();
}
function dd (d2, f = false, d1 = undefined)
{
    d1 = d1 ? d1 : Date.now();
    let d = (d2 - d1);
    let h = d/3.6e6|0;
    let m = d%3.6e6/6e4|0;
    let s = d%6e4/1000|0;
    let r = f
        ?
            (h ? pad(h) + ' час.' : '') +
            (m ? (h ? ' ' : '') + pad(m) + ' мин.' : '') +
            (s ? (h||m ? ' ' : '') + pad(s) + ' сек.' : '')
        :
            pad(h) + ':' + pad(m) + ':' + pad(s);
    return r;
}
function u (id)
{
    return '<@!'+id+'>';
}
function uu (user)
{
    return user.username;
}
function uuu (member)
{
    return member.user.username +
        (member.nickname ? ' (' + member.nickname + ')' : '');
}
function c (id)
{
    return '<#'+id+'>';
}
function cc (channel)
{
    return '#'+channel.name;
}
function ccc (channel)
{
    if (channel.type === ChannelType.GuildText)
        return `${channel}` + ' (#'+channel.name+')';
    else
        return `${channel}`;
}
function r (id)
{
    return '<@&'+id+'>';
}
function code (s)
{
    return s.replace(/`/g, '\'');
}

function attachOf (message)
{
    return {
        files: [...message.attachments.values ()].map
        (
            a => ({ attachment: a.url, name: a.name })
        )
    };
}

async function relayPipe (targetId, message)
{
    const attach = attachOf (message);
    const text = message.content ? message.content : '';
    const files = attach.files ? attach.files.length : 0;
    if (!text && !files) return { ok: false, empty: true };
    let channel = client.channels.cache.get (targetId);
    if (!channel) channel = await client.channels.fetch (targetId).catch (() => null);
    if (!channel || typeof channel.send !== 'function') return { ok: false, notFound: true };
    try
    {
        await sendFit (channel, { content: text ? text : undefined, ...attach });
    }
    catch (e) { return { ok: false, error: e.message }; }
    return { ok: true, channel: channel, text: text, files: files };
}

function dmParse (content, mentions, cmd = 'dm')
{
    let rest = content.slice ((PREFIX + cmd).length);
    let id = null;
    let mentioned = mentions.users.first () || null;
    if (mentioned)
    {
        id = mentioned.id;
        rest = rest.replace (new RegExp ('<@!?' + id + '>', 'g'), '');
    }
    else
    {
        let m = rest.match (/^\s*(?:<@!?(\d{17,20})>|(\d{17,20})(?!\d))/);
        if (m)
        {
            id = m[1] || m[2];
            rest = rest.slice (m[0].length);
        }
    }
    return { id: id, letter: rest.trim () };
}

function isCmd (content, name)
{
    const full = PREFIX + name;
    return content === full || content.startsWith (full + ' ');
}

client.on ('messageCreate', async message =>
{
    if (message.author.bot) return;
    if ([ChannelType.GuildText, ChannelType.DM].includes (message.channel.type))
    {
        if (isCmd (message.content, 'ping'))
        {
            message.channel.send
            (
                {
                    content: 'pong'
                }
            )
            .catch (e => console.error ('[' + (d()) + '] [cmd] ping: ' + e.message));
        }

        if (isCmd (message.content, 'help'))
        {
            sendHelpDm (message.author, message.guild ? message.guild.id : null)
            .then (() => console.log ('[' + (d()) + '] [dm] help -> ' + uu (message.author) + ' -- отправлено'))
            .catch (e => console.error
            (
                '[' + (d()) + '] [dm] help -> ' + uu (message.author) + ': ЛС не ушло (' + e.message + ')'
            ));
        }

        if (isCmd (message.content, 'test'))
        {
            sendFit (message.author, { content: 'pong 🐼 ЛС работают.' })
            .then
            (
                () => console.log ('[' + (d()) + '] [dm] self-test -> ' + message.author.username + ' -- отправлено')
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
            if (message.channel.id === _pipe_channel_source)
            {
                const relay = await relayPipe (_pipe_channel_target, message);
                const _shown = relay.text
                    ? '"' + relay.text + '"' + (relay.files ? ' + <ATTACH>' : '')
                    : '<ATTACH>';
                if (relay.empty)
                {
                    console.log
                    (
                        '[' + (d()) + '] [pipe] сообщение от ' + message.author.username +
                        ' НЕ переслано: Discord не отдал ни текст, ни файлы' +
                        ' (нужен интент Message Content -- см. config.json / README)'
                    );
                }
                else if (relay.ok)
                {
                    console.log
                    (
                        '[' + (d()) + '] [pipe] ' +
                        'message from bot (by ' + message.author.username + '): ' + _shown
                    );
                    await message.delete ().catch
                    (
                        e => console.error ('[' + (d()) + '] [pipe] не смог удалить оригинал: ' + e.message)
                    );
                }
                else if (relay.notFound)
                {
                    console.log
                    (
                        '[' + (d()) + '] ' +
                        '[_CHANNEL_NOT_FOUND_] ' +
                        'message from bot (by ' + message.author.username + '): ' + _shown
                    );
                }
                else
                {
                    console.error
                    (
                        '[' + (d()) + '] [pipe] НЕ переслано (' + relay.error +
                        ') -- сообщение оставлено в источнике'
                    );
                }
            }
        }
        const server = message.guild.id;
        if (server in SERVERS && SERVERS[server].allow)
        {
            if (message.content.startsWith (PREFIX))
            {
                console.log ('[' + (d()) + '] [cmd] ' + (message.member ? uuu (message.member) : message.author.username) + ': ' + message.content.slice (0, 120));
                if (isCmd (message.content, 'file'))
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
                else if (isCmd (message.content, 'pretty'))
                {
                    message.channel.send
                    (
                        {
                            embeds:
                            [
                                {
                                    color: 0xFF0000,
                                    author:
                                    {
                                        name: uu (message.author),
                                        icon_url: message.author.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                    },
                                    thumbnail:
                                    {
                                        url: message.author.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                    },
                                    title: 'Предупреждение',
                                    description: `${message.author}` + ', ```Вы забанены.```',
                                    footer:
                                    {
                                        text: SERVERS[server].name,
                                    },
                                    timestamp: dt(),
                                },
                            ],
                        }
                    )
                    .catch (console.error);
                }
                else if (isCmd (message.content, 'dm'))
                {
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
                            sendFit (user, {content: letter ? letter : undefined, ...attach})
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
                else if (isCmd (message.content, 'welcome'))
                {
                    const is_admin = !!message.member && !!SERVERS[server].role_admin &&
                        message.member._roles.includes (SERVERS[server].role_admin);
                    const { id } = dmParse (message.content, message.mentions, 'welcome');
                    const targetId = id || message.author.id;
                    if (!welcomeLink (server))
                        return message.channel.send
                        ({ content: '⚠️ Приветствие выключено: канал для приветствий не задан (или он неверный).' })
                        .catch (console.error);
                    if (id && !is_admin)
                        return message.channel.send
                        ({ content: '🚫 Другому -- только админ. Без аргумента пришлю тебе.' })
                        .catch (console.error);
                    let user = client.users.cache.get (targetId) ||
                        await client.users.fetch (targetId).catch (() => null);
                    if (!user)
                        return sendFit (message.channel, { content: '🤔 Пользователь `' + targetId + '` не найден.' })
                        .catch (console.error);
                    const who = message.member ? uuu (message.member) : message.author.username;
                    const res = await welcomeCheckSend (server, user, who);
                    if (res.ok)
                    {
                        sendFit (message.channel, { content: '✅ Приветствие отправлено в ЛС: ' + u (user.id) }).catch (console.error);
                        message.delete ().catch (console.error);
                    }
                    else
                        sendFit (message.channel, { content: '⚠️ ' + res.why }).catch (console.error);
                }
                else if (isCmd (message.content, 'test'))
                {
                    message.delete ().catch (console.error);
                }
                else if (isCmd (message.content, 'help'))
                {
                    message.delete ().catch (console.error);
                }
            }
        }
    }
});
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

async function ownersOf (channel)
{
    var owners = channel
       .permissionOverwrites
            .cache
                .filter
                (
                    permission =>
                        permission.type === 1 &&
                        permission.allow.has (PermissionsBitField.Flags.ManageChannels)
                );
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
    return owners;
}

function isStaff (server, member)
{
    return !!member &&
    (
        (SERVERS[server].role_admin && member.roles.cache.has (SERVERS[server].role_admin)) ||
        (SERVERS[server].role_moder && member.roles.cache.has (SERVERS[server].role_moder))
    );
}

const TAG_DEFAULT = '🔑';
const NICK_MAX = 32;
function tagEnabled (server)
{
    const s = SERVERS[server] || {};
    return s.tag_add === true;
}
function tagOf (server)
{
    const raw = SERVERS[server] ? SERVERS[server].tag : undefined;
    if (typeof raw !== 'string') return TAG_DEFAULT;
    return raw;
}
function nickHasTag (server, nick)
{
    const tag = tagOf (server);
    return !!tag && String (nick === undefined || nick === null ? '' : nick).startsWith (tag);
}
function nickWithTag (server, nick)
{
    const cp = s => [...String (s === undefined || s === null ? '' : s)];
    return [...cp (tagOf (server)).slice (0, NICK_MAX), ...cp (nick)].slice (0, NICK_MAX).join ('');
}
function nickWithoutTag (server, nick)
{
    const tag = tagOf (server);
    let s = String (nick === undefined || nick === null ? '' : nick);
    const strip = p => { if (p && s.startsWith (p)) s = s.slice (p.length); };
    strip (tag);
    if (TAG_DEFAULT && TAG_DEFAULT !== tag) strip (TAG_DEFAULT);
    strip (tag);
    return s;
}
const $nickSet = {};
function nickSetMark (server, uid, hasTag)
{
    if (!server) return;
    const map = $nickSet[server] = $nickSet[server] || new Map ();
    map.set (uid, !!hasTag);
}
async function setNickLogged (member, newNick, server)
{
    await member.setNickname (newNick);
    member.nickname = newNick;
    nickSetMark (server, member.user.id, nickHasTag (server, newNick));
}

async function modNick (server, member)
{
    const tag = tagOf (server);
    if (tag && tagEnabled (server))
    {
        if (!member.user.bot)
        {
            let nick = member.nickname || member.user.username;
            if (isStaff (server, member))
            {
                if (nick.startsWith (tag))
                {
                    console.log ('[' + (d()) + '] [nick] -' + tag + ' (staff) ' + member.user.username);
                    await setNickLogged (member, nickWithoutTag (server, nick), server)
                        .catch (e => console.error ('[nick] ошибка смены ника: ' + e.message));
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
                if (!nick.startsWith (tag))
                {
                    const nickNew = nickWithTag (server, nickWithoutTag (server, nick));
                    console.log ('[' + (d()) + '] [nick] +' + tag + ' ' + member.user.username + ' в ' + member.voice.channel.name +
                        (nickNew !== tag + nick ? ' (ник укоротил справа: "' + nick + '" -> "' + nickNew + '")' : ''));
                    await setNickLogged (member, nickNew, server)
                        .catch (e => console.error ('[nick] ошибка смены ника: ' + e.message));
                }
            }
            else
            {
                const nickNew = nickWithoutTag (server, nick);
                if (nickNew !== nick)
                {
                    console.log ('[' + (d()) + '] [nick] -' + tag + ' ' + member.user.username);
                    await setNickLogged (member, nickNew, server)
                        .catch (e => console.error ('[nick] ошибка смены ника: ' + e.message));
                }
            }
        }
    }
}

client.on ('channelCreate', async (newChannel) =>
{
    const guild = newChannel.guild ?? client.guilds.cache.get (newChannel.guildId);
    if (guild)
    {
        const server = guild.id;
        if (server in SERVERS && SERVERS[server].allow)
        {
            console.log ('[' + (d()) + '] [channel] создан ' + (newChannel.parent ? '«' + newChannel.parent.name + '» / ' : '') + '«' + newChannel.name + '»');
            let log_channel = SERVERS[server].log_channel;
            if (newChannel.type === ChannelType.GuildVoice)
            {
var bitrate = 64;
                switch (newChannel.guild.premiumTier)
                {
                       case   'NONE': bitrate =  96; break;
                       case 'TIER_1': bitrate = 128; break;
                       case 'TIER_2': bitrate = 256; break;
                       case 'TIER_3': bitrate = 384; break;
                }
                newChannel.setBitrate (bitrate * 1000)
                .catch (e => console.error ('[channelCreate] ошибка битрейта: ' + e.message));
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
                    newChannel.permissionOverwrites.edit
                    (
                        id,
                        {
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
                            await modNick
                            (
                                server, owner
                            )
                            .catch (console.error);
                            if (log_channel)
                            {
                                let log_text = `${owner.user}` + ' **получает** 💪 права на канал `' + code(cc(newChannel)) + '` 🟩';
                                logTo (log_channel).send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                author:
                                                {
                                                    name: uuu (owner),
                                                    icon_url: owner.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                },
                                                color: 0x0000FF,
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
                            console.log ('[' + (d()) + '] ' + owner.user.username + ' получил права в ' + newChannel.name);
                        }
                    )
                    .catch (e => console.error ('[channelUpdate] ошибка прав канала: ' + e.message));
                }
            }
        }
    }
});

client.on ('channelDelete', (channel) =>
{
    const server = channel.guild ? channel.guild.id : '';
    if (server in SERVERS && SERVERS[server].allow)
        console.log ('[' + (d()) + '] [channel] удалён ' + (channel.parent ? '«' + channel.parent.name + '» / ' : '') + '«' + channel.name + '»');
});

client.on ('channelUpdate', async (oldChannel, newChannel) =>
{
    const guild = newChannel.guild ?? client.guilds.cache.get (newChannel.guildId);
    const server = guild.id;
    if (server in SERVERS && SERVERS[server].allow)
    {
        if (newChannel.type === ChannelType.GuildVoice)
        {
            let log_channel = SERVERS[server].log_channel;
            let oldOwners = await ownersOf (oldChannel);
            let owners = await ownersOf (newChannel);
            if (oldChannel.name !== newChannel.name)
            {
                if (log_channel)
                {
                    let log_text = 'Канал `' + code(cc(oldChannel)) + '` **переименован** ➡️ в `' + code(cc(newChannel)) + '` 🟦';
                    logTo (log_channel).send
                    (
                        {
                            embeds:
                            [
                                {
                                    author:
                                    {
                                        name: 'Владельцы канала: ' + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*'),
                                    },
                                    color: 0x0000FF,
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
                console.log ('[' + (d()) + '] канал ' + oldChannel.name + ' переименован в ' + newChannel.name);
            }
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
                            id,
                            {
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
                                await modNick
                                (
                                    server, owner
                                )
                                .catch (console.error);
                                if (log_channel)
                                {
                                    let log_text = `${owner.user}` + ' **получает** 💪 права на канал `' + code(cc(newChannel)) + '` 🟩';
                                    logTo (log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (owner),
                                                        icon_url: owner.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0x0000FF,
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
                                console.log ('[' + (d()) + '] ' + owner.user.username + ' получил права в ' + newChannel.name);
                            }
                        )
                        .catch (e => console.error ('[channelUpdate] ошибка прав канала: ' + e.message));
                    }
                    else
                    {
                    }
                }
                else
                {
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
        const server = newMember.guild.id;
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

const $audit = [];

function isMuteDeafChange (changes)
{
    return (changes || []).some (c => /^\$?(mute|deaf)$/i.test (String (c.key)));
}

const $roleChanges = [];

function roleDeltaOf (changes)
{
    const add = [], remove = [];
    for (const c of (changes || []))
    {
        const key = String ((c && c.key) || '');
        const arr = (key === '$add') ? c.new : ((key === '$remove') ? c.old : null);
        if (!Array.isArray (arr)) continue;
        for (const r of arr)
        {
            const id = (r && r.id) ? String (r.id) : '';
            if (!id) continue;
            if (key === '$add') { if (!add.includes (id)) add.push (id); }
            else if (!remove.includes (id)) remove.push (id);
        }
    }
    return { add: add, remove: remove };
}

client.on ('guildAuditLogEntryCreate', (entry, guild) =>
{
    try
    {
        if (!guild || !SERVERS[guild.id] || !SERVERS[guild.id].allow) return;
        if (entry.action === AuditLogEvent.MemberRoleUpdate)
        {
            const d = roleDeltaOf (entry.changes);
            if (entry.targetId && (d.add.length || d.remove.length))
            {
                $roleChanges.push ({ targetId: entry.targetId, add: d.add, remove: d.remove, at: Date.now () });
                if ($roleChanges.length > 300) $roleChanges.splice (0, $roleChanges.length - 300);
            }
            return;
        }
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
    catch (e) { console.error ('[audit] ошибка: ' + e.message); }
});

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
    catch (e) {  }
    return null;
}

function whoText (who)
{
    if (!who) return '';
    return '(кто: ' + ((client.user && who === client.user.username) ? 'бот' : who) + ') ';
}

function logTo (channelId)
{
    return {
        send: async (payload) =>
        {
            if (!channelId) return;
            try
            {
                let ch = client.channels.cache.get (channelId);
                if (!ch) ch = await client.channels.fetch (channelId);
                if (!ch || typeof ch.send !== 'function')
                {
                    console.error ('[log] канал журнала ' + channelId + ' недоступен -- запись пропущена');
                    return;
                }
                await sendFit (ch, payload);
            }
            catch (e)
            {
                console.error ('[log] запись в журнал ' + channelId + ' не удалась: ' + e.message);
            }
        },
    };
}

function appealLog (server, state)
{
    let log_channel = SERVERS[server].log_channel || '';
    if (log_channel)
    {
        let log_text = 'На ' + `${state.member}` + ' поступила 🚫 **жалоба** в канале ' + code (cc (state.channel)) + ' 🆘';
        logTo (log_channel).send
        (
            {
                embeds:
                [
                    {
                        author:
                        {
                            name: uuu (state.member),
                            icon_url: state.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                        },
                        color: 0xFF0000,
                        description: log_text,
                        footer:
                        {
                            text: SERVERS[server].name,
                        },
                        timestamp: dt(),
                    },
                ]
            }
        );
    }
    console.log ('[' + (d()) + '] ' + state.member.user.username + ' подал апелляцию в ' + state.channel.name);
}

function logAction (guild, action, targetId, text)
{
    setTimeout (() =>
    {
        auditWho (guild, action, targetId, 20000)
        .then (who => console.log ('[' + (d()) + '] ' + whoText (who) + text))
        .catch (() => console.log ('[' + (d()) + '] ' + text));
    }, 700);
}

function byWhom (guild, action, text)
{
    setTimeout (() =>
    {
        auditWho (guild, action, null, 12000)
        .then (who => { if (who) console.log ('[' + (d()) + '] ' + whoText (who) + text); })
        .catch (() => {});
    }, 1500);
}

function logVoiceEvent (oldState, newState)
{
    try
    {
        if (!newState.member || newState.member.user.bot) return;
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
    catch (e) { console.error ('[voice] ошибка записи в лог: ' + e.message); }
}

client.on ('voiceStateUpdate', async (oldState, newState) =>
{
    const server = newState.guild.id;
    if (server in SERVERS && SERVERS[server].allow)
    {
        logVoiceEvent (oldState, newState);
        if (newState.id === client.user.id)
        {
            const from = oldState.channelId, to = newState.channelId;
            const mSelf = $music[server];
            if (from && to && from !== to)
            {
                const oldCh = client.channels.cache.get (from);
                console.log ('[' + (d()) + '] [music] бота перенесли: «' +
                    (oldCh ? oldCh.name : from) + '» -> «' +
                    (newState.channel ? newState.channel.name : to) + '»');
                clearVoiceStatus (from);
                if (mSelf) { mSelf.savedChannelId = to; mSelf.pending = false; mSelf.leftByUser = false; }
                writeVoiceState (server, to, false);
                scheduleVoiceStatus (server, true);
                schedulePresence (true);
                setTimeout (() => checkListeners (server), 500);
            }
            else if (from && !to)
            {
                const selfLeft = !!(mSelf && mSelf.selfLeftAt && Date.now () - mSelf.selfLeftAt < 15000);
                if (mSelf) mSelf.selfLeftAt = 0;
                if (!selfLeft)
                    console.log ('[' + (d()) + '] [music] бота выключили/выкинули из голосового канала -- очередь помню');
            }
        }
        scheduleVoiceStatus (server);
        checkListeners (server);
        await modNick
        (
            server, newState.member
        )
        .catch (console.error);
        let temp_lobby = SERVERS[server].temp_lobby || '';
        let temp_category = SERVERS[server].temp_category || '';
        if (temp_lobby && newState.channelId === temp_lobby)
            await tempCreateFor (server, newState.member).catch (console.error);
        if (oldState.channelId && (oldState.channelId === temp_lobby ||
            (oldState.channel && oldState.channel.parentId === temp_category)))
            await tempSweep (server).catch (console.error);
        if (newState.channel === null && newState.channelId)
        {
            if (newState.serverMute)
            {
                newState.setMute (false)
                .catch (console.error);
            }
            if (newState.serverDeaf)
            {
                newState.setDeaf (false)
                .catch (console.error);
            }
        }
        if (newState.channel && newState.channel.id)
        {
            let log_channel = SERVERS[server].log_channel || '';
            let channel_common = SERVERS[server].channel_common || '';
            const _botMember = !!(newState.member && newState.member.user && newState.member.user.bot);
            const _asMember = !_botMember || (client.user && newState.id !== client.user.id);
            if (_asMember)
            {
                let owners = await ownersOf (newState.channel);
                if (!newState.channel.id) return;
                if (oldState.serverMute === null)
                    oldState.serverMute = newState.serverMute;
                if (oldState.serverDeaf === null)
                    oldState.serverDeaf = newState.serverDeaf;
                if (newState.channel.id === channel_common)
                {
                    if (newState.serverMute)
                    {
                        newState.setMute (false)
                        .catch (e => console.error ('[voiceStateUpdate] общий канал, снятие мута: ' + e.message));
                        appealLog (server, newState);
                    }
                    if (newState.serverDeaf)
                    {
                        newState.setDeaf (false)
                        .catch (e => console.error ('[voiceStateUpdate] общий канал, снятие глухоты: ' + e.message));
                        console.log ('[' + (d()) + '] [voice] общий канал: снят деф с ' + uuu (newState.member));
                    }
                    return;
                }
                if (!oldState.serverMute && newState.serverMute)
                {
                    if
                    (
                        !newState.channel.permissionOverwrites.cache.get(newState.id) ||
                        !newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Speak)
                    )
                    {
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
                                    let notify_text =                                    `${newState.member}, вам **запрещено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟨\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                    if (!_botMember)
                                    newState.member.send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    color: 0xFFFF00,
                                                    description: notify_text,
                                                },
                                            ]
                                        }
                                    )
                                    .catch (e => console.error ('[voiceStateUpdate] ошибка ЛС участнику: ' + e.message));
                                    if (log_channel)
                                    {
                                        let log_text =
                                            `${newState.member} **запрещено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟨\n` +
                                            `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                            `Подробности смотрите в журнале аудита.`;
                                        logTo (log_channel).send
                                        (
                                            {
                                                embeds:
                                                [
                                                    {
                                                        author:
                                                        {
                                                            name: uuu (newState.member),
                                                            icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                        },
                                                        color: 0xFFFF00,
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
                else if (!oldState.serverDeaf && newState.serverDeaf)
                {
                    const skipDeaf = Array.isArray (SERVERS[server].deaf_exempt) ? SERVERS[server].deaf_exempt : [];
                    if (skipDeaf.some (x => x === newState.channel.id || x === newState.channel.name)) return;
                    if (_botMember)
                    {
                        console.log ('[' + (d()) + '] [voice] деф боту ' + uuu (newState.member) + ' в «' +
                            code (cc (newState.channel)) + '»: запомнил, но запрет Connect ботам не пишу' + ' (в общий канал не переношу)');
                        logAction (newState.guild, AuditLogEvent.MemberUpdate, newState.id,
                            newState.member.user.username + ' get deaf in ' + newState.channel.name);
                    }
                    else if
                    (
                        !newState.channel.permissionOverwrites.cache.get(newState.id) ||
                        !newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Connect)
                    )
                    {
                        newState.channel.permissionOverwrites.edit
                        (
                            newState.id,
                            {
                                Connect: false,
                            }
                        )
                        .then
                        (
                            async channel =>
                            {
                                if (channel_common && channel.id !== channel_common)
                                {
                                    if (await moveToVoice (newState, channel_common, 'Запрещённый канал (deaf)'))
                                    {
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
                                    .catch (e => console.error ('[voiceStateUpdate] ошибка кика: ' + e.message));
                                }
                                let notify_text =
                                    `${newState.member}, вам **запрещено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟥\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                if (!_botMember)
                                newState.member.send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                color: 0xFF0000,
                                                description: notify_text,
                                            },
                                        ]
                                    }
                                )
                                .catch (e => console.error ('[voiceStateUpdate] ошибка ЛС участнику: ' + e.message));
                                if (log_channel)
                                {
                                    let log_text =
                                        `${newState.member}, **запрещено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟥\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    logTo (log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (newState.member),
                                                        icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0xFF0000,
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
                else if (oldState.serverMute && !newState.serverMute)
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
                                let notify_text =
                                    `${newState.member}, вам **разрешено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟩\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                if (!_botMember)
                                newState.member.send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                color: 0x00FF00,
                                                description: notify_text,
                                            },
                                        ]
                                    }
                                )
                                .catch (e => console.error ('[voiceStateUpdate] ошибка ЛС участнику: ' + e.message));
                                if (log_channel)
                                {
                                    let log_text =
                                        `${newState.member} **разрешено** 🗣️ говорить в канале \`${code(cc(channel))}\` 🟩\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    logTo (log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (newState.member),
                                                        icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0x00FF00,
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
                else if (oldState.serverDeaf && !newState.serverDeaf)
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
                                Connect: null,
                            }
                        )
                        .then
                        (
                            channel =>
                            {
                                let notify_text =
                                    `${newState.member}, вам **разрешено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟩\n` +
                                    `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                    `Подробности смотрите в журнале аудита.`;
                                if (!_botMember)
                                newState.member.send
                                (
                                    {
                                        embeds:
                                        [
                                            {
                                                color: 0x00FF00,
                                                description: notify_text,
                                            },
                                        ]
                                    }
                                )
                                .catch (e => console.error ('[voiceStateUpdate] ошибка ЛС участнику: ' + e.message));
                                if (log_channel)
                                {
                                    let log_text =
                                        `${newState.member}, **разрешено** 🔌 подключаться в канал \`${code(cc(channel))}\` 🟩\n` +
                                        `Владельцы канала: ` + (owners.size ? owners.map (owner => uuu (owner)).join (', ') : '*offline*') + `\n` +
                                        `Подробности смотрите в журнале аудита.`;
                                    logTo (log_channel).send
                                    (
                                        {
                                            embeds:
                                            [
                                                {
                                                    author:
                                                    {
                                                        name: uuu (newState.member),
                                                        icon_url: newState.member.user.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                                                    },
                                                    color: 0x00FF00,
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
                else
                {
                    if
                    (
                        newState.channel.permissionOverwrites.cache.get(newState.id) &&
                        newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Speak)
                    )
                    {
                        if (!newState.serverMute)
                        {
                            newState.setMute (true)
                            .catch (console.error);
                        }
                    }
                    else
                    {
                        if (newState.serverMute)
                        {
                            newState.setMute (false)
                            .catch (console.error);
                        }
                    }
                    if
                    (
                        newState.channel.permissionOverwrites.cache.get(newState.id) &&
                        newState.channel.permissionOverwrites.cache.get(newState.id).deny.has(PermissionsBitField.Flags.Connect)
                    )
                    {
                        if (!newState.serverDeaf)
                        {
                            newState.setDeaf (true)
                            .catch (console.error);
                        }
                    }
                    else
                    {
                        if (newState.serverDeaf)
                        {
                            newState.setDeaf (false)
                            .catch (console.error);
                        }
                    }
                }
            }
            else
            {
            };
        }
    }
});

const POLL_PERIOD = 45 * 1000;

var $membersSnapshot = {};
var $pollWarnAt = {};
var $membersSnapshotAt = {};

async function resolveUser (uid, raw)
{
    let user = client.users.cache.get (uid);
    if (!user) user = await client.users.fetch (uid).catch (() => null);
    if (user) return user;
    let stub =
    {
        id: uid,
        username: (raw && raw.user && raw.user.username) || uid,
        displayAvatarURL: () => null,
        toString: () => '<@' + uid + '>',
    };
    return stub;
}

const MEMBER_EVENT_TTL = 5 * 60 * 1000;
var $memberEvent = {};

function memberEventMark (server, uid, isJoin)
{
    if (!$memberEvent[server]) $memberEvent[server] = new Map ();
    const map = $memberEvent[server];
    map.set (uid, { at: Date.now (), join: !!isJoin });
    if (map.size > 300)
        for (const [id, rec] of map)
            if (Date.now () - rec.at > MEMBER_EVENT_TTL) map.delete (id);
}

function memberEventFresh (server, uid, isJoin)
{
    const map = $memberEvent[server];
    if (!map) return false;
    const rec = map.get (uid);
    if (!rec) return false;
    return (rec.join === !!isJoin) && (Date.now () - rec.at <= MEMBER_EVENT_TTL);
}

function rawOfMember (member)
{
    return {
        user: { id: member.id, username: (member.user && member.user.username) || member.id },
        roles: member.roles ? [...member.roles.cache.keys ()] : null,
        nick: member.nickname || null,
    };
}

async function handleMemberEvent (member, isJoin)
{
    try
    {
        const server = member && member.guild ? member.guild.id : null;
        if (!server || !(server in SERVERS) || !SERVERS[server].allow) return;
        if (member.user && member.user.bot) return;
        const uid = member.id;
        if (memberEventFresh (server, uid, isJoin)) return;
        memberEventMark (server, uid, isJoin);
        if (member.partial)
        {
            try { await member.fetch (); }
            catch (e) {  }
        }
        const raw = rawOfMember (member);
        const who = (member.user && member.user.username) ? member.user : await resolveUser (uid, raw);
        console.log ('[' + (d()) + '] участник ' + who.username + (isJoin ? ' ЗАШЁЛ на ' : ' ВЫШЕЛ с ') +
            SERVERS[server].name + ' (мгновенно)');
        if (isJoin)
        {
            await logMemberJoinLeave (server, who, true);
            await restoreMemberRoles (server, uid, raw);
            await handleMemberJoin (server, uid, raw);
        }
        else
        {
            await logMemberJoinLeave (server, who, false);
            await handleMemberLeave (server, uid, raw, Date.now ());
        }
        const snap = $membersSnapshot[server];
        if (snap)
        {
            if (isJoin) snap.set (uid, raw); else snap.delete (uid);
            $membersSnapshotAt[server] = Date.now ();
        }
    }
    catch (e)
    {
        console.error ('[memberEvent] ' + (isJoin ? 'вход' : 'выход') + ': ' + oneLine (e.message));
    }
}

client.on ('guildMemberAdd',    member => { void handleMemberEvent (member, true); });
client.on ('guildMemberRemove', member => { void handleMemberEvent (member, false); });

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
        let author = {name: memberUser.username};
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
                        color: isJoin ? 0x00FF00 : 0xFF0000,
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
        console.error ('[member] запись входа/выхода: ' + e.message);
    }
}

function plural (n, one, few, many)
{
    const a = Math.abs (n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
}

async function storedBans (server)
{
    let active = [], expired = [];
    try
    {
        for await (const [id, until] of $db[server]['membersBanTimeout'].iterator())
        {
            if (typeof until !== 'number') continue;
            if (Date.now() < until) active.push ({ id, until });
            else expired.push ({ id, until });
        }
    }
    catch (e) { console.error ('[ban] не смог прочитать базу: ' + oneLine (e.message)); }
    active.sort ((a, b) => a.until - b.until);
    return { active, expired };
}

async function guildBans (server)
{
    const guild = client.guilds.cache.get (server);
    const map = new Map ();
    if (!guild) return map;
    try
    {
        const bans = await guild.bans.fetch ();
        for (const [id, ban] of bans) map.set (id, (ban && ban.reason) || '');
    }
    catch (e) { console.error ('[ban] список банов не получен: ' + oneLine (e.message)); }
    return map;
}

const $banTimers = {};
function banTimerSet (server, uid, ms, fn)
{
    const map = $banTimers[server] = $banTimers[server] || new Map ();
    banTimerClear (server, uid);
    const t = setTimeout
    (
        () =>
        {
            if (map.get (uid) === t) map.delete (uid);
            try { fn (); } catch (e) { console.error ('[ban] таймер ' + uid + ': ' + oneLine (e.message)); }
        },
        ms
    );
    map.set (uid, t);
    return t;
}
function banTimerFor (server, uid)
{
    const map = $banTimers[server];
    return !!(map && map.get (uid));
}
function banTimerClear (server, uid)
{
    const map = $banTimers[server];
    if (!map) return false;
    const t = map.get (uid);
    if (!t) return false;
    clearTimeout (t);
    map.delete (uid);
    return true;
}

function banHistoryDays (server)
{
    const days = Number ((SERVERS[server] || {}).bans_history_days);
    if (!Number.isFinite (days)) return 0;
    return (days > 0) ? Math.floor (days) : 0;
}

function banHistoryLabel (server)
{
    const days = banHistoryDays (server);
    return days ? ('за ' + days + ' дн') : 'за всё время';
}

async function banHistoryAdd (server, uid, kind)
{
    if (!uid || !(kind in { exit: 1, timeout: 1, ban: 1, unban: 1 })) return;
    try
    {
        const days = banHistoryDays (server);
        const cut = days ? Date.now () - days * 86400000 : 0;
        let rec = await db (server, 'banHistory', uid);
        let events = (rec && Array.isArray (rec.events)) ? rec.events : [];
        events.push ({ at: Date.now (), kind: kind });
        events = events.filter (e => e && typeof e.at === 'number' && e.at >= cut).slice (-200);
        await db (server, 'banHistory', uid, { at: Date.now (), events: events });
    }
    catch (e) { console.error ('[ban] не смог записать историю ' + uid + ': ' + oneLine (e.message)); }
}

async function bansHistory (server)
{
    const days = banHistoryDays (server);
    const cut = days ? Date.now () - days * 86400000 : 0;
    const rows = [];
    try
    {
        for await (const [id, rec] of $db[server]['banHistory'].iterator())
        {
            const events = (rec && Array.isArray (rec.events))
                ? rec.events.filter (e => e && typeof e.at === 'number' && e.at >= cut)
                : [];
            if (!events.length) continue;
            const c = k => events.filter (e => e.kind === k).length;
            rows.push ({ id: id, exit: c ('exit'), timeout: c ('timeout'), ban: c ('ban'),
                         unban: c ('unban'), last: Math.max (...events.map (e => e.at)) });
        }
    }
    catch (e) { console.error ('[ban] история не прочиталась: ' + oneLine (e.message)); }
    rows.sort ((a, b) => (b.ban - a.ban) || (b.exit - a.exit) || (b.last - a.last));
    return rows;
}

async function sweepBanHistory (server)
{
    if (!banHistoryDays (server)) return;
    const cut = Date.now () - banHistoryDays (server) * 86400000;
    let keys = [];
    try
    {
        for await (const [id, rec] of $db[server]['banHistory'].iterator())
        {
            const events = (rec && Array.isArray (rec.events)) ? rec.events : [];
            if (!events.some (e => e && typeof e.at === 'number' && e.at >= cut)) keys.push (id);
        }
        for (const key of keys) await db (server, 'banHistory', key, null);
    }
    catch (e) { console.error ('[ban] уборка истории: ' + oneLine (e.message)); return; }
    if (keys.length)
        console.log ('[' + (d()) + '] [ban] истёк срок хранения истории ' + banHistoryDays (server) +
            ' дн (bans_history_days): удалено из базы ' + keys.length + ' ' +
            plural (keys.length, 'запись', 'записи', 'записей') + ' -- событий в них уже не было, активные наказания не тронуты');
}

async function namesFor (ids)
{
    const map = new Map ();
    for (const id of [...new Set (ids)].slice (0, 40))
    {
        let user = client.users.cache.get (id);
        if (!user) user = await client.users.fetch (id).catch (() => null);
        map.set (id, user ? user.username : id);
    }
    return map;
}

async function bansOverview (server)
{
    const { active, expired } = await storedBans (server);
    const bans = await guildBans (server);
    const hist = await bansHistory (server);
    const names = await namesFor ([...active.map (a => a.id), ...hist.map (h => h.id)]);
    const leaveBan = flagOn (server, 'onLeaveBanRealy') && (SERVERS[server].onLeaveBanTimeout || 0) > 0;
    const rows = active.map (a =>
    ({
        id: a.id,
        until: a.until,
        isBan: bans.has (a.id),
        reason: bans.get (a.id) || '',
        name: names.get (a.id) || a.id,
        left: dd (a.until),
        at: d (a.until, true),
        unconfirmed: leaveBan && !bans.has (a.id),
    }));
    const histRows = hist.slice (0, 10).map (h => Object.assign ({}, h, { name: names.get (h.id) || h.id }));
    return { rows, expired, hist, histRows, histDays: banHistoryDays (server) };
}

const MSG_TEXT_LIMIT = 2000;

function fitMsgText (text, limit = MSG_TEXT_LIMIT)
{
    if (text.length <= limit) return text;
    const cut = text.lastIndexOf ('\n', limit - 120);
    return (cut > 0 ? text.slice (0, cut) : text.slice (0, limit - 120)) +
        '\n_…показано не всё: ответ не влезает в лимит Discord (' + limit + ' символов)._ ';
}

const DISCORD_CONTENT_MAX   = 2000;
const DISCORD_EMBEDS_MAX    = 10;
const DISCORD_TITLE_MAX     = 256;
const DISCORD_DESC_MAX      = 4096;
const DISCORD_FIELDS_MAX    = 25;
const DISCORD_FIELD_NAME_MAX = 256;
const DISCORD_FIELD_VALUE_MAX = 1024;
const DISCORD_FOOTER_MAX    = 2048;
const DISCORD_AUTHOR_MAX    = 256;
const DISCORD_EMBED_SUM_MAX = 6000;

function fitContent (text, limit = DISCORD_CONTENT_MAX) { return fitMsgText (String (text), limit); }

function fitEmbed (embed)
{
    let out;
    try
    {
        const raw = (embed && typeof embed.toJSON === 'function') ? embed.toJSON () : embed;
        out = JSON.parse (JSON.stringify (raw || {}));
    }
    catch (e) { return null; }
    if (!out || typeof out !== 'object') return null;
    if (typeof out.title === 'string') out.title = clipText (out.title, DISCORD_TITLE_MAX);
    if (typeof out.description === 'string') out.description = fitMsgText (out.description, DISCORD_DESC_MAX);
    if (out.author && typeof out.author.name === 'string')
        out.author.name = clipText (out.author.name, DISCORD_AUTHOR_MAX);
    if (out.footer && typeof out.footer.text === 'string')
        out.footer.text = clipText (out.footer.text, DISCORD_FOOTER_MAX);
    if (Array.isArray (out.fields))
        out.fields = out.fields.slice (0, DISCORD_FIELDS_MAX).map (f =>
        ({
            name: clipText (String ((f && f.name) || '').trim () || ' ', DISCORD_FIELD_NAME_MAX),
            value: clipText (String ((f && f.value) || '').trim () || ' ', DISCORD_FIELD_VALUE_MAX),
            inline: !!(f && f.inline),
        }));
    const embedSum = o =>
    {
        let n = String (o.title || '').length + String (o.description || '').length;
        if (o.footer && o.footer.text) n += String (o.footer.text).length;
        if (o.author && o.author.name) n += String (o.author.name).length;
        for (const f of (Array.isArray (o.fields) ? o.fields : []))
            n += String ((f && f.name) || '').length + String ((f && f.value) || '').length;
        return n;
    };
    if (embedSum (out) > DISCORD_EMBED_SUM_MAX && typeof out.description === 'string')
        out.description = fitMsgText (out.description,
            Math.max (120, out.description.length - (embedSum (out) - DISCORD_EMBED_SUM_MAX)));
    for (let guard = 0; guard < 500 && embedSum (out) > DISCORD_EMBED_SUM_MAX && (out.fields || []).length; guard++)
    {
        const fieldSum = f => String (f.name || '').length + String (f.value || '').length;
        let worst = out.fields[0];
        for (const f of out.fields) if (fieldSum (f) > fieldSum (worst)) worst = f;
        const was = fieldSum (worst);
        if (was <= 2) { out.fields = out.fields.filter (f => f !== worst); continue; }
        worst.value = String (worst.value || '').slice (0, Math.max (1, was - (embedSum (out) - DISCORD_EMBED_SUM_MAX)));
        if (fieldSum (worst) >= was) out.fields = out.fields.filter (f => f !== worst);
    }
    if (embedSum (out) > DISCORD_EMBED_SUM_MAX) delete out.description;
    if (embedSum (out) > DISCORD_EMBED_SUM_MAX) out.fields = [];
    if (embedSum (out) > DISCORD_EMBED_SUM_MAX) delete out.footer;
    if (embedSum (out) > DISCORD_EMBED_SUM_MAX) delete out.author;
    if (embedSum (out) > DISCORD_EMBED_SUM_MAX) return null;
    return out;
}

function fitPayload (payload)
{
    if (typeof payload === 'string') return fitContent (payload);
    if (!payload || typeof payload !== 'object' || Array.isArray (payload)) return payload;
    if (typeof payload.toJSON === 'function') return payload;
    if (payload.constructor && payload.constructor.name === 'MessagePayload') return payload;
    const out = Object.assign ({}, payload);
    if (typeof out.content === 'string') out.content = fitContent (out.content);
    if (Array.isArray (out.embeds)) out.embeds = out.embeds.map (fitEmbed).filter (Boolean).slice (0, DISCORD_EMBEDS_MAX);
    else if (out.embeds && typeof out.embeds === 'object') out.embeds = [fitEmbed (out.embeds)].filter (Boolean);
    return out;
}

function sendFit (target, payload) { return target.send (fitPayload (payload)); }

function shieldOutgoing (interaction)
{
    if (!interaction || interaction.__limitSafe) return interaction;
    interaction.__limitSafe = true;
    for (const m of ['reply', 'editReply', 'followUp', 'update'])
    {
        const orig = interaction[m];
        if (typeof orig !== 'function') continue;
        interaction[m] = function (options, ...rest) { return orig.call (this, fitPayload (options), ...rest); };
    }
    const msg = interaction.message;
    if (msg && typeof msg.edit === 'function' && !msg.__limitSafe)
    {
        msg.__limitSafe = true;
        const origEdit = msg.edit;
        msg.edit = function (options, ...rest) { return origEdit.call (this, fitPayload (options), ...rest); };
    }
    return interaction;
}

function bansReportText (o, max = 20)
{
    const banned = o.rows.filter (r => r.isBan).length;
    let text;
    if (!o.rows.length)
        text = '✅ Активных банов и таймаутов нет' +
            (o.expired.length
                ? ' (просроченных записей в базе: ' + o.expired.length + ' -- бот снимет их в ближайшем тике)'
                : '') + '.';
    else
    {
        const lines = o.rows.slice (0, max).map (r =>
            '• **' + r.name + '** -- ' + (r.isBan ? '🚫 бан' : '⏳ таймаут') +
            (r.unconfirmed ? ' (бан не подтверждён Discord)' : '') +
            ', снимется `' + r.at + '` (через `' + r.left + '`)' +
            (r.reason ? '\n  причина: `' + clipText (oneLine (r.reason, 160), 160) + '`' : ''))
            .join ('\n');
        const unconf = o.rows.filter (r => r.unconfirmed).length;
        text = '🛡️ **Наказания сейчас (' + o.rows.length + ': ' + banned + ' ' + plural (banned, 'бан', 'бана', 'банов') +
            ', ' + (o.rows.length - banned) + ' ' + plural (o.rows.length - banned, 'таймаут', 'таймаута', 'таймаутов') + ')**\n' +
            lines +
            (o.rows.length > max ? '\n*...и ещё ' + (o.rows.length - max) + '*' : '') +
            (unconf ? '\n⚠️ **Бан не подтверждён Discord: ' + unconf + '** -- таймаут в базе есть, а бана у Discord нет,\n' +
                '  хотя по конфигу бот должен был забанить при выходе. Обычно это нехватка права\n' +
                '  «Банить участников» или роль бота НИЖЕ роли человека. Что делать: выдать право /\n' +
                '  поднять роль бота -- бан прилетит сам при следующем перезаходе (таймаут сохранится);\n' +
                '  либо снять наказание вручную: `/unban user:@кто`. Само это не «навсегда»:\n' +
                '  запись уйдёт в конце срока (`снимется …`), ложного разбана при этом не будет.' : '') +
            (o.expired.length ? '\n_Просроченных записей в базе: ' + o.expired.length + ' -- снимутся сами._' : '');
    }
    if (o.hist)
    {
        const days = o.histDays;
        const window = days ? ('За ' + days + ' дн') : 'За всё время';
        if (!o.hist.length)
            text += '\n\n📊 ' + window + ' наказаний не было (история ведётся не с самого начала).';
        else
            text += '\n\n📊 **' + window + ' (' + o.hist.length + ' ' +
                plural (o.hist.length, 'человек', 'человека', 'человек') + '):**\n' +
                o.histRows.map (h =>
                    '• **' + h.name + '** -- выходов ' + h.exit + ', таймаутов ' + h.timeout +
                    ', банов ' + h.ban + (h.unban ? ', снято ' + h.unban : '') +
                    ' _(последнее: ' + d (h.last, true) + ')_').join ('\n') +
                (o.hist.length > o.histRows.length ? '\n*...и ещё ' + (o.hist.length - o.histRows.length) + '*' : '');
    }
    return text;
}

async function reportStoredBans (server)
{
    try
    {
        const o = await bansOverview (server);
        const banned = o.rows.filter (r => r.isBan).length;
        const tail = o.expired.length
            ? '; просроченных записей: ' + o.expired.length + ' -- сниму сейчас (срок вышел, пока бот не работал)'
            : '';
        if (!o.rows.length)
            console.log ('[' + (d()) + '] [ban] из базы поднято 0: активных банов/таймаутов нет -- никто не наказан' + tail);
        else
            console.log ('[' + (d()) + '] [ban] из базы поднято ' + o.rows.length + ' ' +
                plural (o.rows.length, 'активное', 'активных', 'активных') + ' (' + banned + ' ' +
                plural (banned, 'бан', 'бана', 'банов') + ', ' + (o.rows.length - banned) + ' ' +
                plural (o.rows.length - banned, 'таймаут', 'таймаута', 'таймаутов') + '): ' +
                o.rows.map (r => r.name + ' до ' + r.at + ' (осталось ' + r.left +
                    (r.isBan ? ', бан' : (r.unconfirmed
                        ? ', только таймаут -- бан не подтверждён Discord (нет права «Банить участников» или роль бота ниже?)'
                        : ', только таймаут')) + ')').join (' | ') +
                tail);
    }
    catch (e)
    {
        console.error ('[ban] отчёт при старте: ' + e.message);
    }
}

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
        const members = client.guilds.cache.get (server).members;
        for (let [id, until] of rows)
        {
            if (typeof until !== 'number') continue;
            if (Date.now() < until) continue;
            try
            {
                const user = await members.unban (id, 'Таймаут истёк (снято при проверке)');
                await db (server, 'membersBanTimeout', id, null);
                unbannedAny = true;
                console.log ('[' + (d()) + '] участник ' + (user ? user.username : id) + ' разбанен (свип по базе)');
            }
            catch (e)
            {
                if (/Unknown Ban|404/i.test (e.message))
                {
                    await db (server, 'membersBanTimeout', id, null);
                    unbannedAny = true;
                }
                else if (/Missing Permissions|50013|Missing Access|50001/i.test (e.message))
                {
                    await db (server, 'membersBanTimeout', id, null);
                    console.error ('[' + (d()) + '] участник ' + id + ' НЕ разбанен (срок истёк): ' + banWhy (e) +
                        ' -- запись убрал, чтобы не спамить каждый тик; разбань вручную, если бан есть');
                }
                else
                    console.error ('[sweepExpiredBans] ' + id + ': не смог снять бан (' + e.message + ') -- запись оставлена, попробую в следующем тике');
            }
        }
    }
    catch (e)
    {
        console.error ('[sweepExpiredBans] ошибка: ' + e.message);
    }
    return unbannedAny;
}

async function fetchAllMembersRest (guildId)
{
    let members = new Map();
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

const WELCOME_SRC_TTL = 10 * 60 * 1000;
const $welcomeSrc = {};

function welcomePublicChannel (server)
{
    const s = SERVERS[server] || {};
    const pub = String (s.welcome_public_channel || '');
    return /^\d{17,20}$/.test (pub) ? pub : '';
}
function welcomeLink (server)
{
    const s = SERVERS[server] || {};
    const pub = welcomePublicChannel (server);
    const channel = pub || String (s.welcome_channel || '');
    const message = pub ? String (s.welcome_public_message || '') : String (s.welcome_message || '');
    if (!/^\d{17,20}$/.test (channel)) return null;
    return 'https://discord.com/channels/' + server + '/' + channel +
        (/^\d{17,20}$/.test (message) ? '/' + message : '');
}

async function welcomeSource (server, refresh = false)
{
    const s = SERVERS[server] || {};
    const chId = String (s.welcome_channel || '');
    const msgId = String (s.welcome_message || '');
    if (!/^\d{17,20}$/.test (chId) || !/^\d{17,20}$/.test (msgId)) return null;
    const cached = $welcomeSrc[server];
    if (!refresh && cached && Date.now () - cached.at < WELCOME_SRC_TTL) return cached.data;
    let data = null;
    try
    {
        const ch = client.channels.cache.get (chId) || await client.channels.fetch (chId);
        const msg = ch && ch.messages
            ? (ch.messages.cache.get (msgId) || await ch.messages.fetch (msgId))
            : null;
        if (msg)
        {
            const atts = [...msg.attachments.values ()];
            const isImg = a => /^image\//.test (a.contentType || '') ||
                /\.(png|jpe?g|gif|webp|avif)$/i.test (a.name || '');
            data = {
                text: (msg.content || '').trim (),
                images: atts.filter (isImg).map (a => a.url),
                files: atts.filter (a => !isImg (a)).map (a => ({ url: a.url, name: a.name || 'файл' })),
                embeds: (msg.embeds || []).length,
            };
        }
    }
    catch (e)
    {
        console.error ('[welcome] не смог прочитать сообщение ' + msgId + ' в канале ' + chId +
            ': ' + oneLine (e.message, 120) + ' -- в приветствии будет только ссылка');
    }
    $welcomeSrc[server] = { at: Date.now (), data };
    return data;
}

async function welcomeEmbed (server, user, refresh = false)
{
    const s = SERVERS[server] || {};
    const link = welcomeLink (server);
    let chName = '';
    const nameChId = welcomePublicChannel (server) || String (s.welcome_channel || '');
    try
    {
        let ch = client.channels.cache.get (nameChId) ||
                 await client.channels.fetch (nameChId);
        if (ch && ch.name) chName = '#' + ch.name;
    }
    catch (e) {  }
    const src = await welcomeSource (server, refresh);
    let rules = '';
    if (src && src.text)
    {
        const cut = clipText (src.text, 1200);
        rules = '\n' + cut + (/\n$/.test (cut) ? '' : '\n');
        if (cut.length < src.text.length) rules += '_(текст длинный -- целиком по ссылке ниже)_\n';
    }
    if (src && src.files.length)
        rules += '📎 Вложение: ' + src.files.map (f => '[' + oneLine (f.name, 40) + '](' + f.url + ')').join (', ') + '\n';
    const prefixOn = s.welcome_prefix !== false;
    const rulesPart =
        `📜 **Правила и знакомство**` + (chName ? ' -- в канале ' + code (chName) : '') + `:` +
        (rules ? rules + '🔗 ' + link + '\n' : '\n' + link + '\n');
    let desc = prefixOn
        ? `${user}, привет! 👋\n\n` + rulesPart +
          `\n🎵 **Музыка:** \`/play ссылка или запрос\`, очередь -- \`/queue\`,\n` +
          `выйти боту из канала -- \`/leave\` (управляют админы, модеры и роль DJ).\n` +
          `📌 Инструкция по боту -- в любой момент \`/help\`.\n` +
          `\nЕсли что-то непонятно или не работает -- напиши администрации.`
        : rulesPart;
    if (desc.length > 4000)
        desc = desc.slice (0, 3950) + '\n_(текст длинный -- целиком по ссылке в этом письме)_';
    const embed =
    {
        color: 0x00CCFF,
        title: '🐼 Добро пожаловать на ' + (s.name || 'сервер') + '!',
        description: desc,
        timestamp: dt(),
    };
    if (src && src.images.length)
        embed.image = { url: src.images[0] };
    if (s.name) embed.footer = { text: s.name };
    return embed;
}

async function welcomeCheckSend (server, user, whoLabel)
{
    if (!welcomeLink (server))
        return { ok: false, why: 'Приветствие выключено: канал для приветствий не задан (или он неверный).' };
    try
    {
        const src = await welcomeSource (server, true);
        await sendFit (user, { embeds: [await welcomeEmbed (server, user)] });
        console.log ('[' + (d()) + '] [welcome] проверка: ' + whoLabel + ' -> ' + uu (user) +
            (src ? ' -- с текстом' + (src.images.length ? ' и картинкой' : '') + ' из сообщения с правилами'
                 : ' -- только ссылка (сообщение с правилами не прочиталось)'));
        return { ok: true, src: src };
    }
    catch (e)
    {
        console.error ('[' + (d()) + '] [welcome] проверка: ЛС не ушло (' + e.message + ')');
        return { ok: false, why: 'ЛС не ушло: `' + code (e.message) + '`' };
    }
}

async function welcomeDM (server, uid, raw)
{
    const link = welcomeLink (server);
    if (!link) return;
    const name = (raw && raw.user && raw.user.username) || uid;
    try
    {
        const user = await client.users.fetch (uid).catch (() => null);
        if (!user || typeof user.send !== 'function')
        {
            console.error ('[welcome] ЛС новичку ' + name + ' не отправить: пользователь недоступен');
            return;
        }
        const src = await welcomeSource (server);
        await sendFit (user, { embeds: [await welcomeEmbed (server, user)] });
        console.log ('[' + (d()) + '] [welcome] ЛС новичку ' + name + ' отправлена (' + link + ')' +
            (src ? ' -- текст и картинки взяты из сообщения с правилами' : ' -- только ссылка (сообщение с правилами не прочиталось)') +
            (((SERVERS[server] || {}).welcome_prefix === false) ? ' [welcome_prefix: false -- без описания бота]' : ''));
    }
    catch (e)
    {
        console.error ('[welcome] ЛС новичку ' + name + ' не ушла: ' + oneLine (e.message));
    }
}

function banWhy (e)
{
    const msg = oneLine (String ((e && e.message) || e), 160);
    if (/Missing Permissions|50013/i.test (msg))
        return msg + ' [у бота нет права «Банить/Разбанивать участников» ИЛИ его роль стоит НИЖЕ роли человека -- проверь права роли бота]';
    if (/Unknown Member|10007/i.test (msg))
        return msg + ' [человека нет на сервере]';
    if (/Unknown Ban|10026/i.test (msg))
        return msg + ' [бана и не было -- снимать нечего]';
    if (/higher|hierarchy/i.test (msg))
        return msg + ' [роль бота должна стоять ВЫШЕ роли человека в списке ролей]';
    if (/Missing Access|50001/i.test (msg))
        return msg + ' [у бота нет доступа к действию -- проверь права и роль]';
    return msg;
}

async function handleMemberJoin (server, uid, raw)
{
    const guild = client.guilds.cache.get (server);
    const serverName = SERVERS[server].name;
    let onLeaveBanTimeout = SERVERS[server].onLeaveBanTimeout || 0;
    let onEnterBanRealy = flagOn (server, 'onEnterBanRealy');
    let until = await db (server, 'membersBanTimeout', uid);
    const left = until ? until - Date.now () : 0;
    const username = (raw && raw.user && raw.user.username) || uid;
    if (until && left <= 0)
    {
        await db (server, 'membersBanTimeout', uid, null);
        until = null;
    }
    if (!until)
    {
        await welcomeDM (server, uid, raw);
        return;
    }
    const user = await client.users.fetch (uid).catch (() => null);
    if (onEnterBanRealy)
    {
        if (user && typeof user.send === 'function')
            await user.send
            (
                {
                    embeds:
                    [
                        {
                            color: 0xFF0000,
                            description:
                                `${user}, вам временно **ограничен** 🏃 вход на сервер \`${serverName}\` 🟥\n` +
                                `Причина: перезаход во время таймаута (\`${onLeaveBanTimeout} мин.\` за выход).\n` +
                                `Ограничение снимется \`${d(until, true)}\` -- это через \`${dd(until)}\``,
                        },
                    ],
                }
            )
            .catch (e => console.error ('[memberJoin] ЛС о таймауте ' + username + ' не ушла: ' + e.message));
        else
            console.error ('[memberJoin] ЛС о таймауте ' + username + ' не отправить: пользователь недоступен');
        guild.members.ban (uid,
            { reason: 'Забанен ботом до ' + d (until, true) + ' (перезаход во время таймаута, осталось ' + dd (until) + ')' })
        .then
        (
            async () =>
            {
                console.log ('[' + (d()) + '] участник ' + username + ' забанен до ' + d (until, true) +
                    ' (оставалось ' + dd (until) + ', перезаход во время таймаута)');
                banHistoryAdd (server, uid, 'ban');
                banTimerSet (server, uid, left, async () =>
                {
                    try
                    {
                        const u = await guild.members.unban (uid, 'Таймаут истёк');
                        await db (server, 'membersBanTimeout', uid, null);
                        banHistoryAdd (server, uid, 'unban');
                        console.log ('[' + (d()) + '] участник ' + (u ? u.username : uid) + ' разбанен (срок истёк)');
                    }
                    catch (e)
                    {
                        if (/Unknown Ban|10026|404/i.test (String (e && e.message)))
                        {
                            await db (server, 'membersBanTimeout', uid, null);
                            console.log ('[' + (d()) + '] участник ' + username + ' уже не в бане (разбанен вручную или раньше) -- запись убрал');
                        }
                        else
                            console.error ('[' + (d()) + '] участник ' + username + ' НЕ разбанен (срок истёк): ' + banWhy (e) +
                                ' -- запись оставил, сниму при следующей проверке/запуске');
                    }
                });
            }
        )
        .catch (e => console.error ('[' + (d()) + '] участник ' + username + ' НЕ забанен (перезаход): ' + banWhy (e) +
            ' -- таймаут в базе остался, значит при следующем входе до конца срока попробую снова (и снова напишу в ЛС)'));
        return;
    }
    console.log ('[' + (d()) + '] участник ' + username + ' вернулся во время таймаута, но бан не выдан' +
        ' (onEnterBanRealy выключен, оставалось ' + dd (until) + ')');
}

async function handleMemberLeave (server, uid, raw, since = 0)
{
    const guild = client.guilds.cache.get (server);
    let log_channel = SERVERS[server].log_channel || '';
    let onLeaveBanTimeout = SERVERS[server].onLeaveBanTimeout || 0;
    let onLeaveBanRealy = flagOn (server, 'onLeaveBanRealy');
    const onEnterBanRealy = flagOn (server, 'onEnterBanRealy');
    await saveMemberRoles (server, uid, raw, since);
    await banHistoryAdd (server, uid, 'exit');
    if (await db (server, 'membersBanTimeout', uid))
    {
        return;
    }
    if (!onLeaveBanTimeout) return;
    let username = raw && raw.user ? (raw.user.username + (raw.nick ? ' (' + raw.nick + ')' : '')) : uid;
    if (onLeaveBanRealy)
    {
        const untilLeave = Date.now () + onLeaveBanTimeout * 60 * 1000;
        await db (server, 'membersBanTimeout', uid, untilLeave);
        let banned = false;
        try
        {
            await guild.members.ban
            (
                uid,
                {
                    days: 0,
                    reason: 'Забанен ботом до ' + d (untilLeave, true) + ' (выход с сервера, таймаут ' + onLeaveBanTimeout + ' мин.)',
                }
            );
            banned = true;
            banHistoryAdd (server, uid, 'ban');
            console.log ('[' + (d()) + '] участник ' + username + ' забанен до ' + d (untilLeave, true) +
                ' (' + onLeaveBanTimeout + ' мин., при выходе)');
        }
        catch (e)
        {
            banHistoryAdd (server, uid, 'timeout');
            console.error ('[' + (d()) + '] участник ' + username + ' НЕ забанен (бан при выходе не выдался): ' + banWhy (e) +
                ' -- таймаут ' + onLeaveBanTimeout + ' мин. всё равно записан: вернётся раньше срока -- ' +
                (onEnterBanRealy
                    ? 'попробую забанить снова (onEnterBanRealy)'
                    : 'будет только строка в логе, бан не выдам (onEnterBanRealy выключен)'));
        }
        banTimerSet (server, uid, onLeaveBanTimeout * 60 * 1000, async () =>
        {
            if (!banned)
            {
                await db (server, 'membersBanTimeout', uid, null);
                console.log ('[' + (d()) + '] участник ' + username + ' таймаут истёк спустя ' + onLeaveBanTimeout +
                    ' мин. (бана не было -- снимать нечего)');
                return;
            }
            try
            {
                const user = await guild.members.unban (uid, 'Таймаут истёк');
                await db (server, 'membersBanTimeout', uid, null);
                banHistoryAdd (server, uid, 'unban');
                console.log ('[' + (d()) + '] участник ' + (user ? user.username : uid) + ' разбанен (срок истёк)');
            }
            catch (e)
            {
                if (/Unknown Ban|10026|404/i.test (String (e && e.message)))
                {
                    await db (server, 'membersBanTimeout', uid, null);
                    console.log ('[' + (d()) + '] участник ' + username + ' уже не в бане (разбанен вручную или раньше) -- запись убрал');
                }
                else
                    console.error ('[' + (d()) + '] участник ' + username + ' НЕ разбанен (срок истёк): ' + banWhy (e) +
                        ' -- запись оставил, сниму при следующей проверке/запуске');
            }
        });
    }
    else
    {
        const untilTimeout = Date.now () + onLeaveBanTimeout * 60 * 1000;
        await db (server, 'membersBanTimeout', uid, untilTimeout);
        banHistoryAdd (server, uid, 'timeout');
        console.log ('[' + (d()) + '] участник ' + username + ' таймаут до ' + d (untilTimeout, true) +
            ' (' + onLeaveBanTimeout + ' мин., бан -- только если вернётся раньше)');
        banTimerSet (server, uid, onLeaveBanTimeout * 60 * 1000, async () =>
        {
            await db (server, 'membersBanTimeout', uid, null);
            console.log ('[' + (d()) + '] участник ' + username + ' таймаут истёк спустя ' + onLeaveBanTimeout +
                ' мин. (не вернулся)');
        });
    }
}

const ROLE_SAVE_DAYS_DEFAULT = 0;

function roleSaveOn (server)
{
    return (SERVERS[server] || {}).save_roles !== false;
}

function roleRestorable (server, guild, id)
{
    const s = SERVERS[server] || {};
    const skip = (Array.isArray (s.save_roles_exclude) ? s.save_roles_exclude : []).map (String);
    if (skip.includes (String (id))) return false;
    const role = guild.roles.cache.get (id);
    return !!(role && !role.managed && role.id !== guild.id);
}

function roleSaveDays (server)
{
    const d = Number ((SERVERS[server] || {}).save_roles_days);
    if (!Number.isFinite (d)) return ROLE_SAVE_DAYS_DEFAULT;
    return (d > 0) ? Math.floor (d) : 0;
}

function roleSaveLabel (server)
{
    const days = roleSaveDays (server);
    return days ? (days + ' дн') : 'навсегда';
}

async function rolesWithChangesAfter (server, uid, roles, since)
{
    let out = (roles || []).slice ();
    let changes = $roleChanges.filter (r => r.targetId === uid && r.at >= since);
    if (!changes.length && since)
    {
        const guild = client.guilds.cache.get (server);
        if (!guild) return out;
        try
        {
            const logs = await guild.fetchAuditLogs ({ type: AuditLogEvent.MemberRoleUpdate, limit: 50 });
            const got = [];
            for (const e of logs.entries.values ())
            {
                if (e.targetId !== uid || e.createdTimestamp < since) continue;
                const d = roleDeltaOf (e.changes);
                if (d.add.length || d.remove.length) got.push ({ add: d.add, remove: d.remove, at: e.createdTimestamp });
            }
            changes = got.sort ((a, b) => a.at - b.at);
        }
        catch (e) { return out; }
    }
    for (const ch of changes)
    {
        const rm = new Set ((ch.remove || []).map (String));
        out = out.filter (id => !rm.has (String (id)));
        for (const id of (ch.add || []))
            if (!out.some (have => String (have) === String (id))) out.push (id);
    }
    return out;
}

async function saveMemberRoles (server, uid, raw, since = 0)
{
    if (!roleSaveOn (server)) return;
    const guild = client.guilds.cache.get (server);
    if (!guild) return;
    let roles = (raw && Array.isArray (raw.roles)) ? raw.roles : null;
    if (!roles) return;
    if (since) roles = await rolesWithChangesAfter (server, uid, roles, since);
    const name = (raw && raw.user && raw.user.username) || uid;
    const keep = roles.filter (id => roleRestorable (server, guild, id));
    if (!keep.length)
    {
        await db (server, 'memberRoles', uid, null).catch (() => {});
        return;
    }
    try
    {
        await db (server, 'memberRoles', uid, { at: Date.now (), roles: keep });
        console.log ('[' + (d()) + '] [roles] запомнил ' + keep.length + ' ' + plural (keep.length, 'роль', 'роли', 'ролей') +
            ' для ' + name + ': ' + keep.map (id => '«' + ((guild.roles.cache.get (id) || {}).name || id) + '»').join (', '));
    }
    catch (e) { console.error ('[roles] не смог сохранить роли ' + name + ': ' + oneLine (e.message)); }
}

async function restoreMemberRoles (server, uid, raw)
{
    if (!roleSaveOn (server)) return 0;
    const guild = client.guilds.cache.get (server);
    if (!guild) return 0;
    const name = (raw && raw.user && raw.user.username) || uid;
    let saved = null;
    try { saved = await db (server, 'memberRoles', uid); }
    catch (e) { console.error ('[roles] не смог прочитать роли ' + name + ': ' + oneLine (e.message)); return 0; }
    if (!saved || !Array.isArray (saved.roles) || !saved.roles.length) return 0;
    const days = roleSaveDays (server);
    if (days && Date.now () - (Number (saved.at) || 0) > days * 86400000)
    {
        await db (server, 'memberRoles', uid, null).catch (() => {});
        console.log ('[' + (d()) + '] [roles] запись о ролях ' + name + ' старше ' + days + ' дн -- забываю');
        return 0;
    }
    const have = new Set ((raw && Array.isArray (raw.roles)) ? raw.roles : []);
    const want = saved.roles.filter (id => !have.has (id) && roleRestorable (server, guild, id));
    if (!want.length) return 0;
    try
    {
        const member = await guild.members.fetch (uid);
        await member.roles.add (want, 'PANDAMIA: возврат ролей после перезахода');
        console.log ('[' + (d()) + '] [roles] вернул ' + want.length + ' ' + plural (want.length, 'роль', 'роли', 'ролей') + ' ' + name + ': ' +
            want.map (id => '«' + ((guild.roles.cache.get (id) || {}).name || id) + '»').join (', '));
        return want.length;
    }
    catch (e)
    {
        console.error ('[roles] не смог вернуть роли ' + name + ': ' + oneLine (e.message) + ' -- запись оставлена, попробую в следующий вход');
        return 0;
    }
}

async function sweepSavedRoles (server)
{
    if (!roleSaveOn (server)) return;
    const days = roleSaveDays (server);
    let keys = [];
    try
    {
        for await (const [key, value] of $db[server]['memberRoles'].iterator())
        {
            if (!value || typeof value.at !== 'number' ||
                (days && Date.now () - value.at > days * 86400000))
                keys.push (key);
        }
        for (const key of keys) await db (server, 'memberRoles', key, null);
    }
    catch (e) { console.error ('[roles] уборка: ' + oneLine (e.message)); return; }
    if (keys.length)
        console.log ('[' + (d()) + '] [roles] ' + (days
            ? 'истёк срок хранения ' + days + ' дн (save_roles_days)'
            : 'в базе записи без даты') + ': удалено из базы ' +
            keys.length + ' ' + plural (keys.length, 'запись', 'записи', 'записей') +
            ' о ролях -- эти роли всё равно не вернулись бы (' +
            (days ? 'запись просрочена' : 'в старой записи нет даты') + ')');
}

async function rolecheckReport (server, target)
{
    const s = SERVERS[server] || {};
    const guild = client.guilds.cache.get (server);
    const out = [];
    out.push ('🔎 **' + target.username + '** `' + target.id + '`');
    let member = null, memberWhy = '';
    try { member = await guild.members.fetch (target.id); }
    catch (e) { memberWhy = oneLine (e.message, 90); }
    const haveRoles = member ? new Set (member.roles.cache.keys ()) : null;
    if (member)
        out.push ('\n**На сервере:** да' + (member.nickname ? ' (ник: ' + member.nickname + ')' : '') +
            '\nРоли сейчас (' + (member.roles.cache.size - 1) + '): ' +
            (member.roles.cache.filter (r => r.id !== guild.id).map (r => '«' + r.name + '»').join (', ') || '--'));
    else
        out.push ('\n**На сервере:** нет' + (memberWhy ? ' _(проверить не смог: `' + memberWhy + '`)_' : ''));
    let saved = null, saveWhy = '';
    try { saved = await db (server, 'memberRoles', target.id); }
    catch (e) { saveWhy = oneLine (e.message, 90); }
    const nameOf = id => '«' + ((guild.roles.cache.get (id) || {}).name || id) + '»';
    if (!roleSaveOn (server))
        out.push ('\n**Роли при входе:** функция выключена (`save_roles: false`)');
    else if (saveWhy)
        out.push ('\n**Роли при входе:** база не прочиталась (`' + saveWhy + '`)');
    else if (!saved || !Array.isArray (saved.roles) || !saved.roles.length)
        out.push ('\n**Роли при входе:** записи нет -- возвращать нечего');
    else
    {
        const days = roleSaveDays (server);
        const age = Math.round ((Date.now () - (Number (saved.at) || 0)) / 86400000);
        out.push ('\n**Роли при входе** (`save_roles`, хранение ' + roleSaveLabel (server) + '): запомнено ' +
            saved.roles.length + ' ' + plural (saved.roles.length, 'роль', 'роли', 'ролей') +
            ' (' + (Number (saved.at) ? d (saved.at, true) : '?') + ')');
        out.push ('• помню: ' + saved.roles.map (nameOf).join (', '));
        if (days && age > days)
            out.push ('• ⏳ запись старше ' + days + ' дн -- при входе она забывается, роли возвращаться НЕ будут');
        else
        {
            const want = saved.roles.filter (id => !(haveRoles && haveRoles.has (id)) && roleRestorable (server, guild, id));
            out.push (want.length
                ? '• ✅ вернётся при входе: ' + want.map (nameOf).join (', ')
                : '• ✅ возвращать нечего: ' + (haveRoles ? 'все эти роли у человека уже есть'
                    : 'роли уже есть / исключены в конфиге / их больше нет на сервере'));
            const skip = saved.roles.filter (id => !want.includes (id));
            if (skip.length)
                out.push ('• вычеркнуто: ' + skip.map (id => nameOf (id) +
                    (haveRoles && haveRoles.has (id) ? ' (уже есть)' :
                        (!guild.roles.cache.get (id) ? ' (роли нет на сервере)' : ' (исключена в config)'))).join (', '));
        }
    }
    const until = await db (server, 'membersBanTimeout', target.id).catch (() => null);
    const bans = await guildBans (server);
    const isBan = bans.has (target.id);
    const why = isBan && bans.get (target.id) ? ' (причина: ' + oneLine (bans.get (target.id), 200) + ')' : '';
    const unconfirmed = !isBan && !!until && until > Date.now () &&
        flagOn (server, 'onLeaveBanRealy') && (s.onLeaveBanTimeout || 0) > 0;
    if (until && until > Date.now ())
        out.push ('\n**Сейчас в наказании:** ' + (isBan ? '🚫 бан' : '⏳ таймаут (бана в Discord нет)') +
            ' до `' + d (until, true) + '` -- осталось `' + dd (until) + '`' + why +
            (unconfirmed ? '\n• ⚠️ бан не подтверждён Discord: по конфигу бот должен был забанить при выходе,\n' +
                '  значит вызов не прошёл (обычно нет права «Банить участников» / роль бота ниже).\n' +
                '  При перезаходе бот попробует снова; в конце срока запись уйдёт сама. Вручную -- `/unban`.' : ''));
    else if (isBan)
        out.push ('\n**Сейчас в наказании:** 🚫 бан в Discord' + why);
    else
        out.push ('\n**Сейчас в наказании:** нет' + (until ? ' _(запись о таймауте просрочена -- её снимет свип)_' : ''));
    const hist = await bansHistory (server);
    const row = hist.find (h => h.id === target.id);
    out.push ('\n**История ' + banHistoryLabel (server) + ':** ' + (row
        ? 'выходов ' + row.exit + ', таймаутов ' + row.timeout + ', банов ' + row.ban + ', снятий ' + row.unban +
          ' _(последнее: ' + d (row.last, true) + ')_'
        : 'ничего не записано'));
    if (s.name) out.push ('\n—_' + s.name + '_');
    return out.join ('\n');
}

async function myDataReport (server, target, self)
{
    const out = [];
    const bytesOf = (_v) => { try { return Buffer.byteLength (JSON.stringify (_v), 'utf8'); } catch (e) { return 0; } };
    const guild = client.guilds.cache.get (server);
    const nameOf = _id => '«' + ((guild && guild.roles.cache.get (_id) || {}).name || _id) + '»';
    let rec = 0, bytes = 0;

    out.push ('🗂 **' + (self ? 'Что бот помнит о тебе' : 'Что бот помнит о ' + target.username) + '**');
    out.push ('Ключ записи -- твой id `' + target.id + '`. Ни имён, ни профилей, ни текстов сообщений бот не хранит.');

    const saved = await db (server, 'memberRoles', target.id).catch (() => null);
    const savedN = (saved && Array.isArray (saved.roles)) ? saved.roles.length : 0;
    if (savedN)
    {
        rec++; bytes += bytesOf (saved);
        out.push ('\n**1. Роли, чтобы вернуть при входе** (`memberRoles`)');
        out.push ('• ' + savedN + ' ' + plural (savedN, 'роль', 'роли', 'ролей') + ', записано ' +
            (Number (saved.at) ? d (saved.at, true) : 'без даты (старый формат)'));
        out.push ('• ' + saved.roles.map (nameOf).join (', '));
        out.push ('• хранение: ' + roleSaveLabel (server) + '; запись весит ~' + bytesOf (saved) + ' байт');
        if (!roleSaveOn (server)) out.push ('• но сейчас функция выключена (`save_roles: false`) -- при входе роли не вернутся');
    }
    else
    {
        out.push ('\n**1. Роли, чтобы вернуть при входе:** записи нет' +
            (roleSaveOn (server) ? '' : ' (и функция выключена: `save_roles: false`)'));
    }

    const hist = await db (server, 'banHistory', target.id).catch (() => null);
    const ev = (hist && Array.isArray (hist.events)) ? hist.events.filter (e => e && Number (e.at)) : [];
    if (ev.length)
    {
        const cnt = (_k) => ev.filter (_e => _e.kind === _k).length;
        const ats = ev.map (_e => Number (_e.at));
        rec++; bytes += bytesOf (hist);
        out.push ('\n**2. История наказаний** (`banHistory`)');
        out.push ('• ' + ev.length + ' ' + plural (ev.length, 'событие', 'события', 'событий') +
            ': выходов ' + cnt ('exit') + ', таймаутов ' + cnt ('timeout') +
            ', банов ' + cnt ('ban') + ', снятий ' + cnt ('unban'));
        out.push ('• первое ' + d (Math.min (...ats), true) + ', последнее ' + d (Math.max (...ats), true) +
            ' (хранение: ' + banHistoryLabel (server) + ')');
    }
    else out.push ('\n**2. История наказаний:** ничего не записано');

    const until = await db (server, 'membersBanTimeout', target.id).catch (() => null);
    if (until)
    {
        rec++; bytes += 8;
        out.push ('\n**3. Таймер выхода** (`membersBanTimeout`): ' + (until > Date.now ()
            ? 'активен до `' + d (until, true) + '` -- осталось `' + dd (until) + '`'
            : 'запись просрочена, её снимет свип'));
    }

    const m = musicOf (server);
    const inQ = (m.tracks || []).filter (_t => String ((_t && _t.byId) || '') === target.id).length;
    const cur = !!(m.current && String (m.current.byId || '') === target.id);
    if (inQ || cur)
    {
        out.push ('\n**4. Музыка** (`musicState`): ' + (inQ
            ? 'в очереди ' + inQ + ' ' + plural (inQ, 'трек', 'трека', 'треков') + ', которые добавил' + (self ? 'а' : '') + ' ' + (self ? 'ты' : 'он')
            : 'в очереди треков нет') + (cur ? ', и сейчас играет трек ' + (self ? 'твой' : 'его') : ''));
        out.push ('• хранятся только название, ссылка и автор трека; список живёт до `/stop` или конца очереди' +
            ' (сама очередь -- общая для сервера, поэтому в «Итого» ниже она не считается)');
    }
    else out.push ('\n**4. Музыка:** ничего не записано');

    out.push ('\n**Итого в базе:** ' + rec + ' ' + plural (rec, 'запись', 'записи', 'записей') + ', ~' + bytes +
        ' байт -- всё в одном локальном файле SQLite на машине владельца бота, никуда не отправляется' +
        (DB_KEYS.length ? '; записи зашифрованы (AES-256-GCM)' : '') + '.');
    out.push ('**Чего там никогда не бывает:** текстов и истории сообщений, ников и аватаров, e-mail и телефонов, IP-адресов, платежных данных, записей голоса.');
    out.push ('**Сроки:** ' + (banHistoryLabel (server) === roleSaveLabel (server)
        ? 'роли и история -- ' + roleSaveLabel (server)
        : 'роли -- ' + roleSaveLabel (server) + '; история -- ' + banHistoryLabel (server)) +
        '; таймер выхода -- до окончания наказания; очередь музыки -- до `/stop` или конца очереди.');
    out.push ('**Как удалить:** попроси staff -- `/forget user:' + (self ? '@ты' : '@' + target.username) +
        '` стирает сразу роли, историю и треки из очереди (авторство играющего трека тоже стирается); ' +
        'либо напиши владельцу бота (контакт есть в `/help`).\n' +
        '_Активное наказание `/forget` не трогает: это уже не хранение данных, а действие модерации -- его снимает `/unban`._');
    if (privacyUrlOf (server)) out.push ('📄 Полная политика конфиденциальности: ' + privacyUrlOf (server));
    return out.join ('\n');
}

async function sweepNicks (server)
{
    try
    {
        const guild = client.guilds.cache.get (server);
        if (!guild || !tagEnabled (server)) return;
        const tag = tagOf (server);
        if (!tag) return;
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
            const base = vs.member || guild.members.cache.get (vs.id);
            if (!base || base.user.bot) continue;
            checked++;
            const wantTag = hasRights && !isStaff (server, base);
            const known = $nickSet[server] ? $nickSet[server].get (vs.id) : undefined;
            if (known === wantTag) continue;
            let member = await guild.members.fetch ({user: vs.id, force: true}).catch (() => null);
            const fresh = !!member;
            if (!member) member = base;
            if (!member || member.user.bot) continue;
            let nick = member.nickname || member.user.username;
            let hasTag = nick.startsWith (tag);
            if (!fresh && known !== undefined) hasTag = known;
            if (hasTag === wantTag) { nickSetMark (server, vs.id, hasTag); continue; }
            if (wantTag)
                await setNickLogged (member, nickWithTag (server, nickWithoutTag (server, nick)), server)
                    .then (() => { added++; console.log ('[' + (d()) + '] [nick] +' + tag + ' (sweep) ' + member.user.username + ' в ' + channel.name); })
                    .catch (e => console.error ('[nick][sweep] ошибка для ' + member.user.username + ': ' + e.message));
            else
                await setNickLogged (member, nickWithoutTag (server, nick), server)
                    .then (() => { removed++; console.log ('[' + (d()) + '] [nick] -' + tag + ' ' + (isStaff (server, member) ? '(staff) ' : '(sweep) ') + member.user.username); })
                    .catch (e => console.error ('[nick][sweep] ошибка для ' + member.user.username + ': ' + e.message));
        }
        if (DEBUG && checked > 0 && (added > 0 || removed > 0))
            console.log ('[' + (d()) + '] [nick][sweep] проверено ' + checked + ' в голосе: +' + added + '/-' + removed + ' ключей');
    }
    catch (e)
    {
        console.error ('[nick][sweep] ошибка: ' + e.message);
    }
}

async function tempCreateFor (server, member)
{
    const guild = client.guilds.cache.get (server);
    const catId = SERVERS[server].temp_category || '';
    const lobbyId = SERVERS[server].temp_lobby || '';
    if (!guild || !catId) return;
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
    .catch (e => { console.error ('[temp] ошибка создания: ' + e.message); return null; });
    if (!created) return;
    console.log ('[' + (d()) + '] [temp] создал ' + created.name + ' для ' + member.user.username);
    if (member.voice.channelId === lobbyId)
        await member.voice.setChannel (created.id)
            .catch (e => console.error ('[temp] ошибка перевода: ' + e.message));
    const tempTag = tagOf (server);
    if (tempTag && tagEnabled (server) && !isStaff (server, member))
    {
        let nick = member.nickname || member.user.username;
        if (!nickHasTag (server, nick))
            await setNickLogged (member, nickWithTag (server, nickWithoutTag (server, nick)), server)
                .then (() => console.log ('[' + (d()) + '] [nick] +' + tempTag + ' (temp) ' + member.user.username))
                .catch (e => console.error ('[temp] ошибка смены ника: ' + e.message));
    }
    await tempSweep (server);
}

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
        if (busy) continue;
        await ch.delete ('PANDAMIA: pustoy lichny kanal')
            .then (() => console.log ('[' + (d()) + '] [temp] удалил пустой ' + ch.name))
            .catch (e => console.error ('[temp] ошибка удаления: ' + e.message));
    }
}

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
            await tempCreateFor (server, member).catch (e => console.error ('[temp] ошибка лобби: ' + e.message));
    }
}

function configSanityIssues ()
{
    const out = [];
    const idOk = v => /^\d{17,20}$/.test (String (v === undefined || v === null ? '' : v).trim ());
    const has = v => String (v === undefined || v === null ? '' : v).trim () !== '';
    if (!CONFIG_APP_ID && !TOKEN_APP_ID)
        out.push ('ID: не задан, и из TOKEN его тоже не достать -- слэш-команды на серверах НЕ зарегистрируются ' +
            '(префиксные команды работают). ID -- это Application ID из Discord Developer Portal');
    else if (!CONFIG_APP_ID)
        out.push ('ID: в файле нет -- беру из TOKEN (' + TOKEN_APP_ID + '): слэш-команды встанут. Ключ не обязателен, ' +
            'но с ним сразу видно опечатку в TOKEN');
    else if (APP_ID_MISMATCH)
        out.push ('ID = ' + CONFIG_APP_ID + ', а в TOKEN зашит ' + TOKEN_APP_ID + ' -- регистрирую по ТОКЕНУ ' +
            '(с чужим id Discord отвечает 404): и ID, и TOKEN должны быть от одного приложения');
    if (has (PREFIX) && !/\s$/.test (String (PREFIX)))
        out.push ('PREFIX = "' + PREFIX + '": нет пробела на конце -- текстовые команды (' +
            String (PREFIX).trim () + ' ping, ' + String (PREFIX).trim () + ' help) работать не будут');
    if (has (privacy_url) && !PRIVACY_URL)
        out.push ('privacy_url: не похоже на ссылку http(s) -- /mydata и /help её не покажут');
    if (show_privacy_url !== undefined && typeof show_privacy_url !== 'boolean')
        out.push ('show_privacy_url = "' + show_privacy_url + '": ожидается true или false -- ' +
            'беру значение по умолчанию (ссылка показывается, если privacy_url задан)');
    if (has (MUSIC_CFG.filter) && MUSIC_CFG.normalize === false)
        out.push ('MUSIC.filter задан, но MUSIC.normalize: false -- фильтр не применяется (играю как записано)');
    if (MUSIC_QUEUE_CHECK && QUEUE_CHECK_DEPTH > 100)
        out.push ('MUSIC.queue_check_depth: ' + QUEUE_CHECK_DEPTH + ' -- это много запросов к YouTube ' +
            'на один проход; держи 20-30 (0 -- не проверять очередь заранее)');
    if (MUSIC_QUEUE_CHECK && MUSIC_CFG.queue_check_gap_ms !== undefined &&
        Number (MUSIC_CFG.queue_check_gap_ms) < 1000)
        out.push ('MUSIC.queue_check_gap_ms меньше 1000 -- поднимаю до 1000 (чаще не надо: это защита от лимитов YouTube)');
    if (MUSIC_CFG.history_len !== undefined &&
        !(Number.isFinite (Number (MUSIC_CFG.history_len)) && String (MUSIC_CFG.history_len).trim () !== ''))
        out.push ('MUSIC.history_len = "' + MUSIC_CFG.history_len + '": ожидается число -- ' +
            'иначе выходит 0, и /history будет отвечать, что история выключена (ставь 25 или не пиши ключ вовсе)');
    else if (Number (MUSIC_CFG.history_len) > 200)
        out.push ('MUSIC.history_len: ' + MUSIC_CFG.history_len + ' -- держу 200 (это запись в базе и текст сообщения, а не архив)');
    if (MUSIC_CFG.history_tracks !== undefined &&
        !(Number.isFinite (Number (MUSIC_CFG.history_tracks)) && String (MUSIC_CFG.history_tracks).trim () !== ''))
        out.push ('MUSIC.history_tracks = "' + MUSIC_CFG.history_tracks + '": ожидается число -- ' +
            'иначе выходит 0, и лимита по трекам не будет (ставь 500 или не пиши ключ вовсе)');
    else if (Number (MUSIC_CFG.history_tracks) > 5000)
        out.push ('MUSIC.history_tracks: ' + MUSIC_CFG.history_tracks + ' -- держу 5000 ' +
            '(это запись в базе и текст сообщения, а не архив)');
    if (MUSIC_CFG.queue_live_ms !== undefined &&
        !(Number.isFinite (Number (MUSIC_CFG.queue_live_ms)) && String (MUSIC_CFG.queue_live_ms).trim () !== ''))
        out.push ('MUSIC.queue_live_ms = "' + MUSIC_CFG.queue_live_ms + '": ожидается число МИЛЛИСЕКУНД -- ' +
            'иначе выходит 0 и /queue перестанет обновляться сам (ставь 30000 или не пиши ключ вовсе)');
    else if (Number (MUSIC_CFG.queue_live_ms) > 0 && Number (MUSIC_CFG.queue_live_ms) < 10000)
        out.push ('MUSIC.queue_live_ms: ' + MUSIC_CFG.queue_live_ms + ' -- это МИЛЛИСЕКУНДЫ, и меньше 10 секунд не беру: ' +
            'поднимаю до 10000. Похоже, ты указал секунды -- тогда пиши 30000 для полминуты или 60000 для минуты (правки сообщений в Discord ' +
            'ограничены примерно 5 за 5 секунд на канал)');
    if (MUSIC_CFG.net_wait_ms !== undefined &&
        !(Number.isFinite (Number (MUSIC_CFG.net_wait_ms)) && String (MUSIC_CFG.net_wait_ms).trim () !== ''))
        out.push ('MUSIC.net_wait_ms = "' + MUSIC_CFG.net_wait_ms + '": ожидается число МИЛЛИСЕКУНД -- ' +
            'иначе беру 10000 (10 секунд); ключ можно вообще не писать');
    else if (Number (MUSIC_CFG.net_wait_ms) > 0 && Number (MUSIC_CFG.net_wait_ms) < 2000)
        out.push ('MUSIC.net_wait_ms: ' + MUSIC_CFG.net_wait_ms + ' -- это МИЛЛИСЕКУНДЫ, и чаще двух секунд не пробую: ' +
            'поднимаю до 2000. Пожалуй, ты указал секунды -- для десяти секунд пиши 10000');
    if (MUSIC_CFG.channel_status !== undefined && typeof MUSIC_CFG.channel_status !== 'boolean')
        out.push ('MUSIC.channel_status = ' + JSON.stringify (MUSIC_CFG.channel_status) + ': ожидается true или false -- ' +
            'считаю выключенным (шапку канала не трогаю, как и по умолчанию)');
    if (MUSIC_CFG.cache_long_sets !== undefined && typeof MUSIC_CFG.cache_long_sets !== 'boolean')
        out.push ('MUSIC.cache_long_sets = ' + JSON.stringify (MUSIC_CFG.cache_long_sets) +
            ': ожидается true или false -- считаю выключенным (это лишний запрос к YouTube и место на диске, так что без ошибок)');
    if (MUSIC_CFG.cache_long_sets === true && MUSIC_CFG.cache === false)
        out.push ('MUSIC.cache_long_sets: true, но MUSIC.cache: false -- кэш выключен целиком, качать сеты некуда: ' +
            'настройка не работает (или включи cache, или убери cache_long_sets)');
    if (log_keep_months !== undefined &&
        !(Number.isFinite (Number (log_keep_months)) && String (log_keep_months).trim () !== ''))
        out.push ('log_keep_months = "' + log_keep_months + '": ожидается число месяцев -- ' +
            'иначе выходит 0 (файлы лога не удаляются никогда; можно вообще не писать ключ)');
    if (log_dir !== undefined && typeof log_dir !== 'string')
        out.push ('log_dir = ' + JSON.stringify (log_dir) + ': ожидается папка строкой -- ' +
            'беру значение по умолчанию (logs)');
    const boolKeys = (obj, where, keys) =>
    {
        if (!obj || typeof obj !== 'object') return;
        for (const k of keys)
        {
            if (!Object.prototype.hasOwnProperty.call (obj, k)) continue;
            if (typeof obj[k] === 'boolean') continue;
            out.push (where + '.' + k + ' = ' + JSON.stringify (obj[k]) + ': ожидается true или false -- ' +
                'беру состояние «ключа нет» (в config.example.json написано, что это значит для этого ключа)');
        }
    };
    boolKeys (CONFIG_RAW, 'config.json', ['DEBUG', 'MESSAGE_CONTENT', 'GUILD_MEMBERS']);
    boolKeys (MUSIC_CFG, 'MUSIC', ['normalize', 'skip_absent_author', 'cache', 'cache_keep_played', 'queue_check']);
    for (let server in SERVERS)
    {
        const s = (SERVERS[server] && typeof SERVERS[server] === 'object') ? SERVERS[server] : {};
        const nm = (s.name || server) + ' (' + server + ')';
        if (!('allow' in s))
        {
            out.push ('сервер ' + nm + ': нет ключа "allow" -- бот его НЕ обслуживает (поставь "allow": true)');
            continue;
        }
        if (s.allow === false) continue;
        if (typeof s.allow !== 'boolean')
            out.push ('сервер ' + nm + ': allow = ' + JSON.stringify (s.allow) + ': ожидается true или false (без кавычек) -- ' +
                'такое значение считаю ВЫКЛЮЧЕННЫМ: экземпляр не обслуживается');
        boolKeys (s, 'сервер ' + nm, ['welcome_prefix', 'save_roles', 'show_owner_hoster', 'show_owner_server',
                                      'onLeaveBanRealy', 'onEnterBanRealy']);
        if (idOk (s.welcome_message) && !idOk (s.welcome_channel))
            out.push ('сервер ' + nm + ': welcome_message задан, а welcome_channel пуст/неверен -- ' +
                'сообщение с правилами найти негде, приветствие новичкам ВЫКЛЮЧЕНО');
        if (s.welcome_public_channel !== undefined && String (s.welcome_public_channel).trim () !== '' &&
            !idOk (s.welcome_public_channel))
            out.push ('сервер ' + nm + ': welcome_public_channel не id канала -- ' +
                'ссылка в приветствии будет вести в служебный канал (welcome_channel)');
        if (idOk (s.welcome_public_message) && !idOk (s.welcome_public_channel))
            out.push ('сервер ' + nm + ': welcome_public_message задан, а welcome_public_channel пуст -- ' +
                'ссылка на сообщение потеряется (укажи и канал, или очисти message)');
        if (idOk (s.temp_lobby) && !idOk (s.temp_category))
            out.push ('сервер ' + nm + ': temp_lobby задан, а temp_category пуст/неверен -- ' +
                'личные каналы (@ник) создаваться не будут');
        if (idOk (s.pipe_channel_source) && !idOk (s.pipe_channel_target))
            out.push ('сервер ' + nm + ': pipe_channel_source задан, а pipe_channel_target пуст -- ' +
                'пересылать некуда, мост ничего не делает');
        if ((Number (s.onLeaveBanTimeout) > 0) && !flagOn (server, 'onLeaveBanRealy') && !flagOn (server, 'onEnterBanRealy'))
            out.push ('сервер ' + nm + ': onLeaveBanTimeout = ' + s.onLeaveBanTimeout + ', но onLeaveBanRealy ' +
                'и onEnterBanRealy выключены -- таймаут только записывается, никто не ограничивается');
        for (let key of ['role_admin', 'role_moder', 'role_dj', 'role_for_manage',
                         'role_for_no_speak', 'role_for_no_stream', 'role_for_no_media', 'role_for_no_chat'])
        {
            if (!has (s[key])) continue;
            if (!idOk (s[key]))
                out.push ('сервер ' + nm + ': ' + key + ' = "' + s[key] + '": не похоже на id роли -- ' +
                    'настройка молча не работает');
        }
        if (s.privacy_url !== undefined)
            out.push ('сервер ' + nm + ': privacy_url задан у сервера -- своего адреса там нет, ' +
                'ссылка всегда берётся из ВЕРХНЕГО ключа privacy_url (этот можно убрать)');
        if (s.show_privacy_url !== undefined && typeof s.show_privacy_url !== 'boolean')
            out.push ('сервер ' + nm + ': show_privacy_url = "' + s.show_privacy_url + '": ожидается ' +
                'true или false -- беру верхнее show_privacy_url');
        else if (s.show_privacy_url === true && !PRIVACY_URL)
            out.push ('сервер ' + nm + ': show_privacy_url: true, но верхний privacy_url пуст -- ' +
                'показывать нечего (ссылка появится, как только её впишут)');
        if (has (s.owner_server) && !idOk (s.owner_server))
            out.push ('сервер ' + nm + ': owner_server = "' + s.owner_server + '": не похоже на id -- ' +
                'в помощи он не показывается');
        if (s.tag !== undefined && s.tag !== null && typeof s.tag !== 'string')
            out.push ('сервер ' + nm + ': tag = ' + JSON.stringify (s.tag) + ': ожидается строка ' +
                '(символ или несколько, по умолчанию 🔑) -- беру значение по умолчанию');
        else if (typeof s.tag === 'string' && [...s.tag].length > NICK_MAX)
            out.push ('сервер ' + nm + ': tag = "' + s.tag + '": длиннее ' + NICK_MAX + ' символов -- ' +
                'ключ будет обрезан (в нике Discord всего ' + NICK_MAX + ' символов)');
        if (s.tag_add !== undefined && s.tag_add !== null && typeof s.tag_add !== 'boolean')
            out.push ('сервер ' + nm + ': tag_add = ' + JSON.stringify (s.tag_add) + ': ожидается true или false -- ' +
                'считаю выключенным (ключ в нике не ставлю; сам символ -- ключ tag)');
        if (has (s.queue_page) && Number.isFinite (Number (s.queue_page)) && Number (s.queue_page) > 25)
            out.push ('сервер ' + nm + ': queue_page = ' + s.queue_page + ' -- страница будет 25 ' +
                '(больше Discord не принимает)');
    }
    for (const _srvLine of serverServeIssues ()) out.push (_srvLine);
    return out;
}

function configDriftIssues ()
{
    const _fs = require ('fs'), _path = require ('path');
    const _exFile = _path.join (__dirname, 'config.example.json');
    if (!_fs.existsSync (_exFile)) return [];
    let _ex = null;
    try { _ex = JSON.parse (_fs.readFileSync (_exFile, 'utf8')); } catch (e) { return []; }
    const _cfg = require ('./config.json');
    const _srvEx = (_ex.SERVERS || {})['ID_СЕРВЕРА'] || {};
    const _isKey = _k => !/_comment$/.test (_k) && !/^_/.test (_k);
    const _count = _o => Object.keys (_o || {}).filter (_isKey).length;
    const _extra = (a, b) => Object.keys (a || {}).filter (_k => _isKey (_k) && !(_k in (b || {})));
    const out = [];
    const _strangers = [];
    const _note = (where, _k) => _strangers.push (where + _k);
    for (const _k of _extra (_cfg, _ex)) _note ('верхний уровень: ', _k);
    for (const _k of _extra (_cfg.MUSIC, _ex.MUSIC)) _note ('MUSIC: ', _k);
    const _srvBits = [];
    for (const _id of Object.keys (_cfg.SERVERS || {}))
    {
        if (!/^\d{17,20}$/.test (_id)) continue;
        for (const _k of _extra ((_cfg.SERVERS || {})[_id], _srvEx)) _note (_id + '.', _k);
        _srvBits.push (_count ((_cfg.SERVERS || {})[_id]));
    }
    if (_strangers.length)
        out.push ('ключей, которых нет в config.example.json: ' + _strangers.length + ' -- ' +
            _strangers.slice (0, 8).join (', ') + (_strangers.length > 8 ? ', ...и ещё ' + (_strangers.length - 8) : '') +
            ' -- бот их не читает: это опечатка или ключ старой версии');
    const _isBlock = _v => _v && typeof _v === 'object' && !Array.isArray (_v);
    const _topKeysOf = _o => Object.keys (_o || {}).filter (_k => _isKey (_k) && !_isBlock (_o[_k])).length;
    const _topKeys = _topKeysOf (_cfg);
    const _cmpComments = (a, b, where, acc) =>
    {
        for (const _k of Object.keys (a || {}))
        {
            if (!/_comment$/.test (_k)) continue;
            if (!(_k in (b || {}))) continue;
            if (String (a[_k]) === String (b[_k])) continue;
            acc.push (where + _k);
        }
    };
    const _cmp1 = [];
    _cmpComments (_cfg, _ex, '', _cmp1);
    _cmpComments (_cfg.MUSIC, _ex.MUSIC, 'MUSIC.', _cmp1);
    for (const _id of Object.keys (_cfg.SERVERS || {}))
    {
        if (!/^\d{17,20}$/.test (_id)) continue;
        _cmpComments ((_cfg.SERVERS || {})[_id], _srvEx, _id + '.', _cmp1);
    }
    if (_cmp1.length)
        out.push ('подсказок (_comment) отличается от config.example.json: ' + _cmp1.length + ' -- ' +
            _cmp1.slice (0, 6).join (', ') + (_cmp1.length > 6 ? ', ...и ещё ' + (_cmp1.length - 6) : '') +
            ' -- эталон подсказок -- в примере: скопируй текст оттуда (бот их не читает, но их читаешь ты)');
    out.push ('config.json: ключей верхнего уровня ' + _topKeys + ' (в примере ' + _topKeysOf (_ex) + '), в MUSIC ' +
        _count (_cfg.MUSIC) + ' (в примере ' + _count (_ex.MUSIC) + ')' +
        (_srvBits.length ? ', у серверов ' + _srvBits.join (' и ') + ' (в примере ' + _count (_srvEx) + ')' : '') +
        '; чего в файле нет -- бот берёт из значений по умолчанию, а полный список ключей с пояснениями лежит в config.example.json');
    return out;
}

const CONFIG_ORDER = {
    TOP: [
        ['_ЧТО ЭТО'], ['_ПРО_КОММЕНТАРИИ'], ['_ПРО_ЭТАЛОН'], ['_ВЕРХНИЙ_УРОВЕНЬ'],
        ['ID', 'TOKEN', 'PREFIX'],
        ['DEBUG', 'MESSAGE_CONTENT', 'GUILD_MEMBERS'],
        ['STARTUP_DM', 'OWNER', 'db_key', 'db_key_prev'],
        ['privacy_url', 'show_privacy_url'],
        ['backup_minutes', 'backup_keep'],
        ['log_dir', 'log_keep_months'],
        ['MUSIC'],
        ['SERVERS'],
    ],
    MUSIC: [
        ['proxy', 'doh', 'dpi_heal', 'cookies_file', 'cookies_from_browser'],
        ['ytdlp_auto_update', 'ytdlp_update_after_fails', 'ytdlp_check_days', 'ytdlp_update_days'],
        ['normalize', 'filter'],
        ['channel_status', 'skip_absent_author'],
        ['cache', 'cache_dir', 'cache_short_max_minutes', 'cache_long_sets', 'cache_max_mb', 'cache_keep_played'],
        ['queue_check', 'queue_check_depth', 'queue_check_gap_ms'],
        ['queue_live_ms', 'history_len', 'history_tracks'],
        ['net_wait_ms'],
    ],
    SERVER: [
        ['allow'],
        ['name', 'log_channel', 'pipe_channel_source', 'pipe_channel_target', 'channel_common', 'deaf_exempt'],
        ['role_admin', 'role_moder', 'role_dj'],
        ['temp_category', 'temp_lobby'],
        ['tag_add', 'tag'],
        ['role_for_manage', 'role_for_no_speak', 'role_for_no_stream', 'role_for_no_media', 'role_for_no_chat'],
        ['welcome_channel', 'welcome_message', 'welcome_prefix', 'welcome_public_channel', 'welcome_public_message'],
        ['queue_page', 'onLeaveBanTimeout', 'onLeaveBanRealy', 'onEnterBanRealy'],
        ['save_roles', 'save_roles_days', 'save_roles_exclude'],
        ['bans_history_days'],
        ['owner_server', 'show_owner_hoster', 'show_owner_server', 'show_privacy_url'],
    ],
};
const CONFIG_EXEMPT = new Set (['MUSIC.proxy']);
const isConfigExempt = path => CONFIG_EXEMPT.has (path) || /(^|\.)allow$/.test (path);

function configLayout (file)
{
    const _fs = require ('fs'), _path = require ('path');
    const full = _path.join (__dirname, file);
    if (!_fs.existsSync (full)) return null;
    const text = _fs.readFileSync (full, 'utf8');
    let json = null;
    try { json = JSON.parse (text); } catch (e) { return { text, json: null, entries: [], broken: oneLine (e && e.message || e) }; }
    const lines = text.split ('\n');
    const entries = [];
    const stack = {};
    for (let i = 0; i < lines.length; i++)
    {
        const m = lines[i].match (/^(\s*)"([^"]+)"\s*:/);
        if (!m) continue;
        const d = Math.round (m[1].length / 2);
        stack[d] = m[2];
        const chain = [];
        for (let q = 1; q <= d; q++) chain.push (stack[q]);
        let prev = '';
        for (let q = i - 1; q >= 0; q--) if (lines[q].trim () !== '') { prev = lines[q].replace (/\s+$/, ''); break; }
        entries.push ({ key: m[2], depth: d, line: i + 1, path: chain.join ('.'), parent: chain.slice (0, -1).join ('.'),
            blankBefore: /^\s*$/.test (lines[i - 1] === undefined ? '' : lines[i - 1]),
            prevEndsWithBrace: /\{\s*$/.test (prev) });
    }
    return { text, json, entries };
}
function configGroupOf (e, topIsServer)
{
    const lvl = e.depth === 1 ? 'TOP' : (e.depth === 2 && e.parent === 'MUSIC' ? 'MUSIC'
        : (e.depth === 2 && e.parent === 'SERVERS' ? 'SERVERID'
            : (e.depth === 3 && topIsServer ? 'SERVER' : '?') ));
    if (lvl === 'SERVERID') return { lvl, group: -1 };
    if (lvl === '?') return { lvl, group: -1 };
    const groups = CONFIG_ORDER[lvl] || [];
    for (let gi = 0; gi < groups.length; gi++) if (groups[gi].includes (e.key)) return { lvl, group: gi };
    return { lvl, group: -1 };
}

function configTemplateIssues ()
{
    const hard = [], soft = [];
    const _fs = require ('fs'), _path = require ('path');
    const files = ['config.example.json', 'config.minimal.json', 'config.json'];
    const ref = configLayout ('config.example.json');
    if (!ref || !ref.json)
        return { hard: ['config.example.json не читается (' + ((ref && ref.broken) || 'файла нет') + ') -- эталон недоступен, шаблоны проверить нечем'], soft: [] };
    for (const f of files)
    {
        const lay = f === 'config.example.json' ? ref : configLayout (f);
        const to = f === 'config.example.json' ? hard : (f === 'config.minimal.json' ? hard : soft);
        if (!lay) continue;
        if (!lay.json) { to.push (f + ' не разобран JSON (' + lay.broken + ')'); continue; }
        const byParent = new Map ();
        for (const e of lay.entries)
        {
            if (/_comment$/.test (e.key)) continue;
            if (!byParent.has (e.parent)) byParent.set (e.parent, []);
            byParent.get (e.parent).push (e);
        }
        for (const [parent, list] of byParent)
        {
            const sample = list[0];
            const topIsServer = String (parent).split ('.')[0] === 'SERVERS';
            const { lvl, group } = configGroupOf (sample, topIsServer);
            if (lvl === '?') { to.push (f + ': ключ ' + sample.path + ' (стр. ' + sample.line + ') -- не из какого блока: допиши его в CONFIG_ORDER в index.js'); continue; }
            if (group === -1 && lvl === 'SERVERID') continue;
            const canon = (CONFIG_ORDER[lvl] || []).flat ();
            const known = list.filter (e => canon.includes (e.key) || isConfigExempt (e.path));
            const unknown = list.filter (e => !canon.includes (e.key) && !isConfigExempt (e.path));
            for (const u of unknown)
                to.push (f + ': ключ ' + u.key + ' (стр. ' + u.line + ') нет в каноническом порядке (' + lvl + ') -- в конфиге он либо лишний, либо его надо внести в CONFIG_ORDER');
            for (let i = 1; i < known.length; i++)
            {
                const prev = canon.indexOf (known[i - 1].key), cur = canon.indexOf (known[i].key);
                if (prev > cur)
                    to.push (f + ': порядок -- ' + known[i].key + ' (стр. ' + known[i].line + ') идёт после ' + known[i - 1].key +
                        ', а в ' + (f === 'config.example.json' ? 'каноне' : 'config.example.json') + ' -- раньше (местами ключи не меняем)');
            }
            if (f === 'config.example.json')
            {
                const missing = canon.filter (k => !list.some (e => e.key === k));
                if (missing.length)
                    to.push ('config.example.json: в эталоне НЕТ ключей: ' + missing.join (', ') +
                        ' -- эталон обязан описывать ВСЁ, что бот читает (иначе про ключ никто не узнает)');
            }
        }
        const firstPresent = new Set ();
        {
            const seenGrp = new Set ();
            for (const e of lay.entries)
            {
                if (/_comment$/.test (e.key)) continue;
                const { lvl, group } = configGroupOf (e, String (e.parent).split ('.')[0] === 'SERVERS');
                if (lvl === 'SERVERID') { firstPresent.add (e.path); continue; }
                if (group < 0) continue;
                const gk = lvl + ':' + e.parent + ':' + group;
                if (seenGrp.has (gk)) continue;
                seenGrp.add (gk);
                firstPresent.add (e.path);
            }
        }
        for (let i = 0; i < lay.entries.length; i++)
        {
            const e = lay.entries[i];
            if (/_comment$/.test (e.key))
            {
                const nx = lay.entries[i + 1];
                if (!nx || nx.parent !== e.parent || nx.key !== e.key.replace (/_comment$/, ''))
                    to.push (f + ': подсказка ' + e.key + ' (стр. ' + e.line + ') стоит без своего ключа или не вплотную перед ним -- поправь (подсказка + ключ идут одним блоком)');
                continue;
            }
            const first = (i > 0 && /_comment$/.test (lay.entries[i - 1].key) && lay.entries[i - 1].parent === e.parent &&
                lay.entries[i - 1].key.replace (/_comment$/, '') === e.key) ? lay.entries[i - 1] : e;
            if (first === lay.entries[0]) continue;
            const { lvl } = configGroupOf (e, String (e.parent).split ('.')[0] === 'SERVERS');
            const firstOfGroup = firstPresent.has (e.path);
            const wantBlank = (lvl === 'SERVERID' || firstOfGroup) && !first.prevEndsWithBrace;
            if (wantBlank !== first.blankBefore)
                to.push (f + ': блоки -- ' + e.key + ' (стр. ' + first.line + ')' +
                    (wantBlank ? ': это начало блока, а пустой строки перед ним нет' : ': это продолжение блока, а перед ним лишняя пустая строка'));
        }
        if (f !== 'config.example.json')
        {
            const walk = (a, b, path) =>
            {
                for (const k of Object.keys (a || {}))
                {
                    if (/_comment$/.test (k) || /^_/.test (k)) continue;
                    const p = path ? path + '.' + k : k;
                    const av = a[k], bv = (b || {})[k];
                    if (av && typeof av === 'object' && !Array.isArray (av)) { walk (av, bv, p); continue; }
                    if (bv === undefined || isConfigExempt (p)) continue;
                    if (JSON.stringify (av) === JSON.stringify (bv))
                        to.push (f + ': ключ ' + p + ' = ' + JSON.stringify (av) + ' -- РОВНО как в примере, то есть значение по умолчанию: строку можно убрать (в этом файле держим только то, что не по умолчанию и обязательное)');
                }
            };
            walk (lay.json, ref.json, '');
        }
        if (f !== 'config.example.json')
        {
            const cmp = (a, b, path) =>
            {
                for (const k of Object.keys (a || {}))
                {
                    if (!/_comment$/.test (k)) continue;
                    const p = path ? path + '.' + k : k;
                    if (/^_/.test (k) || /^SERVERS\.[^.]*_comment$/.test (p)) continue;
                    if (b && typeof b[k] === 'string' && a[k] !== b[k]) to.push (f + ': подсказка ' + p + ' отличается от config.example.json -- эталон подсказок там: скопируй текст оттуда');
                }
                for (const k of Object.keys (a || {}))
                {
                    const v = a[k];
                    if (v && typeof v === 'object' && !Array.isArray (v) && !/_comment$/.test (k)) cmp (v, (b || {})[k], path ? path + '.' + k : k);
                }
            };
            cmp (lay.json, ref.json, '');
        }
    }
    return { hard, soft };
}

function tokenAppId (tok)
{
    try
    {
        const seg = String (tok === undefined || tok === null ? '' : tok).split ('.')[0];
        if (!seg) return null;
        const dec = Buffer.from (seg, 'base64url').toString ('utf8');
        return /^\d{17,20}$/.test (dec) ? dec : null;
    }
    catch (e) { return null; }
}
const CONFIG_APP_ID = (typeof ID === 'string' && /^\d{17,20}$/.test (ID.trim ())) ? ID.trim () : null;
const TOKEN_APP_ID = tokenAppId (TOKEN);
const APP_ID_FOR_REGISTER = TOKEN_APP_ID || CONFIG_APP_ID || null;
const APP_ID_MISMATCH = !!(CONFIG_APP_ID && TOKEN_APP_ID && CONFIG_APP_ID !== TOKEN_APP_ID);

const SERVER_TUNED_KEYS = ['name', 'log_channel', 'pipe_channel_source', 'pipe_channel_target',
    'channel_common', 'deaf_exempt', 'role_admin', 'role_moder', 'role_dj', 'role_for_manage', 'role_for_no_speak',
    'role_for_no_stream', 'role_for_no_media', 'role_for_no_chat', 'temp_category', 'temp_lobby',
    'welcome_channel', 'welcome_message', 'welcome_public_channel', 'owner_server',
    'onLeaveBanTimeout', 'onLeaveBanRealy', 'onEnterBanRealy', 'save_roles', 'save_roles_days',
    'bans_history_days', 'queue_page', 'tag_add', 'tag'];
function serverServeIssues ()
{
    const out = [];
    for (const id of Object.keys (SERVERS || {}))
    {
        if (!/^\d{17,20}$/.test (id)) continue;
        const s = SERVERS[id];
        if (s.allow !== undefined) continue;
        const tuned = SERVER_TUNED_KEYS.filter (k => s[k] !== undefined);
        if (!tuned.length) continue;
        out.push ('сервер ' + id + (s.name ? ' «' + s.name + '»' : '') + ': блок настроен (' +
            tuned.slice (0, 4).join (', ') + (tuned.length > 4 ? ', ...' : '') +
            '), но ключа "allow" нет -- бот его НЕ ОБСЛУЖИВАЕТ (ни входов/выходов, ни музыки, ни наказаний). ' +
            'Нужен -- поставь "allow": true; не нужен -- удали блок или поставь "allow": false');
    }
    return out;
}
function serverGuildIssues (guilds)
{
    const out = [];
    if (!guilds) return out;
    const known = new Set (Object.keys (SERVERS || {}).filter (k => /^\d{17,20}$/.test (k)));
    for (const id of known)
        if (SERVERS[id].allow === true && !guilds.has (String (id)))
            out.push ('сервер ' + id + (SERVERS[id].name ? ' «' + SERVERS[id].name + '»' : '') +
                ': allow: true, но БОТА ТАМ НЕТ -- пригласи его заново (ссылка из Developer Portal -> OAuth2) ' +
                'или убери allow, иначе ждёшь музыки и наказаний, которых не будет');
    for (const g of guilds.values ())
        if (!known.has (String (g.id)))
            out.push ('бот стоит в «' + (g.name || g.id) + '» (' + g.id + '), а экземпляра в config.json нет -- ' +
                'если он там нужен: добавь блок этого сервера с "allow": true; иначе он в этом сервере просто молчит');
    return out;
}

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
    if (Array.isArray (SERVERS[server].deaf_exempt))
        for (const x of SERVERS[server].deaf_exempt)
        {
            const found = /^\d{17,20}$/.test (String (x))
                ? (guild.channels.cache.get (String (x)) || await guild.channels.fetch (String (x)).catch (() => null))
                : guild.channels.cache.find (c => c.name === x);
            if (!found)
                console.error ('[config] deaf_exempt = "' + x + '": такого канала на сервере нет -- проверь config.json (переименование канала?)');
        }
    for (let key of ['role_admin', 'role_moder', 'role_dj', 'role_for_manage',
                     'role_for_no_speak', 'role_for_no_stream', 'role_for_no_media', 'role_for_no_chat'])
    {
        let id = SERVERS[server][key];
        if (!id) continue;
        if (!guild.roles.cache.get (String (id)))
            console.error ('[config] ' + key + ' = ' + id + ': такой роли на сервере нет -- ' +
                'настройка молча не работает');
    }
}

async function reportIntents (server)
{
    const name = SERVERS[server].name;
    const has = i => client.options.intents.has (i);
    const yes = ok => ok ? 'да' : 'НЕТ';
    const msgContent = has (GatewayIntentBits.MessageContent);
    const members    = has (GatewayIntentBits.GuildMembers);
    console.log ('[' + (d()) + '] [intents] ' + name + ' | Message Content (текст сообщений, команды "panda ..."): ' +
        yes (msgContent) + (msgContent ? '' : ' -- пересылка из пандалогии и текстовые команды молчат' +
            ' (вместо пересылки: правый клик по сообщению -> «Переслать в общий»)'));
    console.log ('[' + (d()) + '] [intents] ' + name + ' | Guild Members (мгновенные вход/выход): ' +
        yes (members) + (members ? '' : ' -- вход/выход только опросом раз в 45 сек'));
    const n = $membersSnapshot[server] ? $membersSnapshot[server].size : 0;
    console.log ('[' + (d()) + '] [intents] ' + name + ' | полный список участников (REST): ' +
        (n ? 'да -- ' + n + ' участников' : 'НЕТ -- список не пришёл, вход/выход не работают') +
        ' (от него зависят вход/выход, таймаут за выход и возврат ролей)');
    let audit = false, why = '';
    try
    {
        const guild = client.guilds.cache.get (server);
        await guild.fetchAuditLogs ({limit: 1});
        audit = true;
    }
    catch (e) { why = oneLine (e.message, 90); }
    console.log ('[' + (d()) + '] [intents] ' + name + ' | журнал аудита (авторство мутов/переносов): ' +
        (audit ? 'да' : 'НЕТ -- ' + why));
}

async function reportBotPermissions (server)
{
    const guild = client.guilds.cache.get (server);
    if (!guild) return;
    let me = guild.members.me;
    if (!me) { try { me = await guild.members.fetchMe (); } catch (e) { return; } }
    if (!me) return;
    const P = PermissionsBitField.Flags;
    const need =
    [
        [P.ManageRoles, 'Управлять ролями', 'мут, глухота, ключ 🔑, возврат ролей'],
        [P.BanMembers, 'Банить участников', 'бан за выход (таймаут) и /unban'],
        [P.ManageChannels, 'Управлять каналами', 'создание/удаление каналов, права в них'],
        [P.ManageNicknames, 'Управлять никами', 'тег 🔑 перед ником'],
        [P.MoveMembers, 'Перемещать участников', 'переносы между каналами'],
        [P.MuteMembers, 'Выключать микрофон', 'серверный мут'],
        [P.DeafenMembers, 'Выключать звук', 'глухота'],
        [P.KickMembers, 'Выгонять участников', 'кик (в отдельных случаях модерации)'],
        [P.ViewAuditLog, 'Просматривать журнал аудита', 'авторство мутов и переносов'],
        [P.Connect, 'Подключаться', 'зайти в голосовой канал (иначе тишина)'],
        [P.Speak, 'Говорить', 'чтобы музыку было слышно'],
    ];
    const miss = need.filter (n => !me.permissions.has (n[0]));
    const name = SERVERS[server].name;
    if (!miss.length)
    {
        console.log ('[' + (d()) + '] [perms] ' + name + ': права на мут, бан, роли, каналы и музыку -- на месте');
        return;
    }
    for (const [flag, label, why] of miss)
        console.log ('[' + (d()) + '] [perms] ' + name + ': НЕТ права «' + label + '» -- ' + why +
            ' работать не будет (Discord ответит Missing Permissions). Где включить: Настройки сервера -> ' +
            'Роли -> роль бота -> Права, и подними эту роль ВЫШЕ ролей тех, кого наказываешь');
    console.log ('[' + (d()) + '] [perms] ' + name + ': не хватает ' + miss.length + ' ' +
        plural (miss.length, 'права', 'прав', 'прав') + ' -- это то, что уже будет ломаться в бою');
}

async function pollMembers (server)
{
    try
    {
        const guild = client.guilds.cache.get (server);
        if (!guild) return;
        let current;
        try { current = await fetchAllMembersRest (server); }
        catch (e)
        {
            const now = Date.now ();
            if (now - ($pollWarnAt[server] || 0) > 10 * 60 * 1000)
            {
                $pollWarnAt[server] = now;
                console.error ('[poll] список участников не пришёл (' + oneLine (e.message, 150) + '): проверь интент Guild Members в портале приложения' +
                    ' -- без него не работают вход/выход, таймаут за выход и возврат ролей');
            }
            return;
        }
        let previous = $membersSnapshot[server];
        const prevAt = $membersSnapshotAt[server] || 0;
        if (previous && previous.size > 5 && (current.size === 0 ||
            (previous.size >= 100 && current.size < previous.size / 2)))
        {
            const now = Date.now ();
            if (now - ($pollWarnAt[server] || 0) > 10 * 60 * 1000)
            {
                $pollWarnAt[server] = now;
                console.error ('[poll] список участников подозрительно мал: было ' + previous.size +
                    ', стало ' + current.size + ' -- пропускаю тик, никого не наказываю');
            }
            return;
        }
        if (previous)
        {
            try
            {
                for (let [uid, raw] of current)
                {
                    if (previous.has (uid)) continue;
                    if (memberEventFresh (server, uid, true)) continue;
                    try
                    {
                        let memberUser = await resolveUser (uid, raw);
                        console.log ('[' + (d()) + '] участник ' + memberUser.username + ' ЗАШЁЛ на ' + SERVERS[server].name);
                        await logMemberJoinLeave (server, memberUser, true);
                        await restoreMemberRoles (server, uid, raw);
                        await handleMemberJoin (server, uid, raw);
                    }
                    catch (e) { console.error ('[pollMembers] вход ' + uid + ': ' + e.message); }
                }
                for (let [uid, raw] of previous)
                {
                    if (current.has (uid)) continue;
                    if (memberEventFresh (server, uid, false) || memberEventFresh (server, uid, true)) continue;
                    try
                    {
                        let memberUser = await resolveUser (uid, raw);
                        console.log ('[' + (d()) + '] участник ' + memberUser.username + ' ВЫШЕЛ с ' + SERVERS[server].name);
                        await logMemberJoinLeave (server, memberUser, false);
                        await handleMemberLeave (server, uid, raw, prevAt);
                    }
                    catch (e) { console.error ('[pollMembers] выход ' + uid + ': ' + e.message); }
                }
            }
            finally
            {
                $membersSnapshot[server] = current;
                $membersSnapshotAt[server] = Date.now ();
            }
        }
        else
        {
            $membersSnapshot[server] = current;
            $membersSnapshotAt[server] = Date.now ();
        }
    }
    catch (e)
    {
        console.error ('[pollMembers] ошибка: ' + e.message);
    }
}

client.on
(
    'clientReady',
    async () =>
    {
        if ($pollBooted)
        {
            console.log ('[' + (d()) + '] [gw] повторный вход -- музыка, снимок участников и отчёты уже подняты, не дублирую');
            return;
        }
        $pollBooted = true;
        {
            let total = 0;
            const list = [];
            for (const g of client.guilds.cache.values ())
            {
                const n = typeof g.memberCount === 'number' ? g.memberCount : 0;
                total += n;
                if (list.length < 8) list.push ((g.name || g.id) + (n ? ' ~' + n : ''));
            }
            const more = client.guilds.cache.size > list.length ? ' и ещё ' + (client.guilds.cache.size - list.length) : '';
            console.log ('[' + (d()) + '] [login] приложение в ' + client.guilds.cache.size + ' серверах, участников суммарно ~' + total +
                (list.length ? ' (' + list.join (' | ') + more + ')' : ''));
        }
        for (const _srvLine of serverGuildIssues (client.guilds.cache))
            console.error ('[' + (d()) + '] [config] ' + _srvLine);
        for (let server in SERVERS)
            if (SERVERS[server].allow)
                resumeMusic (server).catch (e => console.error ('[music] не смог возобновить очередь: ' +
                    oneLine ((e && e.message) || e)));
        for (let server in SERVERS)
        {
            if (!SERVERS[server].allow) continue;
            $membersSnapshot[server] = await fetchAllMembersRest (server).catch (() => null);
            $membersSnapshotAt[server] = Date.now ();
            if ($membersSnapshot[server])
                console.log ('[' + (d()) + '] [poll] снимок готов: ' + $membersSnapshot[server].size + ' участников @ ' + SERVERS[server].name);
            else
                console.error ('[' + (d()) + '] [poll] снимок участников НЕ ПОЛУЧЕН @ ' + SERVERS[server].name +
                    ': нет доступа к списку (интент Guild Members) -- вход/выход, приветствие новичку, таймаут за выход' +
                    ' и возврат ролей работать не будут');
            await reportIntents (server);
            await checkConfigChannels (server);
            await reportBotPermissions (server);
            await reportStoredBans (server);
            await sweepExpiredBans (server);
            await sweepSavedRoles (server);
            await sweepBanHistory (server);
            await tempSweep (server);
        }            setInterval
            (
                async () =>
                {
                    for (let server in SERVERS)
                    {
                        if (!SERVERS[server].allow) continue;
                        let steps =
                        [
                            () => pollMembers (server),
                            () => sweepExpiredBans (server),
                            () => sweepSavedRoles (server),
                            () => sweepBanHistory (server),
                            () => sweepNicks (server),
                            () => tempSweep (server),
                            () => tempLobbyCheck (server),
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
const { spawn } = require ('child_process');
const
{
    SlashCommandBuilder,
    REST,
    Routes,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require ('discord.js');

const MUSIC_CFG = MUSIC || {};
function musicProxyList (raw)
{
    const arr = Array.isArray (raw) ? raw : String (raw === undefined || raw === null ? '' : raw).split (',');
    const out = [];
    for (const s of arr)
    {
        const v = String (s === undefined || s === null ? '' : s).trim ();
        if (v && !/^(direct|none|off|no)$/i.test (v) && !out.includes (v)) out.push (v);
    }
    return out;
}
const MUSIC_PROXY_RAW = ('proxy' in MUSIC_CFG) ? MUSIC_CFG.proxy : process.env.MUSIC_PROXY;
const MUSIC_PROXIES_ALL = musicProxyList (MUSIC_PROXY_RAW);
const MUSIC_PROXIES = MUSIC_PROXIES_ALL.slice (0, 3);
const MUSIC_PROXY = MUSIC_PROXIES[0] || '';
const MUSIC_PROXY_TIMEOUT = 3000;
const PROXY_BAD_TTL = 60000;
const proxyBadUntil = new Map ();
function proxyMarkBad (addr) { if (addr) proxyBadUntil.set (String (addr), Date.now () + PROXY_BAD_TTL); }
function proxyMarkGood (addr) { if (addr) proxyBadUntil.delete (String (addr)); }
function proxyBrieflyBad (addr) { const t = proxyBadUntil.get (String (addr === undefined || addr === null ? '' : addr)); return !!t && t > Date.now (); }
const routeInUse = new Map ();
function routeUseSet (guildId, proxy, kind)
{
    if (!guildId) return;
    routeInUse.set (String (guildId),
        { proxy: (typeof proxy === 'string' ? proxy : ''), kind: String (kind || 'stream'), at: Date.now () });
}
function routeUseOf (guildId) { return routeInUse.get (String (guildId)) || null; }
function routeUseClear (guildId) { if (guildId !== undefined && guildId !== null) routeInUse.delete (String (guildId)); }
const MUSIC_NORMALIZE = MUSIC_CFG.normalize !== false;
const MUSIC_NORMALIZE_FILTER = MUSIC_CFG.filter || 'loudnorm=I=-16:TP=-1.5:LRA=11';
const MUSIC_CHANNEL_STATUS = MUSIC_CFG.channel_status === true;
const MUSIC_SKIP_ABSENT = MUSIC_CFG.skip_absent_author !== false;
const MUSIC_QUEUE_CHECK = MUSIC_CFG.queue_check !== false;
const QUEUE_CHECK_DEPTH = Math.max (0, Math.min (200,
    Math.round (Number (MUSIC_CFG.queue_check_depth === undefined ? 20 : MUSIC_CFG.queue_check_depth) || 0)));
const QUEUE_CHECK_GAP_MS = Math.max (1000, Math.min (60000,
    Math.round (Number (MUSIC_CFG.queue_check_gap_ms === undefined ? 5000 : MUSIC_CFG.queue_check_gap_ms) || 5000)));
const QUEUE_CHECK_STRICT = 3;
const MUSIC_HISTORY_LEN = Math.max (0, Math.min (200,
    Math.round (Number (MUSIC_CFG.history_len === undefined ? 25 : MUSIC_CFG.history_len) || 0)));
const MUSIC_HISTORY_TRACKS = Math.max (0, Math.min (5000,
    Math.round (Number (MUSIC_CFG.history_tracks === undefined ? 500 : MUSIC_CFG.history_tracks) || 0)));
const QUEUE_LIVE_MS = (function ()
{
    const raw = Number (MUSIC_CFG.queue_live_ms === undefined ? 30000 : MUSIC_CFG.queue_live_ms) || 0;
    if (!raw) return 0;
    return Math.max (10000, Math.round (raw));
})();
const QUEUE_LIVE_MAX = 4;
if (MUSIC_QUEUE_CHECK && QUEUE_CHECK_DEPTH)
    console.log ('[' + (d()) + '] [music] проверка очереди заранее: ВКЛЮЧЕНА -- до ' + QUEUE_CHECK_DEPTH +
        ' треков за проход, пауза ' + Math.round (QUEUE_CHECK_GAP_MS / 1000) + ' с (первые ' + QUEUE_CHECK_STRICT +
        ' трека -- сразу через yt-dlp, остальные -- дешёвым oEmbed)');
else
    console.log ('[' + (d()) + '] [music] проверка очереди заранее: выключена (MUSIC.queue_check) -- мёртвые видео узнаём, когда трек подходит к эфиру');
console.log ('[' + (d()) + '] [music] живые сообщения /queue: ' + (QUEUE_LIVE_MS
    ? 'обновляю сам до ' + QUEUE_LIVE_MAX + ' штук, каждые ' + Math.round (QUEUE_LIVE_MS / 1000) +
      ' с, пока их видят (MUSIC.queue_live_ms)'
    : 'самообновление выключено (MUSIC.queue_live_ms: 0) -- освежаются листанием или кнопкой «🔄 Обновить»'));
console.log ('[' + (d()) + '] [music] YouTube: ' + (MUSIC_PROXY
    ? 'через прокси ' + MUSIC_PROXY +
      (MUSIC_PROXIES.length > 1 ? ' (запасные: ' + MUSIC_PROXIES.slice (1).join (', ') + ')' : '') +
      ' (не ответит за 3 сек -- пробую следующий маршрут)'
    : 'напрямую (DIRECT) -- прокси не задан') +
    (MUSIC_PROXIES_ALL.length > MUSIC_PROXIES.length
        ? ' | в конфиге ' + MUSIC_PROXIES_ALL.length + ' адресов прокси -- беру первые ' + MUSIC_PROXIES.length
        : ''));
const NET_WAIT_MS = Math.max (2000, Math.min (120000,
    Math.round (Number (MUSIC_CFG.net_wait_ms === undefined ? 10000 : MUSIC_CFG.net_wait_ms) || 10000)));
const NET_WAIT_MAX_MS = Math.max (NET_WAIT_MS, 30000);
const NET_PING_STEP_MS = 3000;
console.log ('[' + (d()) + '] [music] если сеть/прокси отвалится: очередь НЕ тратится -- держу место в треке и пробую снова каждые ' +
    Math.round (NET_WAIT_MS / 1000) + ' с (до ' + Math.round (NET_WAIT_MAX_MS / 1000) + ' с, MUSIC.net_wait_ms); ' +
    'маршрут (прокси) проверяю каждые ' + Math.round (NET_PING_STEP_MS / 1000) + ' с и играю сразу, как только он ответит');
console.log ('[' + (d()) + '] [music] статус голосового канала (шапка): ' + (MUSIC_CHANNEL_STATUS
    ? 'пишу свой (что играет, очередь, люди) -- прежний текст автора канала вернуть нельзя, он затирается'
    : 'НЕ трогаю -- в шапке остаётся только то, что поставил автор канала (' +
      (Object.prototype.hasOwnProperty.call (MUSIC_CFG, 'channel_status')
          ? 'MUSIC.channel_status: false'
          : 'значение по умолчанию: ключа нет; включить -- "channel_status": true') + ')'));

function pingProxy (addr, timeoutMs = MUSIC_PROXY_TIMEOUT)
{
    return new Promise (resolve =>
    {
        let host, port;
        try
        {
            let u = new URL (String (addr || ''));
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

const PING_OK_TTL = 30000;
const PING_BAD_TTL = 60000;
const DNS_TTL = 60000;
const pingCache = new Map ();
let dnsCache = { ok: null, at: 0 };

async function proxyAlive (addr)
{
    const a = String (addr || '');
    if (!a) return false;
    if (proxyBrieflyBad (a)) return false;
    const now = Date.now ();
    const c = pingCache.get (a);
    if (c && c.at && (now - c.at) < (c.ok ? PING_OK_TTL : PING_BAD_TTL)) return c.ok;
    const ok = await pingProxy (a);
    pingCache.set (a, { ok: ok, at: now });
    return ok;
}

async function liveProxyList ()
{
    const alive = [], rest = [];
    for (const p of MUSIC_PROXIES)
        ((proxyBrieflyBad (p) || !(await proxyAlive (p))) ? rest : alive).push (p);
    return { alive: alive, rest: rest };
}

async function proxyForFetch ()
{
    for (const p of MUSIC_PROXIES) if (!proxyBrieflyBad (p)) return p;
    return (await directUsable ()) ? '' : (MUSIC_PROXIES[0] || '');
}

async function directUsable ()
{
    const now = Date.now ();
    if (dnsCache.ok !== null && (now - dnsCache.at) < DNS_TTL) return dnsCache.ok;
    let ok = true;
    try
    {
        const dns = require ('dns').promises;
        const r = await dns.lookup ('www.youtube.com');
        ok = !!(r && r.address);
    }
    catch { ok = false; }
    const was = dnsCache.ok;
    dnsCache = { ok: ok, at: now };
    if (ok && was === false)
        console.log ('[' + (d()) + '] [music] youtube.com снова резолвится локально -- прямой путь снова в списке маршрутов');
    return ok;
}

const DIRECT_PROBE_TTL = 60000;
const DIRECT_PROBE_TIMEOUT = 3000;
let directProbeCache = { ok: null, at: 0, why: '' };

function probeDirectOnce ()
{
    return new Promise (resolve =>
    {
        let done = false;
        const fin = (ok, why) => { if (done) return; done = true; resolve ({ ok: !!ok, why: String (why || '') }); };
        let req = null;
        try
        {
            req = require ('https').request ({ host: 'www.youtube.com', path: '/robots.txt',
                method: 'GET', timeout: DIRECT_PROBE_TIMEOUT }, res =>
            {
                res.resume ();
                fin (res.statusCode >= 200 && res.statusCode < 400, 'HTTP ' + res.statusCode);
            });
            req.on ('timeout', () => { try { req.destroy (); } catch {}
                fin (false, 'нет ответа за ' + Math.round (DIRECT_PROBE_TIMEOUT / 1000) + ' с'); });
            req.on ('error', e => fin (false, (e && (e.code || e.message)) || 'ошибка соединения'));
            req.end ();
        }
        catch (e) { fin (false, (e && e.message) || 'ошибка'); }
    });
}

async function directProbe ()
{
    const now = Date.now ();
    if (directProbeCache.ok !== null && (now - directProbeCache.at) < DIRECT_PROBE_TTL) return directProbeCache;
    const r = await probeDirectOnce ();
    directProbeCache = { ok: r.ok, at: now, why: r.why };
    return directProbeCache;
}
async function directWorks () { return (await directUsable ()) && (await directProbe ()).ok; }

async function directWhy ()
{
    if ((await directUsable ()) === false) return 'youtube.com локально не резолвится';
    const d = await directProbe ();
    return d.ok ? '' : 'прямой запрос не проходит (' + (d.why || 'нет ответа') + ')';
}

const DOH_CARRY_TTL = 10 * 60000;        // «свой маршрут везёт музыку» помню 10 минут: проверка не бесплатная
const DOH_CARRY_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
let dohCarry = { ok: null, at: 0, why: '' };
async function dohCarryCheck ()          // по-настоящему: доходит ли yt-dlp до YouTube через свой маршрут по адресам
{
    if (dohCarry.at && (Date.now () - dohCarry.at) < DOH_CARRY_TTL) return dohCarry;
    const port = MUSIC_DOH ? await dohProxyStart () : 0;
    let ok = false, why = '';
    if (!port) why = 'свой маршрут не поднялся';
    else
    {
        const r = await ytdlpRunOnce (['--proxy', 'http://127.0.0.1:' + port, '--simulate', '--no-warnings',
            '--skip-download', '--print', 'id', DOH_CARRY_URL], 45000);
        ok = !!(r && r.code === 0 && /\S/.test (String (r.out || '')));
        if (!ok) why = (r && r.code === -1) ? 'yt-dlp через маршрут не ответил за 45 с'
            : 'yt-dlp через маршрут не дошёл' + (r && r.err ? ': ' + oneLine (r.err, 120) : '');
    }
    dohCarry = { ok: ok, at: Date.now (), why: why };
    console.log ('[' + (d()) + '] [music] свой маршрут по адресам ' + (ok
        ? 'везёт музыку: yt-dlp через него дошёл до YouTube'
        : 'музыку НЕ везёт (' + why + ') -- путём для музыки его не считаю'));
    return dohCarry;
}
const DOH_PROBE_TIMEOUT = 6000;          // свой маршрут поднимается и разрешает имя не сразу, поэтому жду дольше прямого
const DOH_PROBE_FAIL_TTL = 10000;        // «не ответил» помню недолго: со второй попытки он обычно уже работает
let dohProbeCache = { ok: false, why: '', at: 0 };
function probeDohOnce (port)             // отвечает ли YouTube через наш маршрут по адресам (свой http-прокси на 127.0.0.1)
{
    return new Promise (resolve =>
    {
        let done = false;
        const fin = (ok, why) => { if (done) return; done = true; resolve ({ ok: !!ok, why: String (why || '') }); };
        let req = null;
        try
        {
            const A = proxyAgentFor ('http://127.0.0.1:' + port);
            if (!A) return fin (false, 'агент для своего маршрута не собрался');
            req = require ('https').request ({ host: 'www.youtube.com', path: '/robots.txt',
                method: 'GET', timeout: DOH_PROBE_TIMEOUT, agent: A }, res =>
            {
                res.resume ();
                fin (res.statusCode >= 200 && res.statusCode < 400, 'HTTP ' + res.statusCode);
            });
            req.on ('timeout', () => { try { req.destroy (); } catch { }
                fin (false, 'нет ответа за ' + Math.round (DOH_PROBE_TIMEOUT / 1000) + ' с'); });
            req.on ('error', e => fin (false, (e && (e.code || e.message)) || 'ошибка соединения'));
            req.end ();
        }
        catch (e) { fin (false, (e && e.message) || 'ошибка'); }
    });
}
async function dohRouteProbe ()          // свой маршрут: удачу помню минуту, «не ответил» -- секунды, чтобы не пугать зря
{
    if (!MUSIC_DOH) return { ok: false, why: 'свой маршрут выключен (MUSIC.doh)' };
    const port = await dohProxyStart ();
    if (!port) return { ok: false, why: 'свой маршрут не поднялся' };
    const now = Date.now ();
    if (dohProbeCache.at && (now - dohProbeCache.at) < (dohProbeCache.ok ? DIRECT_PROBE_TTL : DOH_PROBE_FAIL_TTL))
        return dohProbeCache;
    const r = await probeDohOnce (port);
    dohProbeCache = { ok: r.ok, why: r.why, at: now };
    return dohProbeCache;
}

function dpiBypassProbe ()          // запущен ли обход DPI (winws.exe -- движок zapret/обхода)
{
    return new Promise (res =>
    {
        if (process.platform !== 'win32') return res (null);
        let p = null;
        try { p = spawn ('tasklist', ['/FI', 'IMAGENAME eq winws.exe', '/NH'], { windowsHide: true }); }
        catch (e) { return res (null); }
        let out = '', done = false;
        const fin = v => { if (!done) { done = true; res (v); } };
        try { p.stdout.on ('data', d => { out += String (d); }); } catch (e) { }
        try { p.on ('error', () => fin (null)); } catch (e) { }
        try { p.on ('close', () => fin (/winws\.exe/i.test (out))); } catch (e) { }
        setTimeout (() => fin (null), 2500).unref ();
    });
}

const DPI_TOOL = pathMod.join (__dirname, 'tools', 'zapret-pick.ps1');   // обход DPI: самоподбор стратегии
const DPI_TASK = 'obhod-dpi';                                           // задача хранителя в планировщике
const DPI_HEAL_COOLDOWN_MS = 10 * 60000;      // чаще раза в 10 минут не пробую
const DPI_HEAL_TELL_MS = 60 * 60000;          // про нехватку прав напоминаю не чаще раза в час
const DPI_HEAL_WAIT_MS = 25000;               // сколько ждать, пока хранитель поднимет движок
let dpiHealBusy = false, dpiHealLastAt = 0, dpiHealToldAt = 0;

function runCapture (file, args, timeoutMs)   // запустить чужую программу и забрать код возврата: вывод бывает в чужой кодировке
{
    return new Promise (res =>
    {
        if (process.platform !== 'win32') return res ({ code: -1 });
        try
        {
            require ('child_process').execFile (file, args,
                { windowsHide: true, timeout: timeoutMs || 20000, maxBuffer: 4 * 1024 * 1024 },
                (e, stdout) => res ({ code: e ? (typeof e.code === 'number' ? e.code : -1) : 0, out: String (stdout || '') }));
        }
        catch (e) { res ({ code: -1 }); }
    });
}
function dpiToolRun (args, timeoutMs)
{
    return runCapture ('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', DPI_TOOL].concat (args || []), timeoutMs);
}
function dpiHealPause ()            // дать обходу подняться, прежде чем проверять
{
    return new Promise (r => { const t = setTimeout (r, DPI_HEAL_WAIT_MS); try { t.unref (); } catch (e) { } });
}

function serviceState (name)        // служба или драйвер Windows: есть ли и работает ли (sc query -- только чтение; значения там ASCII)
{
    if (process.platform !== 'win32') return Promise.resolve ({ exists: false, running: false, state: '' });
    return runCapture ('sc.exe', ['query', name], 8000).then (r =>
    {
        const m = String (r.out || '').match (/\b(RUNNING|STOPPED|START_PENDING|STOP_PENDING|PAUSED|CONTINUE_PENDING|PAUSE_PENDING)\b/);
        const st = m ? m[1] : '';
        return { exists: r.code === 0, running: st === 'RUNNING', state: st };
    }).catch (() => ({ exists: false, running: false, state: '' }));
}
async function anyServiceState (names)      // первый из найденных (драйвер WinDivert в разных сборках называется по-разному)
{
    for (const n of names)
    {
        const s = await serviceState (n);
        if (s.exists) return s;
    }
    return { exists: false, running: false, state: '' };
}
function svcWords (s)
{
    return !s.exists ? 'нет' : (s.running ? 'работает' : 'стоит');
}

async function routeStatus ()       // проверка путей: её читают и стартовая строка, и /health
{
    const dnsOk = await directUsable ();
    const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
    const dpi = await dpiBypassProbe ();
    const svc = await serviceState ('zapret');                                    // состояние обхода спрашиваю всегда:
    const drv = await anyServiceState (['windivert', 'WinDivert', 'WinDivert1.4']);   // видно, что мешает, а что уже есть
    const alive = [];
    for (const p of MUSIC_PROXIES) if (await pingProxy (p, 1500)) alive.push (p);
    const dead = MUSIC_PROXIES.filter (p => alive.indexOf (p) < 0);
    const dohPort = MUSIC_DOH ? await dohProxyStart () : 0;      // свой маршрут по адресам: поднимаю сразу
    const dohOk = dohPort ? (await dohRouteProbe ()).ok : false; // и сразу вижу, отвечает ли через него YouTube
    let bookN = 0;
    try { const b = await dnsBookLoad (); bookN = Object.keys (b || {}).length; } catch (e) { }
    const parts = [
        'прямой путь: ' + (dp.ok ? 'ОТВЕЧАЕТ' : 'не проходит' +
            (dnsOk ? (dp.why ? ' (' + dp.why + ')' : '') : ' (и имя youtube.com локально не резолвится)')),
        'обход DPI (zapret/winws): ' + (dpi === true ? 'запущен' : (dpi === false ? 'НЕ запущен' : 'не смог посмотреть')) +
            ' [служба zapret: ' + svcWords (svc) + '; драйвер WinDivert: ' + (drv.exists ? 'установлен' : 'не видно') +
            ' -- движок обхода запускается только с правами администратора]',
        'прокси: ' + (MUSIC_PROXIES.length
            ? (alive.length ? 'отвечает ' + alive.join (', ') + (dead.length ? '; молчит ' + dead.join (', ') : '')
                : 'задан, но НЕ отвечает: ' + MUSIC_PROXIES.join (', '))
            : 'не задан'),
        'свой DoH-маршрут (имя разрешаю сам, системный DNS не нужен): ' + (dohPort
            ? 'включён' + (dohOk ? ', моя проверка через него проходит' : ', но моя проверка через него не прошла') +
                (bookN ? ', в книге адресов ' + bookN + ' имён' : ', книга пока пустая -- наполнится сама')
            : 'выключен (MUSIC.doh)'),
    ];
    let advice;
    if (dp.ok) advice = '-- музыку беру напрямую, включать ничего не надо';
    else if (alive.length) advice = '-- прямой путь не проходит, музыку беру через прокси ' + alive.join (', ');
    else if (dohPort) advice = '-- прямого пути нет: пробую свой DoH-маршрут (имя разрешаю сам, иду по адресу)' + (dohOk ? ', проверка через него проходит' : '');
    else advice = '-- рабочего пути НЕТ: включи обход DPI (tools\\obhod.cmd -- подбирает стратегию сам) или впиши рабочий прокси в MUSIC.proxy, либо включи MUSIC.doh';
    return { dnsOk, dp, dpi, svc, drv, alive, dead, dohPort, dohOk, bookN, parts, advice, noPath: (!dp.ok && !alive.length) };
}

async function notifyHoster (text)              // письмо хозяину: в личные сообщения и в журнал сервера
{
    let sent = 0;
    const ids = OWNER_HOSTER ? [OWNER_HOSTER] : STARTUP_DMS.slice ();
    for (const id of ids)
    {
        try { const usr = await client.users.fetch (id); if (usr) { await sendFit (usr, text); sent++; } }
        catch (e) { console.error ('[' + (d()) + '] письмо владельцу не ушло: ' + ((e && e.message) || e)); }
    }
    for (const srv of Object.keys (SERVERS))
        if (SERVERS[srv] && SERVERS[srv].log_channel)
            try { await logTo (SERVERS[srv].log_channel).send (text); sent++; } catch (e) { }
    return sent;
}

async function dpiSelfHeal (reason)             // ни один путь не работает -- пробую поднять обход DPI сам
{
    if (!MUSIC_DPI_HEAL || !BOT_RUN) return false;
    if (dpiHealBusy || (Date.now () - dpiHealLastAt) < DPI_HEAL_COOLDOWN_MS) return false;
    if ((await dpiBypassProbe ()) === true)                    // обход идёт: чинить нечего, но стратегия могла устареть
    {
        await dpiStrategyHealth (reason);
        return false;
    }
    dpiHealBusy = true;
    dpiHealLastAt = Date.now ();
    let fixed = false, missing = '';
    let svc = { exists: false, running: false }, drv = { exists: false, running: false };
    const did = [];
    try
    {
        console.log ('[' + (d()) + '] [music] ни один путь не отвечает (' + reason + ') -- пробую поднять обход DPI сам');
        if (!fsMod.existsSync (DPI_TOOL)) missing = 'рядом с ботом нет tools/zapret-pick.ps1';
        else
        {
            const list = await dpiToolRun (['-List'], 30000);
            if (list.code === 3)                                // движка нет -- принести его можно и без прав
            {
                const eng = await dpiToolRun (['-EngineOnly'], 180000);
                did.push ('принёс движок zapret: ' + (eng.code === 0 ? 'получилось' : 'не получилось'));
                if (eng.code !== 0) missing = 'нет движка zapret и скачать его не вышло';
            }
            if (!missing)
            {
                svc = await serviceState ('zapret');
                drv = await anyServiceState (['windivert', 'WinDivert', 'WinDivert1.4']);
                if (svc.exists && !svc.running)                 // служба обхода есть, но стоит -- пробую поднять её сам
                {
                    const st = await runCapture ('net.exe', ['start', 'zapret'], 30000);
                    did.push ('поднял службу zapret: ' + (st.code === 0 ? 'получилось' : 'не получилось'));
                    if (st.code === 0)
                    {
                        await dpiHealPause ();
                        fixed = (await dpiBypassProbe ()) === true;
                        if (!fixed) missing = 'служба zapret поднялась, но движка winws.exe не видно';
                    }
                    else missing = 'служба zapret есть, но стоит -- запустить её из бота не вышло: обычному пользователю разрешено только смотреть службу, а не запускать (нужны права администратора)';
                }
                else if (svc.exists && svc.running)
                    missing = 'служба zapret работает, а движка winws.exe не видно -- нужен запуск от администратора (tools/obhod.cmd, «подобрать и запустить») -- драйвер WinDivert тут не при чём, он может быть уже установлен';
            }
            if (!missing && !fixed)
            {
                const q = await runCapture ('schtasks.exe', ['/Query', '/TN', DPI_TASK, '/FO', 'LIST'], 15000);
                if (q.code === 0)                               // хранитель уже стоит: он и запущен с повышенными правами
                {
                    const run = await runCapture ('schtasks.exe', ['/Run', '/TN', DPI_TASK], 20000);
                    did.push ('запустил хранителя из планировщика: ' + (run.code === 0 ? 'получилось' : 'не получилось'));
                    if (run.code === 0)
                    {
                        await dpiHealPause ();
                        fixed = (await dpiBypassProbe ()) === true;
                        if (!fixed) missing = 'хранитель запущен, но движок не поднялся';
                    }
                    else missing = 'хранитель в планировщике есть, но запустить его не удалось';
                }
                else missing = 'нет ни службы zapret, ни задачи хранителя в планировщике, а движок обхода (winws.exe) без прав администратора не запускается -- драйвер WinDivert тут не при чём, он может быть и установлен';
            }
        }
    }
    catch (e) { missing = 'сорвалось с ошибкой: ' + ((e && e.message) || e); }
    finally { dpiHealBusy = false; }
    if (fixed)
    {
        console.log ('[' + (d()) + '] [music] обход DPI поднял сам -- путь к YouTube снова есть');
        dpiStat.healToldAt = Date.now ();
        await notifyHoster ('🛠 **Музыка снова может идти.** Ни один путь к YouTube не работал (' + reason + '), и обход блокировки я поднял сам.' +
            (did.length ? '\n_Что делал: ' + did.join ('; ') + '._' : ''));
        return true;
    }
    const what = missing || 'рабочей стратегии не нашлось';
    if ((Date.now () - dpiHealToldAt) > DPI_HEAL_TELL_MS)
    {
        dpiHealToldAt = Date.now ();
        dpiStat.healToldAt = Date.now ();
        console.error ('[' + (d()) + '] [music] обход DPI поднять сам не смог: ' + what +
            ' -- музыке нужен рабочий путь, скажи хозяину запустить tools\\obhod.cmd');
        await notifyHoster ('🚨 **Музыке некуда идти.** Ни один путь к YouTube не работает (' + reason + '), а обход сам поднять не смог: ' + what + '.' +
            (did.length ? '\n_Что пробовал: ' + did.join ('; ') + '._' : '') +
            '\n_Сейчас у тебя: служба zapret -- ' + svcWords (svc) + ', драйвер WinDivert -- ' + (drv.exists ? 'установлен' : 'не видно') + '._' +
            '\nЧто нужно от тебя: запусти один раз `tools\\obhod.cmd` -- пункт 4 («ПОДОБРАТЬ и запустить»), потом пункт 7 («хранитель в автозапуск»).' +
            ' После этого я смогу поднимать обход сам, и права спрашивать больше не придётся.');
    }
    return false;
}

async function reportRoutes ()
{
    try
    {
        const rs = await routeStatus ();
        console.log ('[' + (d()) + '] [music] пути к YouTube сейчас: ' + rs.parts.join ('; ') + ' ' + rs.advice);
        if (rs.noPath)
            console.error ('[' + (d()) + '] [music] ни одного проверенного пути к YouTube: ' + (rs.dohPort
                ? 'остаётся только свой DoH-маршрут (по адресам из книги) -- если и он не выручит, включи обход DPI или прокси'
                : 'включи обход DPI (tools\\obhod.cmd) или впиши рабочий прокси в MUSIC.proxy, либо MUSIC.doh') +
                '; пока этого нет, музыка будет ждать сеть, а очередь и место в треке целы');
        if (rs.noPath && !rs.dohPort)
            setTimeout (() => dpiSelfHeal ('при старте ни один путь не отвечает'), 30000);   // не тороплю старт: сеть может подниматься сама
        if (rs.noPath && fsMod.existsSync (DPI_CHOSEN))
            console.error ('[' + (d()) + '] [music] сохранённая стратегия обхода есть -- поднять её можно быстро: `node . obhod --start` (или кнопкой в /health)');
        if (rs.noPath)
            setTimeout (() => startupPathNotice ().catch (() => { }), 45000);   // даю системе догрузиться и проверяю ещё раз
    }
    catch (e) { }
}

if (BOT_RUN)                                             // обход и его сторож -- под присмотром
{
    const _dpiStatTick = () => dpiWatchTick ('плановая проверка').catch (() => { });
    setTimeout (_dpiStatTick, 3 * 60000);                // первый раз через три минуты после старта
    const _dpiStatTimer = setInterval (_dpiStatTick, DPI_STAT_EVERY_MS);
    try { _dpiStatTimer.unref (); } catch (e) { }
}

const DPI_WORK = pathMod.join (__dirname, 'tools', 'zapret-work');
const DPI_LOG = pathMod.join (DPI_WORK, 'zapret-pick.log');
const DPI_CHOSEN = pathMod.join (DPI_WORK, 'zapret-chosen.bat');
const DPI_KEEPER_LOCK = pathMod.join (DPI_WORK, 'keeper.lock');
const DPI_PICK_TIMEOUT_MS = 45 * 60000;          // подбор ждёт своей очереди долго: пресетов много
const DPI_STAT_EVERY_MS = 10 * 60000;            // раз в 10 минут смотрю: обход работает, а пути живы?
const DPI_STAT_TELL_MS = 60 * 60000;            // про умершую стратегию и вставший обход напоминаю не чаще раза в час
const DPI_KEEPER_TELL_MS = 12 * 3600000;        // про «за обходом никто не следит» -- не чаще раза в 12 часов
let dpiStat = { verdict: '', toldAt: 0, engine: null, keeper: null, goneTold: false, healToldAt: 0 };

async function netFlagGet (key)                  // мелкие отметки в базе: чтобы перезапуск бота не повторял уже сказанное
{
    try { const srv = dbServerList ()[0]; if (srv) return await db (srv, 'netState', key); } catch (e) { }
    return null;
}
async function netFlagSet (key, val)
{
    try { const srv = dbServerList ()[0]; if (srv) await db (srv, 'netState', key, val); } catch (e) { }
}

function dpiEnginePids ()                        // что за winws.exe сейчас работает (только чтение)
{
    return runCapture ('tasklist.exe', ['/FI', 'IMAGENAME eq winws.exe', '/FO', 'CSV', '/NH'], 8000).then (r =>
    {
        const pids = [];
        const re = /"winws\.exe","(\d+)"/gi;
        let m = null;
        while ((m = re.exec (String (r.out || '')))) pids.push (Number (m[1]));
        return pids;
    }).catch (() => []);
}
function dpiLogTail (lines)                      // последние строки журнала обхода (скрипт пишет его в UTF-8)
{
    try
    {
        const all = fsMod.readFileSync (DPI_LOG, 'utf8').replace (/^\uFEFF/, '').split (/\r?\n/)
            .filter (l => l.trim () !== '');
        return all.slice (-(lines || 12));
    }
    catch (e) { return []; }
}
function dpiChosenInfo ()                        // когда записана последняя удачная стратегия
{
    try
    {
        const st = fsMod.statSync (DPI_CHOSEN);
        return 'есть, изменена ' + new Date (st.mtimeMs).toLocaleString ('ru-RU');
    }
    catch (e) { return 'нет -- её пишет подбор'; }
}
function dpiLine (s) { return String (s || '').replace (/^\uFEFF/, '').replace (/^\[\d\d:\d\d:\d\d\]\s*/, '').trim (); }
async function psCommandRun (cmd, timeoutMs)     // одна строка PowerShell (через неё идёт всё, где нужен запрос прав)
{
    return runCapture ('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], timeoutMs || 60000);
}
async function dpiElevatedRun (switches, timeoutMs)      // запуск подбора с ОДНИМ запросом прав Windows
{
    const list = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', DPI_TOOL].concat (switches || [])
        .map (a => "'" + String (a).replace (/'/g, "''") + "'").join (', ');
    const cmd = 'Start-Process -FilePath "powershell.exe" -ArgumentList @(' + list + ') -Verb RunAs -Wait';
    return psCommandRun (cmd, timeoutMs || DPI_PICK_TIMEOUT_MS);
}
async function dpiStartRun ()        // поднять обход СОХРАНЁННОЙ стратегией (без перебора) -- тоже один запрос прав
{
    if (!fsMod.existsSync (DPI_CHOSEN))
        return { ok: false, why: 'нет tools/zapret-work/zapret-chosen.bat -- его пишет подбор (node . obhod --pick)' };
    const arg = '/c ""' + DPI_CHOSEN + '""';
    const cmd = 'Start-Process -FilePath "cmd.exe" -ArgumentList @(' + "'" + arg.replace (/'/g, "''") + "'" +
        ') -Verb RunAs -WindowStyle Hidden';
    const r = await psCommandRun (cmd, 60000);
    if (r.code !== 0) return { ok: false, why: 'разрешение не подтвердили (код ' + r.code + ')' };
    for (let i = 0; i < 12; i++)                    // движку надо время подняться
    {
        await new Promise (res => setTimeout (res, 2000));
        if ((await dpiBypassProbe ()) === true) return { ok: true };
    }
    return { ok: false, why: 'движок не появился за 24 с (смотри zapret-work/zapret-pick.log)' };
}
async function dpiPickSwitches (only, seconds, test, voice)
{
    const sw = [];
    if (only) sw.push ('-Only', String (only));
    if (seconds) sw.push ('-Seconds', String (seconds));
    if (!voice) sw.push ('-SkipVoice');          // голос проверяется только когда бот выключен
    if (test) sw.push ('-TestOnly');
    return sw;
}
async function dpiKeeperState ()                 // сторожит ли обход: живой сторож (по keeper.lock) и задача в планировщике
{
    const out = { pid: 0, proc: false, task: false };
    try
    {
        const pid = parseInt (String (fsMod.readFileSync (DPI_KEEPER_LOCK, 'utf8') || '').split (/\r?\n/)[0].replace (/\D/g, ''), 10) || 0;
        if (pid > 0)
        {
            const r = await runCapture ('tasklist.exe', ['/FI', 'PID eq ' + pid, '/FO', 'CSV', '/NH'], 8000);
            if (String (r.out || '').indexOf ('"' + pid + '"') >= 0) { out.pid = pid; out.proc = true; }
        }
    }
    catch (e) { }
    const q = await runCapture ('schtasks.exe', ['/Query', '/TN', DPI_TASK, '/FO', 'LIST'], 15000);
    out.task = (q.code === 0);
    return out;
}
function keeperWords (k)
{
    if (!k) return 'не смотрел';
    if (k.proc) return 'работает (pid ' + k.pid + ')';
    if (k.task) return 'есть в планировщике, сейчас не запущен (поднимется при входе в систему)';
    return 'нет -- обход никто не сторожит';
}

async function dpiDiscordState ()                // что с дискордом с нашей стороны: шлюз (по себе), api (лёгкий запрос), голос (если сижу в канале)
{
    let api = false;
    try { await client.rest.get ('/gateway'); api = true; } catch (e) { api = false; }
    const gw = (client.ws && typeof client.ws.status === 'number') ? (client.ws.status === 0) : null;
    let voice = false, voiceKnown = false;
    for (const g of Object.keys ($music))
    {
        const m = $music[g];
        if (!m || !m.connection) continue;
        voiceKnown = true;
        if (m.connection.state && m.connection.state.status === VoiceConnectionStatus.Ready) voice = true;
    }
    return { gw: gw, api: api, voice: voice, voiceKnown: voiceKnown };
}
async function dpiStrategyHealth (why)           // обход работает, а пути мёртвы: значит стратегия перестала помогать
{
    if (!MUSIC_DPI_HEAL || !BOT_RUN) return '';
    if ((await dpiBypassProbe ()) !== true) return '';      // обхода нет -- это другой случай, там dpiSelfHeal
    const dnsOk = await directUsable ();
    const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
    const disc = await dpiDiscordState ();
    const ytOk = !!dp.ok;                                  // свой маршрут проверкои не засчитываю: он не обязан везти музыку (см. /health и строку путей)
    const discOk = (disc.gw !== false) && disc.api;
    const verdict = (ytOk && discOk) ? 'ok' : (discOk ? 'yt' : (ytOk ? 'disc' : 'both'));
    const was = dpiStat.verdict;
    dpiStat.verdict = verdict;
    if (verdict === 'ok')
    {
        if (was && was !== 'ok')
            await notifyHoster ('✅ **Обход снова помогает:** ютуб отвечает' + (disc.api ? ', дискорд тоже' : '') + '. Делать ничего не нужно.');
        return verdict;
    }
    const what = (verdict === 'yt') ? 'ютуб НЕ отвечает' : (verdict === 'disc' ? 'дискорд не отвечает (а это важнее ютуба: без него бота в комнате нет)'
        : 'ни ютуб, ни дискорд не отвечают');
    if (verdict !== was)
        console.error ('[' + (d()) + '] [music] обход работает, а ' + what + ' -- похоже, стратегия перестала помогать' +
            (why ? ' (' + why + ')' : '') + '; нужен подбор: node . obhod --pick или кнопка в /health');
    if ((Date.now () - dpiStat.toldAt) > DPI_STAT_TELL_MS)
    {
        dpiStat.toldAt = Date.now ();
        await notifyHoster ('⚠️ **Похоже, обход перестал помогать.** Движок обхода работает, а ' + what + '.' +
            '\n_Сейчас: ютуб -- ' + (ytOk ? 'отвечает' : 'не отвечает') + '; шлюз discord -- ' +
            (disc.gw === false ? 'мёртв' : (disc.gw ? 'держится' : 'не смотрел')) + '; api discord -- ' + (disc.api ? 'отвечает' : 'НЕ отвечает') +
            '; голос -- ' + (!disc.voiceKnown ? 'не проверен (в канале не сижу)' : (disc.voice ? 'связь держится' : 'связи нет')) +
            '; сторож -- ' + keeperWords (await dpiKeeperState ()) + '._' +
            '\n_Скорее всего провайдер сменил приём, и текущая стратегия больше не подходит._' +
            '\nЧто сделать: в консоли бота `node . obhod --pick` -- он переберёт пресеты (ютуб + шлюз Discord), оставит рабочую и один раз спросит разрешение Windows; то же самое -- кнопка в /health.' +
            '\nГолос проверяется отдельно, для замера бота надо выключить: `node . obhod --pick --voice`.' +
            '\nКак отпустит -- напишу.');
    }
    return verdict;
}

async function startupPathNotice ()              // при старте: если путей нет, сказать владельцу КОРОТКО и с готовой командой
{
    if (!MUSIC_DPI_HEAL || !BOT_RUN) return;
    const before = await netFlagGet ('pathNotice');
    if (before && (Date.now () - (Number (before.at) || 0)) < 60 * 60000) return;      // за последний час уже сказали
    await new Promise (r => setTimeout (r, 45000));                                     // сеть часто поднимается вместе с системой
    const rs = await routeStatus ();
    if (!rs.noPath) return;
    await netFlagSet ('pathNotice', { at: Date.now () });
    const k = await dpiKeeperState ();
    const hasChosen = fsMod.existsSync (DPI_CHOSEN);
    const step = hasChosen ? '`node . obhod --start`' : '`node . obhod --pick`';
    const head = rs.dohOk
        ? '📡 **Прямого пути и прокси нет -- остаётся только мой маршрут по адресам.**'
        : '📡 **Музыка пока не сможет играть: к YouTube нет ни одного пути.**';
    const stepWhat = hasChosen ? 'поднять сохранённую стратегию обхода (пара секунд)' : 'подобрать рабочую стратегию обхода (перебор пресетов, это дольше)';
    const healTold = (Date.now () - (Number (dpiStat.healToldAt) || 0)) < 10 * 60000;  // про это же я только что писал -- второй раз не повторяюсь
    console.error ('[' + (d()) + '] [music] путей к YouTube нет вообще: сказал владельцу, что делать (сторож: ' + keeperWords (k) + ')');
    await notifyHoster (head +
        (healTold ? '' : '\n_Сейчас: ' + rs.parts.join ('; ') + '._') +
        '\n**Что сделать сейчас:** ' + step + ' -- ' + stepWhat + ', одно окно подтверждения Windows.' +
        (healTold ? '' : '\nИли мышкой: `tools\\obhod.cmd`, пункт 4 («подобрать и запустить»).' +
            (MUSIC_PROXIES.length ? '\nЕсли поднят VPN-прокси -- бот сам попробует его первым.' : '') +
            (rs.dohPort ? (rs.dohOk ? '\nСвой маршрут по адресам включён и моя проверка через него проходит -- но это проверка только маршрута: поедет ли музыка, не обещаю.'
                : '\nСвой маршрут по адресам включён, но и моя проверка через него пока не прошла.') : '')) +
        '\n_Сторож обхода: ' + keeperWords (k) + '. Очередь и место в треке целы: музыка ждёт, а не теряется._');
}
async function dpiWatchTick (why)                // раз в 10 минут: жив ли обход, помогает ли стратегия, есть ли сторож
{
    if (!MUSIC_DPI_HEAL || !BOT_RUN) return;
    const engine = (await dpiBypassProbe ()) === true;
    const hadEngine = (dpiStat.engine === true);
    dpiStat.engine = engine;
    if (engine)
    {
        if (dpiStat.goneTold)
        {
            dpiStat.goneTold = false;
            dpiStat.verdict = '';                    // про стратегию отдельно писать не надо: только что сказали про сам обход
            await notifyHoster ('✅ **Обход снова работает:** движок `winws.exe` поднялся.');
        }
        const v = await dpiStrategyHealth (why);
        const k = await dpiKeeperState ();
        dpiStat.keeper = k;
        if (k.proc) return;
        const told = await netFlagGet ('keeperTold');
        if (told && (Date.now () - (Number (told.at) || 0)) < DPI_KEEPER_TELL_MS) return;
        await netFlagSet ('keeperTold', { at: Date.now () });
        console.log ('[' + (d()) + '] [music] сторож обхода: ' + keeperWords (k) +
            ' -- если обход встанет, я это замечу и напишу, но чинить придётся тебе (сам я прав не спрашиваю)');
        await notifyHoster ('ℹ️ **За обходом сейчас никто не следит.** Обход работает' +
            (v === 'ok' ? ' -- ютуб и дискорд отвечают' : ' (но с путями не всё в порядке)') + '.' +
            '\n_Сторож: ' + keeperWords (k) + '._' +
            '\nЧто это значит: если обход встанет, я это замечу и напишу, но чинить придётся тебе -- сам я прав администратора не спрашиваю.' +
            '\nЧтобы сторожил и сам чинил: `tools\\obhod.cmd` -- пункт 6 («ХРАНИТЕЛЬ»), потом пункт 7 («хранитель в автозапуск»).' +
            ' Это единственное, что встаёт в автозапуск, -- и только по твоему решению.');
        return;
    }
    if (!hadEngine) return;                          // обход и раньше не работал -- этим занимаются самопомощь и стартовая проверка
    if ((Date.now () - dpiStat.toldAt) < DPI_STAT_TELL_MS) return;
    dpiStat.toldAt = Date.now ();
    dpiStat.goneTold = true;
    const k = await dpiKeeperState ();
    const svc = await serviceState ('zapret');
    console.error ('[' + (d()) + '] [music] обход встал: движка winws.exe больше нет (служба zapret: ' + svcWords (svc) + '; сторож: ' + keeperWords (k) + ')');
    await notifyHoster ('⚠️ **Обход встал** -- движка `winws.exe` больше нет.' +
        '\n_Служба zapret: ' + svcWords (svc) + '; сторож: ' + keeperWords (k) + '._' +
        '\nЧто сделать: `node . obhod --start` -- поднять сохранённую стратегию (пара секунд), или `tools\\obhod.cmd`.' +
        (k.proc ? '\n_Сторож работает, но обход не поднял -- значит и ему не хватило прав: запусти пункт 6 в `tools\\obhod.cmd` от администратора._' : '') +
        '\nКак поднимется -- напишу.');
}

async function obhodCli (args)                   // node . obhod: что с обходом и что можно сделать (права -- только на запуск/смену)
{
    $cliOwnScreen ();
    const cli = (args || []).map (_a => String (_a));
    const has = _k => cli.some (_a => new RegExp ('^' + _k + '$', 'i').test (_a));
    const val = _k => { const _i = cli.findIndex (_a => new RegExp ('^' + _k + '$', 'i').test (_a)); return _i >= 0 ? String (cli[_i + 1] || '') : ''; };
    const say = _s => console.log ('[obhod] ' + _s);

    if (!fsMod.existsSync (DPI_TOOL))
    {
        say ('рядом с ботом нет tools/zapret-pick.ps1 -- подбирать обход нечем. Положи набор zapret в tools/ и повтори.');
        return 1;
    }

    if (has ('--engine'))
    {
        say ('приношу движок zapret (без прав; если папка уже есть -- ничего не качаю, только показываю её)...');
        const r = await dpiToolRun (['-EngineOnly'], 300000);
        for (const l of String (r.out || '').split (/\r?\n/)) if (dpiLine (l)) say (dpiLine (l));
        say (r.code === 0 ? 'движок на месте.' : 'движка нет и скачать не вышло -- положи набор zapret вручную.');
        return r.code === 0 ? 0 : 1;
    }

    if (has ('--stop'))
    {
        say ('останавливаю обход и возвращаю службу zapret как было...');
        say ('сейчас Windows спросит разрешение -- подтверди окно, иначе ничего не меняется.');
        const r = await dpiElevatedRun (['-Restore'], 180000);
        const pids = await dpiEnginePids ();
        say (r.code === 0
            ? 'готово: обход остановлен (winws.exe: ' + (pids.length ? 'ещё работает, pid ' + pids.join (', ') : 'не запущен') + '), служба zapret возвращена как была.'
            : 'не вышло (код ' + r.code + '): похоже, разрешение не дали -- ничего не менял.');
        return r.code === 0 ? 0 : 1;
    }

    if (has ('--start'))
    {
        if (!fsMod.existsSync (DPI_CHOSEN))
        {
            say ('поднимать нечего: нет tools/zapret-work/zapret-chosen.bat -- его пишет подбор (node . obhod --pick)');
            return 1;
        }
        say ('поднимаю обход сохранённой стратегией (быстро, без перебора)...');
        say ('сейчас Windows спросит разрешение -- подтверди окно, иначе ничего не меняется.');
        const r = await dpiStartRun ();
        if (r.ok)
        {
            const pids = await dpiEnginePids ();
            const dnsOk = await directUsable ();
            const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
            say ('готово: движок работает' + (pids.length ? ' (pid ' + pids.join (', ') + ')' : '') + ', ютуб ' + (dp.ok ? 'отвечает' : 'пока не отвечает (' + (dp.why || 'нет ответа') + ')'));
            return 0;
        }
        say ('не вышло: ' + r.why);
        say ('посмотреть, что есть сейчас: node . obhod; подобрать заново: node . obhod --pick');
        return 1;
    }

    if (has ('--pick'))
    {
        const only = val ('--only'), seconds = Number (val ('--seconds')) || 0;
        const test = has ('--test'), voice = has ('--voice');
        const list = await dpiToolRun (['-List'], 30000);
        const presets = (String (list.out || '').match (/ :: /g) || []).length;
        const each = seconds || 6;
        const mins = presets ? Math.round ((presets * (each + 4) + 30) / 60) : 0;
        if (presets) say ('к проверке пресетов: ' + presets + ' (по ' + each + ' с на каждый)' + (mins ? ' -- это примерно ' + mins + ' мин' : ''));
        say ('внимание: на время подбора обход останавливается -- ютуб и дискорд будут недоступны, потом встанет лучшая стратегия');
        say (voice ? 'голосовой канал проверю (для этого бот должен быть выключен)' : 'голосовой канал не проверяю: для этого бота надо выключить (впиши --voice, если выключен)');
        say ('сейчас Windows спросит разрешение -- подтверди окно; без него ничего не меняется.');
        const r = await dpiElevatedRun (await dpiPickSwitches (only, seconds, test, voice));
        say ('подбор закончен (код ' + r.code + ').');
        const tail = dpiLogTail (14);
        if (tail.length) { say ('последнее из журнала (tools/zapret-work/zapret-pick.log):'); for (const l of tail) say ('  ' + dpiLine (l)); }
        const pids = await dpiEnginePids ();
        const dnsOk = await directUsable ();
        const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
        say ('сейчас: ютуб ' + (dp.ok ? 'отвечает' : 'не проходит (' + (dp.why || 'нет ответа') + ')') +
            '; обход ' + (pids.length ? 'работает (winws.exe, pid ' + pids.join (', ') + ')' : 'не запущен'));
        say ('удачная стратегия записана: tools/zapret-work/zapret-chosen.bat -- ' + dpiChosenInfo () + '.');
        say ('в автозапуск я ничего не ставлю: захочешь сам -- положи zapret-chosen.bat в автозапуск или поставь службу из набора zapret.');
        if (r.code !== 0) say ('ненулевой код обычно значит «разрешение не подтвердили» или «ни одна стратегия не подошла»: смотри журнал выше.');
        return r.code === 0 ? 0 : 1;
    }

    say ('обход блокировки: что сейчас (только чтение, ничего не меняю)');
    const chk = await dpiToolRun (['-Check'], 40000);
    for (const l of String (chk.out || '').split (/\r?\n/))
    {
        const t = dpiLine (l);
        if (t && !/^=====/.test (t)) say (t);
    }
    const pids = await dpiEnginePids ();
    const keeper = await dpiKeeperState ();
    say ('движок winws.exe: ' + (pids.length ? 'работает (pid ' + pids.join (', ') + ')' : 'не запущен') +
        '; последняя удачная стратегия: ' + dpiChosenInfo ());
    say ('сторож обхода (кто следит и чинит сам): ' + keeperWords (keeper) + ' -- это запуск `obhod.cmd` с пунктом 6;');
    say ('  автозапуск -- это только то, кто поднимает сторожа при входе в систему (тот же обход.cmd, пункт 7), и это решаешь ты.');
    say ('права администратора нужны только на запуск, остановку и смену стратегии обхода; проверка и «принести движок» -- без прав.');
    say ('что можно сделать:');
    say ('  node . obhod --engine            принести движок zapret (без прав)');
    say ('  node . obhod --pick [--only ALT] [--seconds 8] [--test] [--voice]');
    say ('                                   подобрать и оставить рабочую стратегию (один запрос прав Windows)');
    say ('  node . obhod --start             поднять обход сохранённой стратегией (быстро, один запрос прав)');
    say ('  node . obhod --stop              остановить обход и вернуть службу zapret как было (один запрос прав)');
    say ('в автозапуск ничего не ставлю и чужую систему не переписываю; то же самое есть меню: tools/obhod.cmd');
    return 0;
}

async function dpiPickFromDiscord ()             // кнопка у владельца: подбор из Discord, результат -- письмом
{
    if (dpiHealBusy) { await notifyHoster ('🛠 Подбор обхода уже идёт -- дождусь его и напишу.'); return; }
    dpiHealBusy = true;
    try
    {
        const before = await dpiEnginePids ();
        const r = await dpiElevatedRun (['-SkipVoice']);
        const pids = await dpiEnginePids ();
        const dnsOk = await directUsable ();
        const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
        const head = (r.code === 0)
            ? '🛠 **Подбор обхода закончен.** Сейчас: ютуб ' + (dp.ok ? 'отвечает' : 'не проходит (' + (dp.why || 'нет ответа') + ')') +
                '; обход ' + (pids.length ? 'работает (winws.exe, pid ' + pids.join (', ') + ')' : 'не запущен')
            : '🚨 **Подбор обхода не прошёл** (код ' + r.code + '): похоже, разрешение не подтвердили или ни одна стратегия не подошла.';
        const tail = dpiLogTail (10).map (dpiLine).map (l => l.length > 160 ? l.slice (0, 160) + '…' : l);
        await notifyHoster (head +
            '\n_Было: ' + (before.length ? 'движок работал (pid ' + before.join (', ') + ')' : 'обход не запущен') + '._' +
            (tail.length ? '\n_Последнее из журнала:_\n```\n' + tail.join ('\n') + '\n```' : '') +
            (fsMod.existsSync (DPI_CHOSEN) ? '\n_Рабочая стратегия записана: tools/zapret-work/zapret-chosen.bat._' : ''));
    }
    catch (e) { await notifyHoster ('🚨 Подбор обхода сорвался: ' + ((e && e.message) || e)); }
    finally { dpiHealBusy = false; }
}
if (BOT_RUN) setImmediate (() => reportRoutes ());   // после загрузки модуля: не торопит старт и не трогает ещё не объявленные настройки
if (BOT_RUN)
{
    setTimeout (async () =>                                       // собрал адреса из ЖИВЫХ соединений системы
    {
        await poolHarvest ();
        try
        {
            await netHoursLoad ();                                  // таблица по часам -- чтобы измерения шли с первой минуты
            await Promise.race ([netCacheHarvest (), new Promise (_r => setTimeout (_r, 12000))]);   // взял живой справочник системы
            await Promise.race ([dnsWarm (), new Promise (_r => setTimeout (_r, 8000))]);
            const i = await dnsBookInfo ();
            await ipNamesLoad ();
            const pools = Object.keys (ipMem || {}).filter (k => k.indexOf ('pool:') === 0)
                .map (k =>
                {
                    const ipList = Object.keys ((ipMem[k] || {}).ips || {});
                    const named = ipList.filter (ip => !!ipNameOf (ip)).length;
                    return k.slice (5) + ': ' + ipList.length + (named ? ' (с именем ' + named + ')' : '');
                }).join (', ');
            console.log ('[' + (d()) + '] [net] книга имя↔адрес: имён ' + i.names + ', адресов ' + i.ips +
                ', свежих записей ' + i.fresh + (pools ? '; копилки -- ' + pools : ''));
            await netGuessLoad ();
            await netBoneLoad ();
            const bk = await dnsBookLoad (), hs = await netHoursLoad ();
            for (const v of netGuessCheck (hs)) console.log ('[' + (d()) + '] [net] сверка прогноза: ' + v);
            const bones = netBonesFind (bk, hs, ipNames);
            const bv = netBoneVerdict (netBoneLedger, bk, hs);
            if (bv) console.log ('[' + (d()) + '] [net] ' + bv);            if (bones.length) { console.log ('[' + (d()) + '] [net] зацепка (' + bones[0].kind + '): ' + bones[0].text); netBoneTake (bones); }
            for (const l of netLinksLines (bk, ipMem, ipNames, 2)) console.log ('[' + (d()) + '] [net] ' + l);
            for (const l of netPlanLines (bk, ipMem, ipNames).slice (0, 2)) console.log ('[' + (d()) + '] [net] план: ' + l);
            netGuessMake (hs);
            for (const l of netForecastLines (hs, netGuess, netGuessScore).filter (x => /^(на |опасаться|мои прогнозы|прогноз)/.test (x)).slice (0, 4))
                console.log ('[' + (d()) + '] [net] ' + l);
        }
        catch (e) { }
    }, 5000);
    const poolTimer = setInterval (() =>
    {
        poolHarvest ();
        netCacheHarvest ();        // живой справочник системы меняется постоянно -- беру заново
        dnsWarm ();
        dnsBookLoad ().then (() => { dnsAgeMark (); dnsBookSave (true); }).catch (() => { });
        netHoursSave (true);
    }, 5 * 60 * 1000);
    try { poolTimer.unref (); } catch (e) { }
    const reportTimer = setInterval (async () =>                       // разбор собранного -- раз в час, коротко
    {
        try
        {
            const book = await dnsBookLoad (), hours = await netHoursLoad ();
            await netGuessLoad ();
            await netBoneLoad ();
            const lines = netAnalyticsLines (book, hours);
            console.log ('[' + (d()) + '] [net] разбор за час: ' + lines.slice (0, 3).join (' | '));
            for (const v of netGuessCheck (hours)) console.log ('[' + (d()) + '] [net] сверка прогноза: ' + v);
            const bones = netBonesFind (book, hours, ipNames);
            const bv = netBoneVerdict (netBoneLedger, book, hours);
            if (bv) console.log ('[' + (d()) + '] [net] ' + bv);            if (bones.length) { console.log ('[' + (d()) + '] [net] зацепка (' + bones[0].kind + '): ' + bones[0].text); netBoneTake (bones); }
            for (const l of netLinksLines (book, ipMem, ipNames, 2)) console.log ('[' + (d()) + '] [net] ' + l);
            for (const l of netPlanLines (book, ipMem, ipNames).slice (0, 2)) console.log ('[' + (d()) + '] [net] план: ' + l);
            netGuessMake (hours);
            for (const l of netForecastLines (hours, netGuess, netGuessScore).filter (x => /^(на |опасаться|мои прогнозы|прогноз)/.test (x)).slice (0, 4))
                console.log ('[' + (d()) + '] [net] ' + l);
        }
        catch (e) { }
    }, 60 * 60 * 1000);
    try { reportTimer.unref (); } catch (e) { }
    const warmTimer = setInterval (() => dnsWarm (), 60 * 1000);   // просроченные записи обновляю сам, чтобы книга не пустела
    try { warmTimer.unref (); } catch (e) { }
}


const MUSIC_DOH = MUSIC_CFG.doh !== false;
const MUSIC_DPI_HEAL = MUSIC_CFG.dpi_heal !== false;   // когда ни один путь не работает -- пробую поднять обход DPI сам
const DOH_RESOLVERS =
[
    { name: 'Cloudflare', ip: '1.1.1.1',   host: 'cloudflare-dns.com',        path: '/dns-query' },
    { name: 'Google',     ip: '8.8.8.8',   host: 'dns.google',                path: '/resolve' },
    { name: 'Quad9',      ip: '9.9.9.9',   host: 'dns.quad9.net',             path: '/dns-query' },
    { name: 'Яндекс',     ip: '77.88.8.8', host: 'common.dot.dns.yandex.net', path: '/dns-query' }
];
let dohGoodIdx = 0;
let dohLastOkAt = 0;
let dohProxyPort = 0;
let dohCalls = 0, dohOops = 0;
const dohCache = new Map ();
const DOH_TTL = 120000;

function dohBadIp (ip)
{
    const s = String (ip || '');
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test (s)) return true;
    return /^(0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test (s);
}

function dohAsk (resolver, name, timeoutMs)
{
    const _wait = Number (timeoutMs) > 0 ? Number (timeoutMs) : 5000;
    return new Promise (res =>
    {
        let done = false;
        const fin = v => { if (!done) { done = true; res (v); } };
        const req = require ('https').request ({
            host: resolver.ip, servername: resolver.host, port: 443, method: 'GET',
            path: resolver.path + '?name=' + encodeURIComponent (name) + '&type=A',
            headers: { host: resolver.host, accept: 'application/dns-json' }, timeout: _wait
        }, r =>
        {
            if (r.statusCode !== 200) { try { r.resume (); } catch (e) { } return fin (null); }
            let b = '';
            r.on ('data', d => { if (b.length < 20000) b += d; });
            r.on ('end', () =>
            {
                try
                {
                    const j = JSON.parse (b);
                    const ans = (j.Answer || []).filter (a => a.type === 1);
                    const ips = ans.map (a => a.data).filter (x => !dohBadIp (x));
                    const ttl = Math.min.apply (null, ans.map (a => Number (a.TTL) || 0).filter (t => t > 0).concat ([0]));
                    fin (ips.length ? { ip: ips[0], ips: ips, ttl: ttl, ad: !!j.AD } : null);   // j.AD -- ответ подписан и проверен справочником
                }
                catch (e) { fin (null); }
            });
        });
        req.on ('timeout', () => { try { req.destroy (); } catch (e) { } fin (null); });
        req.on ('error', () => fin (null));
        req.end ();
    });
}


const KNOWN_DNS = ['77.88.8.8', '77.88.8.1', '9.9.9.9', '94.140.14.14', '1.1.1.1', '8.8.8.8', '208.67.222.222'];
let plainDnsList = null;
function plainDnsServers ()
{
    if (plainDnsList) return plainDnsList;
    const out = [];
    const is4 = s => /^(\d{1,3}\.){3}\d{1,3}$/.test (String (s || ''));
    try { for (const s of require ('dns').getServers ()) if (is4 (s) && out.indexOf (s) === -1) out.push (s); } catch (e) { }
    for (const s of KNOWN_DNS) if (out.indexOf (s) === -1) out.push (s);   // знакомые: если системный не ответит -- спрошу их
    plainDnsList = out.slice (0, 8);
    return plainDnsList;
}

function dnsEncodeName (name)
{
    const out = [];
    for (const p of String (name).split ('.')) { out.push (p.length); for (let i = 0; i < p.length; i++) out.push (p.charCodeAt (i) & 0xff); }
    out.push (0);
    return Buffer.from (out);
}

function dnsParseA (buf, id)
{
    if (!buf || buf.length < 12 || buf.readUInt16BE (0) !== id) return null;
    const ancount = buf.readUInt16BE (6);
    if (!ancount) return null;
    let off = 12;
    const skipName = () =>
    {
        while (off < buf.length)
        {
            const len = buf[off];
            if (len === 0) { off++; return; }
            if ((len & 0xc0) === 0xc0) { off += 2; return; }
            off += 1 + len;
        }
    };
    const qd = buf.readUInt16BE (4);
    for (let i = 0; i < qd; i++) { skipName (); off += 4; }
    const ips = [];
    for (let i = 0; i < ancount; i++)
    {
        skipName ();
        if (off + 10 > buf.length) break;
        const type = buf.readUInt16BE (off); off += 8;
        const rdlen = buf.readUInt16BE (off); off += 2;
        if (type === 1 && rdlen === 4) ips.push (buf[off] + '.' + buf[off + 1] + '.' + buf[off + 2] + '.' + buf[off + 3]);
        off += rdlen;
    }
    return ips;
}

function plainDnsAsk (server, name, timeoutMs = 1500)
{
    return new Promise (res =>
    {
        let done = false;
        const fin = v => { if (!done) { done = true; res (v); } };
        try
        {
            const dgram = require ('dgram');
            const sock = dgram.createSocket ('udp4');
            const id = 1 + ((Math.random () * 65000) | 0);
            const head = Buffer.alloc (12);
            head.writeUInt16BE (id, 0);
            head.writeUInt16BE (0x0100, 2);
            head.writeUInt16BE (1, 4);
            const body = Buffer.concat ([head, dnsEncodeName (name), Buffer.from ([0, 1, 0, 1])]);
            const t = setTimeout (() => { try { sock.close (); } catch (e) { } fin (null); }, timeoutMs);
            sock.on ('message', m =>
            {
                clearTimeout (t);
                const ips = dnsParseA (m, id);
                try { sock.close (); } catch (e) { }
                const good = ips ? ips.filter (x => !dohBadIp (x)) : [];   // подмена (127./10./192.168. и т.п.) -- не беру
                fin (good.length ? { ip: good[0], ips: good, ttl: 0 } : null);
            });
            sock.on ('error', () => { clearTimeout (t); try { sock.close (); } catch (e) { } fin (null); });
            sock.send (body, 53, server, e => { if (e) { clearTimeout (t); try { sock.close (); } catch (e2) { } fin (null); } });
        }
        catch (e) { fin (null); }
    });
}

let ipViaLogged = '';
function ipViaLog (via, extra)
{
    if (!BOT_RUN || (via + extra) === ipViaLogged) return;
    ipViaLogged = via + extra;
    console.log ('[' + (d()) + '] [music] ' + via + (extra ? ' (' + extra + ')' : '') +
        ' -- IP отдаю загрузчику (yt-dlp) через свой локальный маршрут, системный DNS и hosts не нужны');
}

// Хранение: ЗАПИСИ НЕ УДАЛЯЮТСЯ НИКОГДА -- ни по количеству, ни по возрасту. Информация получена,
// значит, её надо использовать: старый адрес однажды снова заработает, а блокировка -- дело временное.
// Полгода -- это не срок хранения, а только порог пометки «древнее»: такие адреса уходят в конец
// списка выбора, но остаются в книге и продолжают использоваться, когда свежие не ответили.
const NET_KEEP_MS = 180 * 24 * 60 * 60 * 1000;
const NET_TRIM_EVERY_MS = 5 * 60 * 1000;   // чистку от древностей делаю редко: книга большая
const DNS_TTL_DEF = 10 * 60 * 1000;
const DNS_TTL_MIN = 60 * 1000;
const DNS_TTL_MAX = 24 * 60 * 60 * 1000;
// (предела на число копилок нет и быть не должно: адреса только накапливаются)
let ipMem = null;                 // только копилки сервисов (pool:youtube, pool:discord)
let ipMemLoading = null;
let dnsBook = null;               // имя -> запись
let dnsBookLoading = null;
let dnsStats = null;              // источник -> { ok, fail, ms, at }
let dnsSaveTimer = null;
let dnsSaveBusy = false;

async function ipMemLoad ()
{
    if (ipMem) return ipMem;
    if (ipMemLoading) return ipMemLoading;
    ipMemLoading = (async () =>
    {
        let val = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv) val = await db (srv, 'netState', 'ip_map');
        }
        catch (e) { }
        ipMem = (val && typeof val === 'object' && !Array.isArray (val)) ? val : {};
        ipMemLoading = null;
        return ipMem;
    }) ();
    return ipMemLoading;
}
async function ipMemSave ()
{
    try
    {
        const srv = dbServerList ()[0];
        if (srv) await db (srv, 'netState', 'ip_map', ipMem);
    }
    catch (e) { }
}

let ipNames = null;               // обратная сторона книги: адрес -> имя (чтобы у любого адреса было имя)
let ipNamesLoading = null;
const IP_NAMES_PER_IP = 8;        // у одного адреса бывает несколько имён (общие узлы, хостинги).
                                  // Держу их все, а список чищу только когда он длинный -- и только от древнего
async function ipNamesLoad ()
{
    if (ipNames) return ipNames;
    if (ipNamesLoading) return ipNamesLoading;
    ipNamesLoading = (async () =>
    {
        let val = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv) val = await db (srv, 'netState', 'ip_names');
        }
        catch (e) { }
        ipNames = (val && typeof val === 'object' && !Array.isArray (val)) ? val : {};
        ipNamesLoading = null;
        return ipNames;
    }) ();
    return ipNamesLoading;
}
let ipNamesSaveTimer = null;
let ipNamesSaveBusy = false;
let ipNamesTrimAt = 0;
async function ipNamesSave (now)                 // пишу не на каждую запись, а по таймеру: иначе на одну
{                                               // порцию из справочника уходило бы до сотни записей в базу
    if (!now)
    {
        if (ipNamesSaveTimer) return;
        ipNamesSaveTimer = setTimeout (() => { ipNamesSaveTimer = null; ipNamesSave (true); }, 2000);
        try { ipNamesSaveTimer.unref (); } catch (e) { }
        return;
    }
    if (ipNamesSaveBusy || !ipNames) return;
    ipNamesSaveBusy = true;
    try
    {
        const srv = dbServerList ()[0];
        if (srv) await db (srv, 'netState', 'ip_names', ipNames);
    }
    catch (e) { }
    ipNamesSaveBusy = false;
}
async function ipNamesNote (name, ips)
{
    if (!name || !ips || !ips.length) return;
    await ipNamesLoad ();
    const now = Date.now ();
    for (const ip of ips)
    {
        if (!ip || dohBadIp (ip)) continue;
        const key = String (ip);
        const rec = ipNames[key] || (ipNames[key] = { names: {}, at: 0 });
        if (!rec.names)
        {
            rec.names = {};                        // запись прежнего вида (одно имя) -- перевожу на список
            if (rec.name) rec.names[rec.name] = rec.at || now;
            delete rec.name;
        }
        rec.names[name] = now;    // НИЧЕГО НЕ УДАЛЯЮ: держу все имена адреса, древнее -- только помечаю
        rec.at = now;
    }
    if ((now - ipNamesTrimAt) >= NET_TRIM_EVERY_MS)
    {
        ipNamesTrimAt = now;
        for (const _k of Object.keys (ipNames))
        {
            const _r = ipNames[_k];
            _r.old = ((now - (_r.at || 0)) > NET_KEEP_MS);
        }
    }
    ipNamesSave ();
}
function ipNamesOf (ip)                   // свежие имена вперёд, древние -- в конец, но никуда не пропадают
{
    const rec = ipNames ? ipNames[String (ip || '')] : null;
    if (!rec) return [];
    if (rec.names)
        return Object.keys (rec.names).sort ((a, b) =>
        {
            const now = Date.now (), ta = rec.names[a] || 0, tb = rec.names[b] || 0;
            const oa = ((now - ta) > NET_KEEP_MS) ? 1 : 0, ob = ((now - tb) > NET_KEEP_MS) ? 1 : 0;
            if (oa !== ob) return oa - ob;
            return tb - ta;
        });
    return rec.name ? [rec.name] : [];     // запись прежнего вида
}
function ipNameOf (ip) { const list = ipNamesOf (ip); return list.length ? list[0] : ''; }

async function dnsBookLoad ()
{
    if (dnsBook) return dnsBook;
    if (dnsBookLoading) return dnsBookLoading;
    dnsBookLoading = (async () =>
    {
        let map = null, st = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv) { map = await db (srv, 'dnsbook', 'map'); st = await db (srv, 'dnsbook', 'stats'); }
        }
        catch (e) { }
        dnsBook = (map && typeof map === 'object' && !Array.isArray (map)) ? map : {};
        dnsStats = (st && typeof st === 'object' && !Array.isArray (st)) ? st : {};
        try
        {
            const old = await ipMemLoad ();
            let moved = 0;
            for (const k of Object.keys (old))
            {
                const r = old[k];
                if (!r || !r.ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test (String (r.ip))) continue;
                const rec = dnsBook[k] || (dnsBook[k] = dnsRecMake (k));
                if (!rec.ips.some (x => x.ip === r.ip)) rec.ips.push ({ ip: r.ip, at: r.at || Date.now (), ms: 0, src: 'прежняя книга', ok: 0, fail: 0, lastUsed: 0 });
                rec.at = Math.max (rec.at || 0, r.at || 0);
                delete old[k];
                moved++;
            }
            if (moved)
            {
                await ipMemSave ();
                dnsSaveTimer = null;
                await dnsBookSave (true);
                console.log ('[' + (d()) + '] [music] книгу адресов перенёс в отдельную таблицу: ' + moved + ' имён');
            }
        }
        catch (e) { }
        dnsBookLoading = null;
        return dnsBook;
    }) ();
    return dnsBookLoading;
}

async function dnsBookSave (now)
{
    if (!now)
    {
        if (dnsSaveTimer) return;
        dnsSaveTimer = setTimeout (() => { dnsSaveTimer = null; dnsBookSave (true); }, 2000);
        try { dnsSaveTimer.unref (); } catch (e) { }
        return;
    }
    if (dnsSaveBusy || !dnsBook) return;
    dnsSaveBusy = true;
    try
    {
        const srv = dbServerList ()[0];
        if (srv) { await db (srv, 'dnsbook', 'map', dnsBook); await db (srv, 'dnsbook', 'stats', dnsStats || {}); }
    }
    catch (e) { }
    dnsSaveBusy = false;
}

function dnsRecMake (name)
{
    return { name: name, ips: [], ttl: DNS_TTL_DEF, at: 0, src: '', hits: 0, fails: 0, lastUsed: 0 };
}
async function dnsRec (name)
{
    const book = await dnsBookLoad ();
    if (!book[name]) book[name] = dnsRecMake (name);
    return book[name];
}
function dnsIpSlot (rec, ip)
{
    let r = rec.ips.find (x => x.ip === ip);
    if (!r) { r = { ip: ip, at: 0, ms: 0, src: '', ok: 0, fail: 0, lastUsed: 0 }; rec.ips.push (r); }
    return r;
}
let dnsTrimAt = 0;
function dnsAgeMark ()            // НИЧЕГО НЕ УДАЛЯЮ. Только помечаю старое, чтобы знать, что брать первым
{
    if (!dnsBook) return;
    const now = Date.now ();
    if ((now - dnsTrimAt) < NET_TRIM_EVERY_MS) return;    // не чаще раза в 5 минут: книга большая
    dnsTrimAt = now;
    for (const name of Object.keys (dnsBook))
    {
        const rec = dnsBook[name];
        rec.old = ((now - Math.max (rec.lastUsed || 0, rec.at || 0)) > NET_KEEP_MS);   // имя давно не спрашивали
        if (!rec.ips) continue;
        for (const x of rec.ips)
            x.old = ((now - Math.max (x.lastUsed || 0, x.at || 0)) > NET_KEEP_MS);    // адрес давно не отвечал
    }
}
async function dnsNote (name, ips, ms, src, ttlSec, secure)     // secure: адрес -> { ad, cnt }
{
    const book = await dnsBookLoad ();
    const rec = book[name] || (book[name] = dnsRecMake (name));
    const now = Date.now ();
    const list = Array.isArray (ips) ? ips : [ips];
    const taken = [];
    for (const ip of list)
    {
        if (!ip || dohBadIp (ip)) continue;
        const had = rec.ips.some (x => x.ip === ip);
        const r = dnsIpSlot (rec, ip);
        r.at = now;
        if (!r.firstAt) r.firstAt = now;                              // когда адрес впервые увидели
        r.src = src;
        r.ms = r.ms ? Math.round (r.ms * 0.6 + ms * 0.4) : ms;
        const _i = secure && secure[ip];
        if (_i)
        {
            if (_i.ad) r.ad = true;                                   // ответ по этому адресу был с проверенной подписью
            if (_i.cnt) r.cnt = Math.max (r.cnt || 0, _i.cnt);        // сколько независимых справочников его назвали
        }
        if (!had && rec.ips.length > 1) { rec.newAddrs = (rec.newAddrs || 0) + 1; rec.lastNewAt = now; }   // адреса имени плавают
        taken.push (ip);
    }
    if (taken.length) hoursTouch ('', true, 0, taken.length);
    if (taken.length) await ipNamesNote (name, taken);     // обратная запись: этот адрес -- такое-то имя
    rec.at = now;
    rec.src = src;
    rec.ttl = Math.max (DNS_TTL_MIN, Math.min (DNS_TTL_MAX, ttlSec ? ttlSec * 1000 : (rec.ttl || DNS_TTL_DEF)));
    dnsAgeMark ();
    dnsBookSave ();
    return rec;
}
function dnsIpCmp (now)         // один порядок выбора и для ответа, и для перебора при соединении
{
    return (a, b) =>
    {
        const sa = a.ad ? 1 : 0, sb = b.ad ? 1 : 0;
        if (sa !== sb) return sb - sa;                                    // подпись проверена -- такого не подменить
        const pa = a.played ? 1 : 0, pb = b.played ? 1 : 0;
        if (pa !== pb) return pb - pa;                                   // по нему уже качалась музыка -- он первый
        const ca = Number (a.cnt) || 0, cb = Number (b.cnt) || 0;
        if (ca !== cb) return cb - ca;                                    // что подтвердили больше справочников -- вперёд
        const oa = a.old ? 1 : 0, ob = b.old ? 1 : 0;
        if (oa !== ob) return oa - ob;                                    // свежие (не древние) -- вперёд
        const da = (a.fail > 0 && (now - a.fail) < 600000) ? 1 : 0;      // кто не сбоил -- вперёд
        const db = (b.fail > 0 && (now - b.fail) < 600000) ? 1 : 0;
        if (da !== db) return da - db;
        if ((b.at || 0) !== (a.at || 0)) return (b.at || 0) - (a.at || 0);   // потом самые свежие
        return (a.ms || 0) - (b.ms || 0);                                  // потом самые быстрые
    };
}
function dnsBestIp (rec)
{
    if (!rec || !rec.ips || !rec.ips.length) return null;
    const now = Date.now ();
    const awake = rec.ips.filter (x => !(x.fail > 0 && (now - x.fail) < DNS_FAIL_ASLEEP));
    const pool = awake.length ? awake : rec.ips.slice ();
    pool.sort (dnsIpCmp (now));
    return pool[0].ip;
}
async function ipRemember (name, ip)
{
    const rec = await dnsRec (name);
    const was = rec.ips.length ? rec.ips[0].ip : '';
    await dnsNote (name, [ip], 0, rec.src || 'свой ответ', 0);
    if (was !== ip)
        console.log ('[' + (d()) + '] [music] записал адрес: ' + name + ' -> ' + ip + (was ? ' (было ' + was + ')' : ''));
}
function dnsSrcStat (src)
{
    if (!dnsStats) dnsStats = {};
    if (!dnsStats[src]) dnsStats[src] = { ok: 0, fail: 0, ms: 0, at: 0 };
    return dnsStats[src];
}
function dnsNoteSrc (src, ok, ms)
{
    const s = dnsSrcStat (src);
    if (ok) { s.ok++; s.ms = s.ms ? Math.round (s.ms * 0.7 + ms * 0.3) : ms; s.at = Date.now (); }
    else s.fail++;
    hoursTouch (src, ok, ms, 0);
    dnsBookSave ();
}

// --- Измерение времени: у каждого часа своя таблица -----------------------------
// Справочники и адреса ведут себя по-разному в разное время суток, и без этого измерения
// закономерность не видна: то, что вечером не отвечает, утром может быть лучшим.
let netHours = null;
let netHoursLoading = null;
let netHoursSaveTimer = null;
let netHoursSaveBusy = false;
function hourKey (t)
{
    const d = new Date (t || Date.now ()), p = n => String (n).padStart (2, '0');
    return d.getFullYear () + '-' + p (d.getMonth () + 1) + '-' + p (d.getDate ()) + 'T' + p (d.getHours ());
}
async function netHoursLoad ()
{
    if (netHours) return netHours;
    if (netHoursLoading) return netHoursLoading;
    netHoursLoading = (async () =>
    {
        let val = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv) val = await db (srv, 'netState', 'hours');
        }
        catch (e) { }
        netHours = (val && typeof val === 'object' && !Array.isArray (val)) ? val : {};
        netHoursLoading = null;
        return netHours;
    }) ();
    return netHoursLoading;
}
function netHoursSave (now)
{
    if (!now)
    {
        if (netHoursSaveTimer) return;
        netHoursSaveTimer = setTimeout (() => { netHoursSaveTimer = null; netHoursSave (true); }, 3000);
        try { netHoursSaveTimer.unref (); } catch (e) { }
        return;
    }
    if (netHoursSaveBusy || !netHours) return;
    netHoursSaveBusy = true;
    (async () =>
    {
        try
        {
            const srv = dbServerList ()[0];
            if (srv) await db (srv, 'netState', 'hours', netHours);
        }
        catch (e) { }
        netHoursSaveBusy = false;
    }) ();
}
function hoursBucket (key)
{
    if (!netHours) return null;
    const b = netHours[key] || (netHours[key] = { ok: 0, fail: 0, ms: 0, ips: 0, bySrc: {} });
    if (!b.bySrc) b.bySrc = {};
    return b;
}
function hoursTouch (src, ok, ms, ips)
{
    if (!netHours) return;                       // ещё не загрузили -- пропускаю, не теряю ничего важного
    const b = hoursBucket (hourKey ());
    if (!b) return;
    if (ips) b.ips += ips;
    if (src)
    {
        const s = b.bySrc[src] || (b.bySrc[src] = { ok: 0, fail: 0, ms: 0 });
        if (ok) { s.ok++; s.ms = s.ms ? Math.round (s.ms * 0.7 + ms * 0.3) : ms; b.ok++; b.ms = b.ms ? Math.round (b.ms * 0.7 + ms * 0.3) : ms; }
        else { s.fail++; b.fail++; }
    }
    netHoursSave ();
}
// --- Мои прогнозы и проверка зацепки --------------------------------------------
// Прогноз, который не с чем сверить, -- украшение, а не прогноз. Здесь я записываю, что
// предсказал и за что взялся, а потом сравниваю с фактом: сбылось -- или брак, и заново.
const NET_GUESS_HIT = 0.25;                 // расхождение, при котором считаю прогноз сбывшимся
const NET_GUESS_KEEP = 200;                 // в основной записи -- последние сверки, старые переезжают в архив (не пропадают)
let netGuessLogBusy = false;
function netGuessArchive (lines)            // переезд, а не удаление: сверки остаются навсегда
{
    if (!lines || !lines.length || netGuessLogBusy) return false;
    netGuessLogBusy = true;
    (async () =>
    {
        try
        {
            const srv = dbServerList ()[0];
            if (srv)
            {
                const old = await db (srv, 'netState', 'guess_log');
                const list = Array.isArray (old) ? old : [];
                for (const l of lines) list.push (l);
                await db (srv, 'netState', 'guess_log', list);
            }
        }
        catch (e) { }
        netGuessLogBusy = false;
    }) ();
    return true;
}
let netGuess = null, netGuessScore = null, netGuessLoading = null, netGuessTimer = null, netGuessBusy = false;
let netBoneLedger = null, netBoneLoading = null, netBoneTimer = null, netBoneBusy = false;
async function netGuessLoad ()
{
    if (netGuess && netGuessScore) return;
    if (netGuessLoading) return netGuessLoading;
    netGuessLoading = (async () =>
    {
        let g = null, s = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv) { g = await db (srv, 'netState', 'guess'); s = await db (srv, 'netState', 'guess_score'); }
        }
        catch (e) { }
        netGuess = (g && typeof g === 'object' && !Array.isArray (g)) ? g : { key: '', items: [], checks: [] };
        netGuessScore = (s && typeof s === 'object' && !Array.isArray (s)) ? s : {};
        if (!Array.isArray (netGuess.items)) netGuess.items = [];
        if (!Array.isArray (netGuess.checks)) netGuess.checks = [];     // сверки храню все: это история, а не мусор
        netGuessLoading = null;
        return netGuess;
    }) ();
    return netGuessLoading;
}
function netGuessSave (now)
{
    if (!now)
    {
        if (netGuessTimer) return;
        netGuessTimer = setTimeout (() => { netGuessTimer = null; netGuessSave (true); }, 3000);
        try { netGuessTimer.unref (); } catch (e) { }
        return;
    }
    if (netGuessBusy || !netGuess) return;
    netGuessBusy = true;
    (async () =>
    {
        try
        {
            const srv = dbServerList ()[0];
            if (srv) { await db (srv, 'netState', 'guess', netGuess); await db (srv, 'netState', 'guess_score', netGuessScore); }
        }
        catch (e) { }
        netGuessBusy = false;
    }) ();
}
function netGuessRateOf (src)          // как часто мои догадки про этот источник сходились с фактом
{
    const s = netGuessScore && netGuessScore[src];
    if (!s) return null;
    const n = (s.hits || 0) + (s.miss || 0);
    if (!n) return null;
    return { n: n, hits: s.hits || 0, miss: s.miss || 0, rate: n ? (s.hits || 0) / n : 0, err: n ? (s.err || 0) / n : 0 };
}
function netGuessCheck (hours)         // сверяю прошлый прогноз с фактом -- и только когда час уже прошёл
{
    const out = [];
    if (!netGuess || !netGuess.key || netGuess.key === hourKey ()) return out;
    const b = (hours || {})[netGuess.key];
    if (!b || !b.bySrc) return out;
    let done = 0;
    for (const it of netGuess.items || [])
    {
        if (it.done) continue;
        const a = (b.bySrc || {})[it.src];
        if (!a || ((a.ok || 0) + (a.fail || 0)) < 2) continue;
        const act = (a.ok || 0) / ((a.ok || 0) + (a.fail || 0));
        const err = Math.abs (act - (it.rate || 0));
        const s = netGuessScore[it.src] || (netGuessScore[it.src] = { hits: 0, miss: 0, err: 0 });
        if (err <= NET_GUESS_HIT) s.hits++; else s.miss++;
        s.err = (s.err || 0) + err;
        it.done = true;
        it.act = Math.round (act * 100) / 100;
        done++;
        const q = netGuessRateOf (it.src);
        out.push ((err <= NET_GUESS_HIT ? 'сбылось' : 'брак') + ': ' + String (netGuess.key).slice (-2) + ':00, ' + it.src +
            ' -- я говорил ' + Math.round ((it.rate || 0) * 100) + '%, вышло ' + Math.round (act * 100) + '%' +
            (q && q.n >= 3 ? ' (сходится в ' + q.hits + ' из ' + q.n + ')' : ''));
    }
    if (done)
    {
        for (const o of out) netGuess.checks.push (o);
        if (netGuess.checks.length > NET_GUESS_KEEP)
        {
            const move = netGuess.checks.slice (0, netGuess.checks.length - NET_GUESS_KEEP);
            if (netGuessArchive (move)) netGuess.checks = netGuess.checks.slice (move.length);
        }
        netGuessSave (true);
    }
    return out;
}
function netGuessMake (hours)          // прогноз на СЛЕДУЮЩИЙ час: чего жду от каждого источника
{
    const prof = netDayProfile (hours), next = (new Date ().getHours () + 1) % 24;
    const items = [];
    for (const s of Object.keys (prof))
    {
        const e = prof[s][next];
        if (!e || (e.ok + e.fail) < 2) continue;
        items.push ({ src: s, rate: Math.round (1000 * (e.ok / (e.ok + e.fail))) / 1000, ms: Math.round (e.ms || 0), n: e.ok + e.fail, done: false });
    }
    netGuess = { key: hourKey (Date.now () + 3600000), items: items, at: Date.now (), checks: netGuess.checks || [] };
    if (items.length) netGuessSave (true);
    return netGuess;
}
async function netBoneLoad ()
{
    if (netBoneLedger) return netBoneLedger;
    if (netBoneLoading) return netBoneLoading;
    netBoneLoading = (async () =>
    {
        let v = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv) v = await db (srv, 'netState', 'bone');
        }
        catch (e) { }
        netBoneLedger = (v && typeof v === 'object' && !Array.isArray (v)) ? v : null;
        netBoneLoading = null;
        return netBoneLedger;
    }) ();
    return netBoneLoading;
}
function netBoneSave (now)
{
    if (!now)
    {
        if (netBoneTimer) return;
        netBoneTimer = setTimeout (() => { netBoneTimer = null; netBoneSave (true); }, 3000);
        try { netBoneTimer.unref (); } catch (e) { }
        return;
    }
    if (netBoneBusy || !netBoneLedger) return;
    netBoneBusy = true;
    (async () =>
    {
        try
        {
            const srv = dbServerList ()[0];
            if (srv) await db (srv, 'netState', 'bone', netBoneLedger);
        }
        catch (e) { }
        netBoneBusy = false;
    }) ();
}
function netBoneTake (bones)           // беру самую сильную зацепку и запоминаю, за что взялся
{
    if (!bones || !bones.length) return;
    const b = bones[0];
    if (netBoneLedger && netBoneLedger.text === b.text) return;      // та же зацепка -- не сбрасываю счёт времени
    netBoneLedger = { kind: b.kind, ip: b.ip || '', text: b.text, score: b.score || 0, at: Date.now () };
    netBoneSave (true);
}
function netBoneVerdict (bone, book, hours)   // держится прежняя зацепка или сломалась
{
    if (!bone || !bone.text) return '';
    const held = Math.max (0, Math.round ((Date.now () - (bone.at || Date.now ())) / 3600000));
    if (bone.kind === 'надёжный адрес' || bone.kind === 'рычаг' || bone.kind === 'готовый заменитель')
    {
        let tot = 0, fail = 0;
        if (bone.ip)
            for (const nm of Object.keys (book || {}))
                for (const x of ((book[nm] || {}).ips || []))
                    if (x.ip === bone.ip) { tot += (x.ok || 0) + (x.fail || 0); fail += (x.fail || 0); }
        if (!tot) return 'зацепка держится ' + held + ' ч, по ней пока не ходили: ' + bone.text;
        if (!fail) return 'зацепка держится ' + held + ' ч: ' + bone.ip + ' -- ' + tot + ' обращений, ни одного отказа';
        return 'зацепка сломалась после ' + held + ' ч: ' + bone.ip + ' -- ' + fail + ' отказов из ' + tot + '. Берусь заново: пересчитаю зацепки по свежим данным';
    }
    return 'зацепка в работе ' + held + ' ч: ' + bone.text;
}
function dnsSourcesOrdered ()
{
    const list = [];
    for (const r of DOH_RESOLVERS) list.push ({ kind: 'doh', src: 'DoH ' + r.name, name: r.name, ip: r.ip, host: r.host, path: r.path });
    for (const s of plainDnsServers ()) list.push ({ kind: 'plain', src: 'DNS ' + s, ip: s });
    list.push ({ kind: 'system', src: 'системный резолвер', ip: '' });
    const hNow = (netHours && netHours[hourKey ()] && netHours[hourKey ()].bySrc) || {};   // что этот источник делает ИМЕННО В ЭТОТ ЧАС
    const hProf = netDayProfile (netHours || {});   // и что он делает в этот час СУТОК вообще (объединённо по всем дням)
    const score = q =>
    {
        const s = dnsStats && dnsStats[q.src];
        const h = hNow[q.src];
        const hTot = h ? ((h.ok || 0) + (h.fail || 0)) : 0;
        if (h && hTot >= 3 && !(h.ok > 0)) return Number.MAX_SAFE_INTEGER - 2;   // в этот час он не отвечал ни разу -- в конец
        if (!s || !s.ok) return Number.MAX_SAFE_INTEGER - 1;      // нет данных -- в конец, но перед системным
        const base = s.ms * (1 + s.fail / Math.max (1, s.ok));
        const g = netGuessRateOf (q.src);          // мои прежние прогнозы про него сходились с фактом?
        const blind = !!(g && g.n >= 3 && g.rate < 0.5);   // не сходятся -- его часовой профиль для меня пустой звук
        const hourBonus = (!blind && h && hTot >= 3) ? (h.ok / hTot > 0.8 ? 0.8 : 1.2) : 1;   // а этот час у него удачный
        const day = hProf[q.src] && hProf[q.src][new Date ().getHours ()];
        let dayBonus = 1;
        if (!blind && day && (day.ok + day.fail) >= 3) dayBonus = day.ok / (day.ok + day.fail) > 0.8 ? 0.9 : 1.3;   // по всем суткам за этот час
        return Math.round (base * hourBonus * dayBonus);
    };
    list.sort ((a, b) => score (a) - score (b));
    return list;
}
function netAnalyticsLines (book, hours)     // чистая функция: только считает и делает выводы, ничего не читает сама
{
    const lines = [];
    const srcs = {};
    for (const h of Object.keys (hours || {}).sort ())
    {
        const b = hours[h] || {};
        for (const s of Object.keys (b.bySrc || {}))
        {
            const e = b.bySrc[s], o = srcs[s] || (srcs[s] = { ok: 0, fail: 0, ms: 0, bad: [] });
            o.ok += e.ok || 0;
            o.fail += e.fail || 0;
            if (e.ms) o.ms = o.ms ? Math.round (o.ms * 0.7 + e.ms * 0.3) : e.ms;
            const tot = (e.ok || 0) + (e.fail || 0);
            if (tot >= 3 && !(e.ok > 0)) o.bad.push (h);      // в этот час источник не ответил ни разу
        }
    }
    for (const s of Object.keys (srcs).sort ((a, b) => (srcs[b].ok - srcs[a].ok) || (srcs[a].ms - srcs[b].ms)))
    {
        const o = srcs[s], tot = o.ok + o.fail;
        if (!tot) continue;
        lines.push ('источник ' + s + ': отвечал в ' + Math.round (100 * o.ok / tot) + '% случаев из ' + tot +
            (o.ms ? ', в среднем ' + Math.round (o.ms) + ' мс' : '') +
            (o.bad.length ? '; мёртвые часы: ' + o.bad.slice (-4).join (', ') : ''));
    }
    const badList = [], goodList = [], floating = [];
    for (const name of Object.keys (book || {}))
    {
        const rec = book[name] || {};
        if ((rec.newAddrs || 0) >= 3) floating.push ([name, rec.newAddrs || 0]);
        for (const x of rec.ips || [])
        {
            const tot = (x.ok || 0) + (x.fail || 0);
            if (!tot) continue;
            const rate = (x.ok || 0) / tot;
            if (tot >= 3 && rate <= 0.5) badList.push ([x.ip, name, x.ok || 0, x.fail || 0]);
            if (tot >= 8 && rate >= 0.95) goodList.push ([x.ip, name, x.ok || 0, Math.round (x.ms || 0)]);
        }
    }
    badList.sort ((a, b) => (b[3] - a[3]) || (a[2] - b[2]));
    goodList.sort ((a, b) => b[2] - a[2]);
    floating.sort ((a, b) => b[1] - a[1]);
    if (goodList.length)
        lines.push ('надёжные адреса (ни одного отказа): ' + goodList.slice (0, 5)
            .map (x => x[0] + ' -- ' + x[1] + ', ' + x[2] + ' ответов' + (x[3] ? ', ~' + x[3] + ' мс' : '')).join ('; '));
    if (badList.length)
        lines.push ('сомнительные адреса (отказов больше, чем ответов): ' + badList.slice (0, 5)
            .map (x => x[0] + ' -- ' + x[1] + ', ' + x[2] + ' ответ / ' + x[3] + ' отказ').join ('; '));
    if (floating.length)
        lines.push ('адреса плавают, держу запас: ' + floating.slice (0, 5).map (x => x[0] + ' (смен адресов: ' + x[1] + ')').join ('; '));
    if (!lines.length)
        lines.push ('пока выводов нет: справочники ещё не отвечали, адреса ещё не подтверждались');
    return lines;
}

// --- Объединение и графики ------------------------------------------------------
// Собираю все измеренные часы в один профиль СУТОК (00..23): это уже не отдельные записи,
// а картина суток целиком, по ней видно закономерность, а не случайность.
function hourOfDayOf (key)
{
    const m = /T(\d\d)$/.exec (String (key || ''));
    return m ? Number (m[1]) : -1;
}
function netDayProfile (hours)
{
    const prof = {};
    for (const k of Object.keys (hours || {}))
    {
        const h = hourOfDayOf (k);
        if (h < 0) continue;
        const b = hours[k] || {};
        for (const s of Object.keys (b.bySrc || {}))
        {
            const e = b.bySrc[s] || {};
            const arr = prof[s] || (prof[s] = []);
            if (!arr[h]) arr[h] = { ok: 0, fail: 0, ms: 0 };
            arr[h].ok += e.ok || 0;
            arr[h].fail += e.fail || 0;
            if (e.ms) arr[h].ms = arr[h].ms ? Math.round (arr[h].ms * 0.7 + e.ms * 0.3) : e.ms;
        }
    }
    return prof;
}
function netDayHeat (hours)      // объединяю все измеренные дни в одни сутки: 0..23 по ответам, отказам и новым адресам
{
    const heat = { ok: [], fail: [], ips: [], hours: 0 };
    for (let h = 0; h < 24; h++) { heat.ok[h] = 0; heat.fail[h] = 0; heat.ips[h] = 0; }
    for (const k of Object.keys (hours || {}))
    {
        const h = hourOfDayOf (k);
        if (h < 0) continue;
        const b = hours[k] || {};
        heat.ok[h] += b.ok || 0;
        heat.fail[h] += b.fail || 0;
        heat.ips[h] += b.ips || 0;                    // новые адреса -- это рост знания, а не сбои
        heat.hours++;
    }
    return heat;
}
function netDayTotals (hours)    // объединяю по ДНЯМ: чем один день отличается от другого
{
    const days = {};
    for (const k of Object.keys (hours || {}))
    {
        const d = String (k).slice (0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test (d)) continue;
        const b = hours[k] || {}, o = days[d] || (days[d] = { ok: 0, fail: 0, ips: 0, hours: 0 });
        o.ok += b.ok || 0;
        o.fail += b.fail || 0;
        o.ips += b.ips || 0;
        o.hours++;
    }
    return days;
}
function netPrefixOf (ip)
{
    const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec (String (ip || ''));
    return m ? m[1] : '';
}
function asciiBar (part, total, width)
{
    const full = total > 0 ? Math.round (width * part / total) : 0;
    return '#'.repeat (Math.max (0, Math.min (width, full))) + '-'.repeat (Math.max (0, width - Math.max (0, Math.min (width, full))));
}
function netChartsLines (hours, topN)
{
    const prof = netDayProfile (hours);
    const lines = [];
    const srcs = Object.keys (prof)
        .map (s =>
        {
            let ok = 0, fail = 0;
            for (let h = 0; h < 24; h++) if (prof[s][h]) { ok += prof[s][h].ok; fail += prof[s][h].fail; }
            return { s: s, ok: ok, fail: fail, tot: ok + fail };
        })
        .filter (x => x.tot > 0)
        .sort ((a, b) => b.tot - a.tot);
    if (srcs.length)
    {
        lines.push ('когда источник отвечает, часы суток 0..23 (# отвечает, + почти всюду, ~ с перебоями, . молчит, _ не измеряли):');
        lines.push ('             012345678901234567890123');
        for (const x of srcs.slice (0, topN || 3))
        {
            const row = [];
            for (let h = 0; h < 24; h++)
            {
                const e = prof[x.s][h];
                if (!e || (e.ok + e.fail) < 2) { row.push ('_'); continue; }
                const rate = e.ok / (e.ok + e.fail);
                row.push (rate >= 0.95 ? '#' : (rate >= 0.7 ? '+' : (rate >= 0.4 ? '~' : '.')));
            }
            lines.push ('             [' + row.join ('') + ']  ' + x.s + ': ' + Math.round (100 * x.ok / x.tot) + '% из ' + x.tot + ' обращений');
        }
    }
    const heat = netDayHeat (hours);
    if (heat.hours)
    {
        const ruler = ('  часы').padEnd (18) + '[012345678901234567890123]';
        lines.push ('сутки целиком (' + heat.hours + ' измеренных часов сложены по часам суток; цифра -- мера, 0 пусто, 9 максимум):');
        for (const m of [['ответы', heat.ok], ['отказы', heat.fail], ['новые адреса', heat.ips]])
        {
            const arr = m[1], max = Math.max.apply (null, arr);
            if (!max) { lines.push (('  ' + m[0]).padEnd (18) + '[измерений нет]'); continue; }
            lines.push (('  ' + m[0]).padEnd (18) + '[' + arr.map (v => (v ? String (Math.max (1, Math.round (9 * v / max))) : '0')).join ('') + '] максимум ' + max + ' в час');
        }
        lines.push (ruler);
    }
    const days = netDayTotals (hours), dk = Object.keys (days).sort ();
    if (dk.length)
    {
        const maxTot = Math.max.apply (null, dk.map (d => (days[d].ok + days[d].fail))) || 1;
        lines.push ('по дням (полоса -- сколько отвечало, длина строки -- сколько всего намеряли):');
        for (const d of dk.slice (-7))
        {
            const x = days[d], tot = x.ok + x.fail;
            lines.push ('  ' + d + ' [' + asciiBar (x.ok, tot, 20) + '] ' + Math.round (100 * x.ok / (tot || 1)) + '% ответов из ' + tot +
                ', новых адресов ' + x.ips + ', часов ' + x.hours + ', объём ' + Math.round (100 * tot / maxTot) + '% от самого полного дня');
        }
    }
    if (!lines.length) lines.push ('графиков пока нет: измерений слишком мало');
    return lines;
}
function netBonesFind (book, hours, rev)     // ищу «кость»: за что реально можно зацепиться -- самую сильную закономерность
{
    const cand = [], prof = netDayProfile (hours);
    for (const s of Object.keys (prof))
    {
        let best = null, worst = null;
        for (let h = 0; h < 24; h++)
        {
            const e = prof[s][h];
            if (!e || (e.ok + e.fail) < 3) continue;
            const rate = e.ok / (e.ok + e.fail);
            if (!best || rate > best.rate) best = { h: h, rate: rate, n: e.ok + e.fail };
            if (!worst || rate < worst.rate) worst = { h: h, rate: rate, n: e.ok + e.fail };
        }
        if (best && worst && (best.rate - worst.rate) >= 0.5)
            cand.push ({ kind: 'источник по часам', score: Math.min (25, (best.rate - worst.rate) * Math.min (best.n, worst.n)), ip: '',
                text: s + ': в ' + worst.h + ':00 отвечает в ' + Math.round (worst.rate * 100) + '%, а в ' + best.h + ':00 -- в ' + Math.round (best.rate * 100) +
                    '%. Вывод: в часы ' + worst.h + ':00 он бесполезен, а в ' + best.h + ':00 -- лучший' });
    }
    const nameOfIp = ip =>
    {
        const r = (rev || {})[ip];
        if (!r) return '';
        if (r.names) { const ks = Object.keys (r.names); return ks.length ? ks[0] : ''; }
        return r.name || '';
    };
    const ipStat = {};                    // адрес: обращения, отказы, скорость, подпись, имена
    for (const name of Object.keys (book || {}))
    {
        const rec = book[name] || {};
        for (const x of rec.ips || [])
        {
            if (!x.ip) continue;
            const o = ipStat[x.ip] || (ipStat[x.ip] = { ip: x.ip, ok: 0, fail: 0, ms: 0, ad: 0, cnt: 0, names: {}, firstAt: x.firstAt || 0, pre: netPrefixOf (x.ip) });
            o.ok += x.ok || 0;
            o.fail += x.fail || 0;
            if (x.ms) o.ms = o.ms ? Math.round (o.ms * 0.7 + x.ms * 0.3) : x.ms;
            if (x.ad) o.ad++;
            if ((Number (x.cnt) || 0) > 1) o.cnt++;
            if (!o.firstAt && x.firstAt) o.firstAt = x.firstAt;
            o.names[name] = 1;
        }
    }
    const ips = Object.keys (ipStat).map (k => ipStat[k]);
    const solid = ips.filter (x => x.ok >= 5 && !x.fail).sort ((a, b) => b.ok - a.ok);
    if (solid.length)
    {
        const x = solid[0], nm = Object.keys (x.names);
        cand.push ({ kind: 'надёжный адрес', score: Math.min (x.ok, 12) * (1 + nm.length), ip: x.ip,
            text: x.ip + ' (' + nm.slice (0, 2).join (', ') + '): ' + x.ok + ' обращений и НИ ОДНОГО отказа' +
                (x.ms ? ', ~' + Math.round (x.ms) + ' мс' : '') + '. Вывод: держать его первым -- это опора, а не догадка' });
    }
    const lever = ips.filter (x => Object.keys (x.names).length >= 2 && !x.fail && x.ok >= 2)
        .sort ((a, b) => Object.keys (b.names).length - Object.keys (a.names).length);
    if (lever.length)
    {
        const x = lever[0], nm = Object.keys (x.names);
        cand.push ({ kind: 'рычаг', score: 20 + nm.length * 6, ip: x.ip,
            text: 'один адрес ' + x.ip + ' держит сразу ' + nm.length + ' имён (' + nm.slice (0, 3).join (', ') + ') и ни разу не сбоил. Вывод: пока он жив -- живы все ' + nm.length +
                (nameOfIp (x.ip) ? '; по обратной таблице это «' + nameOfIp (x.ip) + '»' : '') });
    }
    const pre = {};
    for (const x of ips)
    {
        if (!x.pre) continue;
        const p = pre[x.pre] || (pre[x.pre] = { pre: x.pre, n: 0, dead: 0, names: {} });
        p.n++;
        if (x.fail > 0 && x.fail >= x.ok) p.dead++;
        for (const nm of Object.keys (x.names)) p.names[nm] = 1;
    }
    const plist = Object.keys (pre).map (k => pre[k]);
    const cut = plist.filter (p => p.dead >= 3 && p.dead / p.n >= 0.6).sort ((a, b) => b.dead - a.dead);
    if (cut.length)
    {
        const p = cut[0];
        cand.push ({ kind: 'подсеть режется', score: 24 + p.dead * 2, ip: '',
            text: 'подсеть ' + p.pre + '.x: ' + p.dead + ' адресов из ' + p.n + ' с отказами (имена: ' + Object.keys (p.names).slice (0, 3).join (', ') +
                '). Вывод: режут подсеть целиком -- искать внутри неё другой адрес бесполезно, надо брать из другой подсети' });
    }
    const open = plist.filter (p => p.n >= 3 && !p.dead).sort ((a, b) => b.n - a.n);
    if (open.length)
        cand.push ({ kind: 'живая подсеть', score: 10 + open[0].n, ip: '',
            text: 'подсеть ' + open[0].pre + '.x: все ' + open[0].n + ' известных адресов работают без отказов. Вывод: отсюда брать запасные' });
    const adList = ips.filter (x => x.ad).sort ((a, b) => b.ad - a.ad);
    if (adList.length)
        cand.push ({ kind: 'проверенная подпись', score: 22 + adList.length, ip: adList[0].ip,
            text: 'адресов с проверенной подписью (DNSSEC): ' + adList.length + ', первый -- ' + adList[0].ip + ' (' + Object.keys (adList[0].names).slice (0, 2).join (', ') +
                '). Вывод: подписанный ответ подменить нельзя -- такие адреса ставлю первыми по их именам' });
    const now = Date.now ();
    const fresh = ips.filter (x => x.firstAt && (now - x.firstAt) < 24 * 3600000 && x.ok >= 3 && !x.fail)
        .sort ((a, b) => (b.firstAt || 0) - (a.firstAt || 0));
    if (fresh.length)
        cand.push ({ kind: 'готовый заменитель', score: 12 + Math.min (fresh[0].ok, 8), ip: fresh[0].ip,
            text: 'новый адрес ' + fresh[0].ip + ' (' + Object.keys (fresh[0].names).slice (0, 2).join (', ') + ') появился меньше суток назад и уже дал ' + fresh[0].ok +
                ' обращений без отказа. Вывод: готовый заменитель, если старый адрес откажет' });
    const thin = [];
    for (const name of Object.keys (book || {}))
    {
        const list = ((book[name] || {}).ips) || [];
        if (list.length < 4) continue;
        let used = 0;
        for (const x of list) used += (x.ok || 0) + (x.fail || 0);
        if (used < 5) continue;                 // по адресам ещё не ходили -- это не узкое место, а пустая графа
        const live = list.filter (x => x.ok >= 2 && !x.fail);
        if (live.length === 1) thin.push (name + ' (адресов ' + list.length + ', из них живой один: ' + live[0].ip + ')');
        else if (!live.length) thin.push (name + ' (адресов ' + list.length + ', ни один из ' + used + ' обращений не подтвердился)');
    }
    if (thin.length)
        cand.push ({ kind: 'узкое место', score: 15 + thin.length, ip: '',
            text: 'у имени много адресов, а живой один: ' + thin.slice (0, 3).join ('; ') + '. Вывод: запас здесь тонкий -- держать первый и следить' });
    cand.sort ((a, b) => b.score - a.score);
    return cand;
}
function netBonesLines (book, hours, rev)
{
    const cand = netBonesFind (book, hours, rev);
    if (!cand.length) return ['зацепки пока нет: нужно больше измерений по часам'];
    return cand.slice (0, 3).map (c => 'зацепка (' + c.kind + '): ' + c.text);
}
function netGuessScoreLines (score)     // честный счёт: сколько моих догадок совпало с фактом
{
    const lines = [];
    if (!score) return lines;
    let hits = 0, miss = 0, err = 0;
    for (const s of Object.keys (score))
    {
        hits += score[s].hits || 0;
        miss += score[s].miss || 0;
        err += score[s].err || 0;
    }
    const n = hits + miss;
    if (!n) return lines;
    lines.push ('мои прогнозы: сверено ' + n + ', сбылось ' + hits + ' (' + Math.round (100 * hits / n) + '%), средняя ошибка ' + Math.round (100 * err / n) + '%' +
        (hits / n < 0.5 ? ' -- пока это брак, берусь заново: порядок источников пересобираю по факту, а не по догадке' : ''));
    const rows = Object.keys (score).map (s => ({ s: s, n: (score[s].hits || 0) + (score[s].miss || 0), h: score[s].hits || 0 }))
        .filter (x => x.n >= 3).sort ((a, b) => (a.h / a.n) - (b.h / b.n));
    if (rows.length)
        lines.push ('хуже всего предсказываю: ' + rows.slice (0, 3).map (x => x.s + ' (' + x.h + ' из ' + x.n + ')').join ('; '));
    return lines;
}
function netForecastLines (hours, guess, score)   // прогноз на следующий час -- проверяемая догадка, а не украшение
{
    const prof = netDayProfile (hours);
    const next = (new Date ().getHours () + 1) % 24;
    const sk = src =>
    {
        const s = score && score[src];
        if (!s) return null;
        const n = (s.hits || 0) + (s.miss || 0);
        return n >= 3 ? { n: n, rate: (s.hits || 0) / n } : null;
    };
    const rows = [];
    for (const s of Object.keys (prof))
    {
        const e = prof[s][next];
        let ok = 0, fail = 0;
        for (let h = 0; h < 24; h++) if (prof[s][h]) { ok += prof[s][h].ok; fail += prof[s][h].fail; }
        if (!e || (e.ok + e.fail) < 2) continue;
        rows.push ({ s: s, rate: e.ok / (e.ok + e.fail), n: e.ok + e.fail, ms: e.ms || 0, all: (ok + fail) ? ok / (ok + fail) : 0, sk: sk (s) });
    }
    rows.sort ((a, b) => (b.rate - a.rate) || (a.ms - b.ms));
    const lines = [];
    for (const r of rows.slice (0, 4))
        lines.push ('на ' + String (next).padStart (2, '0') + ':00 ' + r.s + ': ожидаю ' + Math.round (r.rate * 100) + '% ответов (по ' + r.n +
            ' замерам этого часа, в среднем за сутки ' + Math.round (r.all * 100) + '%)' + (r.ms ? ', ~' + Math.round (r.ms) + ' мс' : '') +
            (r.sk ? (r.sk.rate >= 0.7 ? '; меня этот источник пока не подводил (' + Math.round (r.sk.rate * 100) + '% сверок)'
                : '; мои догадки по нему расходились с фактом в ' + Math.round ((1 - r.sk.rate) * 100) + '% случаев -- его часовой профиль отключён, иду по чистой скорости') : ''));
    const risky = rows.filter (r => r.rate < 0.6);
    if (risky.length)
        lines.push ('опасаться в ' + String (next).padStart (2, '0') + ':00: ' + risky.map (r => r.s + ' (жду ' + Math.round (r.rate * 100) + '%)').join ('; ') +
            ' -- в этот час вперёд их не ставлю, иду запасными');
    if (guess && guess.key)
        lines.push ('прогноз на ' + String (guess.key).slice (0, 10) + ' в ' + String (guess.key).slice (-2) + ':00 записан, источников в нём ' + ((guess.items || []).length) + ', ждёт сверки с фактом');
    for (const l of netGuessScoreLines (score)) lines.push (l);
    if (!lines.length) lines.push ('прогноз построить не из чего: в этот час ещё не измеряли (прогноз появится после суток работы)');
    return lines;
}
function netMergedLines (book, pools, rev)     // объединяю книгу, копилки и обратную таблицу в одну картину
{
    const lines = [], names = Object.keys (book || {});
    const nameOfIp = ip => { const r = (rev || {})[ip]; if (!r) return ''; if (r.names) { const ks = Object.keys (r.names); return ks.length ? ks[0] : ''; } return r.name || ''; };
    if (names.length)
    {
        const rows = names.map (nm =>
        {
            const rec = book[nm] || {}, list = rec.ips || [];
            let ok = 0, fail = 0, ad = 0, agree = 0;
            for (const x of list) { ok += x.ok || 0; fail += x.fail || 0; if (x.ad) ad++; if ((Number (x.cnt) || 0) > 1) agree++; }
            return { name: nm, n: list.length, ok: ok, fail: fail, ad: ad, agree: agree, src: rec.src || '--' };
        }).sort ((a, b) => (b.n - a.n) || (b.ok - a.ok));
        lines.push ('одна таблица по именам (топ по числу известных адресов):');
        for (const r of rows.slice (0, 6))
            lines.push ('  ' + r.name + ': адресов ' + r.n + ', обращений ' + r.ok + '/' + r.fail + ', с подписью ' + r.ad +
                ', подтвердили несколько источников ' + r.agree + ', пришли из «' + r.src + '»');
    }
    const known = {};
    for (const nm of names) for (const x of ((book[nm] || {}).ips || [])) if (x.ip) known[x.ip] = 1;
    const extra = [];
    for (const k of Object.keys (pools || {}))
    {
        if (k.indexOf ('pool:') !== 0) continue;
        for (const ip of Object.keys ((pools[k] || {}).ips || {}))
            if (!known[ip]) extra.push (ip + ' (' + k.slice (5) + (nameOfIp (ip) ? ', «' + nameOfIp (ip) + '»' : '') + ')');
    }
    if (extra.length)
        lines.push ('есть в копилках, но пока не в книге (годятся в запас): ' + extra.length + ' -- ' + extra.slice (0, 4).join ('; '));
    return lines;
}
function netLinksFind (book, pools, rev)     // связки: где одна проверка закрывает сразу много имён
{
    const links = [], byIp = {};
    for (const nm of Object.keys (book || {}))
        for (const x of ((book[nm] || {}).ips || []))
        {
            if (!x.ip) continue;
            const o = byIp[x.ip] || (byIp[x.ip] = { ip: x.ip, names: {}, ok: 0, fail: 0, ms: 0, played: 0, ad: 0, pre: netPrefixOf (x.ip) });
            o.names[nm] = 1;
            o.ok += x.ok || 0;
            o.fail += x.fail || 0;
            o.played += x.played || 0;
            if (x.ad) o.ad++;
            if (x.ms) o.ms = o.ms ? Math.round (o.ms * 0.7 + x.ms * 0.3) : x.ms;
        }
    const ipl = Object.keys (byIp).map (k => byIp[k]);
    for (const o of ipl)
    {
        const nm = Object.keys (o.names);
        if (nm.length >= 2)
            links.push ({ kind: 'общий адрес', ip: o.ip, names: nm, score: 20 + nm.length * 6 + Math.min (o.ok, 12) + (o.played ? 10 : 0),
                why: 'адрес ' + o.ip + ' держит ' + nm.length + ' имени (' + nm.slice (0, 4).join (', ') + ') -- одна проверка закрывает все' +
                    (o.played ? '; на музыке он уже проверен ' + o.played + ' раз' : '') });
    }
    const pre = {};
    for (const o of ipl)
    {
        if (!o.pre) continue;
        const p = pre[o.pre] || (pre[o.pre] = { pre: o.pre, names: {}, ips: 0, dead: 0, ok: 0, played: 0 });
        p.ips++;
        p.ok += o.ok;
        p.played += o.played;
        if (o.fail > 0 && o.fail >= o.ok) p.dead++;
        for (const nm of Object.keys (o.names)) p.names[nm] = 1;
    }
    const pl = Object.keys (pre).map (k => pre[k]);
    for (const p of pl)
    {
        const nm = Object.keys (p.names);
        if (nm.length >= 2 && p.ips >= 2 && !p.dead)
            links.push ({ kind: 'общая подсеть', ip: '', names: nm, score: 14 + nm.length * 5 + p.ips, pre: p.pre,
                why: 'подсеть ' + p.pre + '.x обслуживает ' + nm.length + ' имени (' + nm.slice (0, 4).join (', ') + '), адресов в ней ' + p.ips + ', отказов нет (можно взять любой)' });
    }
    const svcOfIp = {};
    for (const k of Object.keys (pools || {}))
    {
        if (k.indexOf ('pool:') !== 0) continue;
        for (const ip of Object.keys ((pools[k] || {}).ips || {})) (svcOfIp[ip] = svcOfIp[ip] || {})[k.slice (5)] = 1;
    }
    for (const ip of Object.keys (svcOfIp))
    {
        const sv = Object.keys (svcOfIp[ip]);
        if (sv.length >= 2)
            links.push ({ kind: 'общий адрес сервисов', ip: ip, names: sv, score: 25 + sv.length * 8,
                why: 'адрес ' + ip + ' видели и в музыке, и в чате (' + sv.join (' + ') + ') -- жив он, значит живы оба' });
    }
    for (const ip of Object.keys (rev || {}))
    {
        const r = rev[ip] || {};
        const nm = r.names ? Object.keys (r.names) : (r.name ? [r.name] : []);
        if (nm.length >= 2)
            links.push ({ kind: 'обратная таблица', ip: ip, names: nm, score: 10 + nm.length * 3,
                why: 'по обратной таблице адрес ' + ip + ' звали именами: ' + nm.slice (0, 4).join (', ') });
    }
    for (const o of ipl)
    {
        if (!o.played || Object.keys (o.names).length >= 2) continue;      // когда имён несколько, про музыку уже сказано в «общем адресе»
        links.push ({ kind: 'играло', ip: o.ip, names: Object.keys (o.names), score: 30 + o.played * 5,
            why: 'через этот адрес музыка уже качалась ' + o.played + ' раз (' + Object.keys (o.names).slice (0, 3).join (', ') + ') -- это не догадка, это факт' });
    }
    for (const l of links)
    {
        const ms = (l.names || []).filter (n => /youtube|googlevideo|ytimg|ggpht|youtu\.be|googleusercontent|bandcamp|soundcloud/.test (n));
        l.music = ms.length;
        if (ms.length) l.why += '; из них для музыки: ' + ms.slice (0, 3).join (', ');
    }
    links.sort ((a, b) => (b.music ? 1 : 0) - (a.music ? 1 : 0) || b.score - a.score);
    return links;
}
function netLinksLines (book, pools, rev, topN)
{
    const links = netLinksFind (book, pools, rev);
    if (!links.length) return ['связок пока нет: нужно больше имён и живых соединений'];
    return links.slice (0, topN || 4).map (l => 'связка (' + l.kind + '): ' + l.why);
}
function netPlanLines (book, pools, rev)     // как этим пользоваться: порядок попыток и правила переключения
{
    const lines = [], byIp = {};
    for (const nm of Object.keys (book || {}))
        for (const x of ((book[nm] || {}).ips || []))
        {
            if (!x.ip) continue;
            const o = byIp[x.ip] || (byIp[x.ip] = { ip: x.ip, ok: 0, fail: 0, played: 0, ad: 0, named: [], pre: netPrefixOf (x.ip) });
            o.ok += x.ok || 0;
            o.fail += x.fail || 0;
            o.played += x.played || 0;
            if (x.ad) o.ad++;
            if (o.named.indexOf (nm) < 0 && o.named.length < 4) o.named.push (nm);
        }
    const ipl = Object.keys (byIp).map (k => byIp[k]);
    const played = ipl.filter (x => x.played).sort ((a, b) => b.played - a.played);
    const solid = ipl.filter (x => x.ok >= 3 && !x.fail).sort ((a, b) => b.ok - a.ok);
    const signed = ipl.filter (x => x.ad).sort ((a, b) => b.ad - a.ad);
    const links = netLinksFind (book, pools, rev);
    if (played.length)
        lines.push ('первым делом -- проверенный на музыке: ' + played[0].ip + ' (' + played[0].played + ' трека, имена: ' + played[0].named.join (', ') + ') -- это факт, я его не угадываю');
    else
        lines.push ('проверенных на музыке адресов пока нет -- иду по книге: подпись -> согласие источников -> свежесть');
    if (signed.length) lines.push ('дальше -- с проверенной подписью: ' + signed.slice (0, 3).map (x => x.ip).join (', ') + ' (такой ответ подменить нельзя)');
    if (solid.length) lines.push ('запасной путь -- самый надёжный из своей книги: ' + solid[0].ip + ' (' + solid[0].ok + ' обращений, ни одного отказа' + (solid[0].named.length ? ', имена: ' + solid[0].named.slice (0, 2).join (', ') : '') + ')');
    const usable = links.filter (l => l.kind === 'общий адрес' || l.kind === 'играло' || l.kind === 'общий адрес сервисов');
    const best = usable.filter (l => l.music)[0] || usable[0];       // для музыки -- своя связка, если она есть
    if (best) lines.push ('самая выгодная связка' + (best.music ? ' для музыки' : '') + ': ' + best.why);
    const pre = {};
    for (const x of ipl)
    {
        if (!x.pre) continue;
        const p = pre[x.pre] || (pre[x.pre] = { pre: x.pre, n: 0, dead: 0, names: {} });
        p.n++;
        if (x.fail > 0 && x.fail >= x.ok) p.dead++;
        for (const nm of x.named) p.names[nm] = 1;
    }
    const dl = Object.keys (pre).map (k => ({ pre: pre[k].pre, n: pre[k].n, dead: pre[k].dead, names: Object.keys (pre[k].names) }))
        .filter (p => p.dead >= 3 && p.dead / p.n >= 0.6).sort ((a, b) => b.dead - a.dead);
    if (dl.length)
        lines.push ('сюда не тратить попытки: подсеть ' + dl[0].pre + '.x -- ' + dl[0].dead + ' адресов из ' + dl[0].n + ' мертвы' +
            (dl[0].names.length ? ' (' + dl[0].names.slice (0, 3).join (', ') + ')' : '') + ', там режут целиком');
    lines.push ('правило переключения: адрес молчит ' + (IP_TRY_TIMEOUT_MS / 1000).toFixed (1) + ' с -- беру следующий (до ' + IP_TRY_MAX +
        ' адресов за раз), два отказа подряд -- имя спит ' + Math.round (DNS_FAIL_ASLEEP / 60000) + ' мин, очередь и место в треке держу');
    const maxNames = links.reduce ((n, l) => Math.max (n, (l.names || []).length), 0);
    if (links.length)
        lines.push ('выгода: связок ' + links.length + ', самая широкая закрывает ' + maxNames + ' имени сразу -- проверил один адрес, поднял всё имя целиком');
    return lines;
}

async function dnsBookInfo ()
{
    const book = await dnsBookLoad ();
    const names = Object.keys (book);
    let ips = 0, fresh = 0;
    const now = Date.now ();
    for (const n of names)
    {
        const rec = book[n];
        ips += (rec.ips || []).length;
        if (rec.ips && rec.ips.length && (now - (rec.at || 0)) < (rec.ttl || DNS_TTL_DEF)) fresh++;
    }
    return { names: names.length, ips: ips, fresh: fresh, stats: dnsStats || {} };
}
const POOL_NETS = [
    { svc: 'youtube', pre: ['142.250.', '142.251.', '142.252.', '142.253.', '172.217.', '216.58.', '173.194.',
                             '209.85.', '74.125.', '64.233.', '108.177.', '216.239.'] },
    { svc: 'discord', pre: ['162.159.', '104.16.', '104.17.', '104.18.', '104.24.', '103.86.', '188.114.', '5.254.'] },
];
const poolBad = new Map ();
function poolNetFor (ip)
{
    for (const n of POOL_NETS) for (const p of n.pre) if (String (ip).startsWith (p)) return n.svc;
    return null;
}
function poolSvcForHost (host)
{
    const h = String (host || '').toLowerCase ();
    if (/youtube|googlevideo|ytimg|ggpht|youtu\.be|googleusercontent/.test (h)) return 'youtube';
    if (/discord/.test (h)) return 'discord';
    return null;
}
function poolKeyOf (svc) { return 'pool:' + svc; }
async function poolAdd (svc, ips)
{
    if (!svc || !ips || !ips.length) return;
    await ipMemLoad ();
    const key = poolKeyOf (svc);
    const cur = (ipMem[key] && ipMem[key].ips) ? ipMem[key].ips : {};
    let added = 0;
    for (const ip of ips)
    {
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test (String (ip)) || dohBadIp (ip)) continue;
        if (cur[ip] === undefined) { cur[ip] = Date.now (); added++; }
    }
    ipMem[key] = { ips: cur, at: Date.now () };   // ни одного адреса не выбрасываю: беру по кругу -- кого давно не брали
    if (added)
    {
        console.log ('[' + (d()) + '] [music] копилка адресов ' + svc + ': +' + added +
            ' (всего ' + Object.keys (cur).length + ')');
        await ipMemSave ();
    }
}
function poolHarvest ()
{
    return new Promise (res =>
    {
        try
        {
            require ('child_process').execFile ('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true, timeout: 8000 },
                async (e, out) =>
                {
                    if (e || !out) return res ();
                    const bySvc = {};
                    for (const line of String (out).split ('\n'))
                    {
                        const m = line.trim ().match (/^TCP\s+\S+\s+(\S+):(\d+)\s+ESTABLISHED/);
                        if (!m) continue;
                        const ip = m[1];
                        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test (ip)) continue;
                        const svc = poolNetFor (ip);
                        if (svc) (bySvc[svc] = bySvc[svc] || []).push (ip);
                    }
                    for (const svc of Object.keys (bySvc)) await poolAdd (svc, bySvc[svc]);
                    res ();
                });
        }
        catch (e) { res (); }
    });
}
async function poolPick (host)
{
    const svc = poolSvcForHost (host);
    if (!svc) return null;
    await ipMemLoad ();
    const bag = ipMem[poolKeyOf (svc)];
    const cur = (bag && bag.ips) ? bag.ips : {};
    const now = Date.now ();
    const list = Object.keys (cur).filter (ip =>
    {
        const bad = poolBad.get (ip);
        return !(bad && (now - bad) < 60000);
    });
    if (!list.length) return null;
    list.sort ((a, b) => (cur[a] || 0) - (cur[b] || 0));   // кого давно не брали -- того и беру (ходит по кругу)
    return { ip: list[0], svc: svc };
}
async function poolTouch (ip, fail)
{
    const svc = poolNetFor (ip);
    if (!svc) return;
    await ipMemLoad ();
    const bag = ipMem[poolKeyOf (svc)];
    if (!bag || !bag.ips || bag.ips[ip] === undefined) return;
    if (fail) poolBad.set (ip, Date.now ());
    else bag.ips[ip] = Date.now ();
    await ipMemSave ();
}

async function ipRecalled (name, ttl)
{
    const book = await dnsBookLoad ();
    const rec = book[name];
    if (!rec) return null;
    if (ttl !== Number.MAX_SAFE_INTEGER && (Date.now () - (rec.at || 0)) >= ttl) return null;
    return dnsBestIp (rec);
}
async function ipFailNote (name, ip)
{
    const book = await dnsBookLoad ();
    const rec = book[name];
    if (!rec) return;
    rec.fails = (rec.fails || 0) + 1;
    rec.fail = Date.now ();
    if (ip) { const r = dnsIpSlot (rec, ip); r.fail = Date.now (); }
    else for (const r of rec.ips) r.fail = Date.now ();
    dnsBookSave ();
    dohCache.delete (name);
}
let lastConn = null;
function lastConnNote (host, ip)
{
    lastConn = { host: String (host || ''), ip: String (ip || ''), at: Date.now () };
}
async function dnsPlayNote (name, ip)      // по этому адресу музыка РЕАЛЬНО прошла -- отмечаю как проверенный
{
    if (!name) return;
    const book = await dnsBookLoad ();
    const rec = book[name] || null;
    if (!rec) return;
    rec.played = (rec.played || 0) + 1;
    rec.lastPlayedAt = Date.now ();
    if (ip)
    {
        const r = dnsIpSlot (rec, ip);
        r.played = (r.played || 0) + 1;
        r.lastPlayedAt = Date.now ();
    }
    dnsBookSave ();
}
async function ipOkNote (name, ip)
{
    const book = await dnsBookLoad ();
    const rec = book[name];
    if (!rec) return;
    rec.hits = (rec.hits || 0) + 1;
    rec.fail = 0;
    rec.lastUsed = Date.now ();
    if (ip)
    {
        const r = dnsIpSlot (rec, ip);
        r.fail = 0;
        r.ok = (r.ok || 0) + 1;
        r.lastUsed = Date.now ();
    }
    else for (const r of rec.ips) r.fail = 0;
    dnsBookSave ();
}

async function ipResolve (name)
{
    const book = await dnsBookLoad ();
    const rec = book[name] || null;
    const now = Date.now ();
    const healthy = !!(rec && rec.ips && rec.ips.length
        && (now - (rec.at || 0)) < (rec.ttl || DNS_TTL_DEF)
        && !(rec.fail && (now - rec.fail) < DNS_FAIL_ASLEEP));
    const c = dohCache.get (name);
    if (c && (now - c.at) < DOH_TTL && healthy) return c.ip;
    if (healthy)
    {
        const ip = dnsBestIp (rec);
        if (ip)
        {
            ipViaLog ('играю по своей записи (' + (rec.src || 'своя книга') + (rec.hits ? ', пригодилась ' + rec.hits + ' раз' : '') + ')',
                name + ' -> ' + ip + ', запись ' + Math.round ((now - (rec.at || 0)) / 1000) + ' с назад, ttl ' + Math.round ((rec.ttl || DNS_TTL_DEF) / 1000) + ' с');
            dohCache.set (name, { ip: ip, at: now });
            return ip;
        }
    }
    const all = await dnsAskAll (name);
    if (all && all.list.length)
    {
        const best = all.list[0];
        const ips = all.list.map (x => x.ip);
        dohCache.set (name, { ip: best.ip, at: Date.now () });
        const nrec = await dnsNote (name, ips, best.ms, all.src, all.ttl, all.info);
        ipViaLog ('взял ответ у ' + all.src + (all.ad ? ' (подпись проверена)' : ''),
            name + ' -> ' + best.ip + ' за ' + best.ms + ' мс' +
            (ips.length > 1 ? ' (собрал адресов: ' + ips.length + ')' : ''));
        const svc = poolSvcForHost (name);
        if (svc) poolAdd (svc, ips);     // и в копилку сервиса -- на случай, когда имя взять будет неоткуда
        if (nrec && !nrec.hits) nrec.hits = 0;
        return best.ip;
    }
    const old = rec ? dnsBestIp (rec) : null;
    if (old)
    {
        ipViaLog ('справочная молчит -- беру свою запись', name + ' -> ' + old);
        dohCache.set (name, { ip: old, at: Date.now () });
        return old;
    }
    return null;
}

// Списка имён нет и быть не должно: адреса меняются каждый день, а живой справочник уже лежит
// в самой системе -- то, что она спрашивала сама (кэш имён Windows). Оттуда и беру всё, что есть.
const NET_CACHE_MAX = 600;     // столько записей беру из живого справочника системы за один проход
const NET_CACHE_PS = 'Get-DnsClientCache | Where-Object { $_.Data -match "^\\d{1,3}(\\.\\d{1,3}){3}$" } | ' +
    'ForEach-Object { $_.Entry + "|" + $_.Data + "|" + $_.TimeToLive }';
// Передаю не строкой, а кодированной: в самой команде есть кавычки, а кавычки в командной
// строке Windows ломаются -- так надёжнее (тот же приём уже используется для ключей базы).
const NET_CACHE_PS_ENC = Buffer.from (NET_CACHE_PS, 'utf16le').toString ('base64');
const DNS_WARM_PARALLEL = 4;
const DNS_WARM_MAX = 24;       // столько имён за один проход (те записи книги, у которых вышел срок)
const DNS_WARM_MAX_MS = 8000;
let dnsWarmBusy = false;
let dnsWarmRuns = 0;         // сколько проходов книги прошло -- чтобы говорить раз в час, а не каждую минуту
let dnsWarmLastFail = 0;     // сколько имён не ответило в прошлый раз -- про сбои говорю, только когда число меняется

const DNS_ASK_DEADLINE_MS = 4000;   // одному имени -- не больше этого на все источники: иначе проход тянется

// Лучшие механики справочников, без обхода: (1) спрашиваю ВСЕ источники ОДНОВРЕМЕННО --
// не жду медленного, беру кто ответил; (2) ответы СОБИРАЮ ВМЕСТЕ: если один источник врёт
// или молчит, адреса других всё равно попали в книгу -- прятать от нас нечего;
// (3) если ответ пришёл с проверенной подписью (DNSSEC, поле AD), такие адреса идут первыми:
// подделать подписанный ответ ТСПУ не может, а подмена без подписи лежит в конце.
async function dnsAskAll (name)
{
    const srcs = dnsSourcesOrdered ().filter (q => !(q.kind === 'doh' && !MUSIC_DOH));
    const got = await Promise.all (srcs.map (q => new Promise (res =>
    {
        const t0 = Date.now ();
        const done = v =>
        {
            const ms = Date.now () - t0;
            if (v && v.ip) { dnsNoteSrc (q.src, true, ms); res ({ q: q, got: v, ms: ms }); }
            else { dnsNoteSrc (q.src, false, 0); res (null); }
        };
        try
        {
            if (q.kind === 'doh')
                dohAsk (q, name, DNS_ASK_DEADLINE_MS).then (v =>
                {
                    if (v && v.ip)
                    {
                        dohGoodIdx = Math.max (0, DOH_RESOLVERS.findIndex (r => r.name === q.name));
                        dohLastOkAt = Date.now ();
                    }
                    done (v);
                }, () => done (null));
            else if (q.kind === 'plain') plainDnsAsk (q.ip, name, DNS_ASK_DEADLINE_MS).then (done, () => done (null));
            else require ('dns').promises.lookup (name).then (r =>
            {
                done ((r && r.address && !dohBadIp (r.address)) ? { ip: r.address, ips: [r.address], ttl: 0 } : null);
            }, () => done (null));
        }
        catch (e) { done (null); }
    })));
    const ok = got.filter (x => x);
    if (!ok.length) return null;
    const cnt = {}, ad = {};                    // сколько источников назвали адрес и были ли подписанные ответы
    for (const x of ok)
        for (const ip of (x.got.ips && x.got.ips.length ? x.got.ips : [x.got.ip]))
            if (ip && !dohBadIp (ip))
            {
                cnt[ip] = (cnt[ip] || 0) + 1;
                if (x.got.ad) ad[ip] = true;
            }
    ok.sort ((a, b) => ((b.got.ad ? 1 : 0) - (a.got.ad ? 1 : 0)) || (a.ms - b.ms));   // подписанные -- вперёд, потом быстрые
    const list = [], seen = {};
    for (const x of ok)
        for (const ip of (x.got.ips && x.got.ips.length ? x.got.ips : [x.got.ip]))
            if (ip && !seen[ip] && !dohBadIp (ip))
            {
                seen[ip] = true;
                list.push ({ ip: ip, src: x.q.src, ms: x.ms, ad: !!ad[ip], cnt: cnt[ip] || 1 });
            }
    if (!list.length) return null;
    list.sort ((a, b) => ((b.ad ? 1 : 0) - (a.ad ? 1 : 0)) || ((b.cnt || 1) - (a.cnt || 1)) || (a.ms - b.ms));
    const ttl = ok.reduce ((m, x) => Math.max (m, Number (x.got.ttl) || 0), 0);
    const info = {};
    for (const x of list) info[x.ip] = { ad: x.ad, cnt: x.cnt };
    return { list: list, ms: list[0].ms, ttl: ttl, ad: list[0].ad, info: info,
        src: (ok.length > 1 ? ok.length + ' справочника' : ok[0].q.src) };
}

async function dnsAskSources (name)   // то же, но одним адресом: для обновления книги по сроку
{
    const all = await dnsAskAll (name);
    if (!all) return null;
    return { ip: all.list[0].ip, ips: all.list.map (x => x.ip), ttl: all.ttl, src: all.src, ms: all.ms, info: all.info };
}

async function dnsWarm ()               // книга живёт как справочник: у записи есть срок, истёк -- спрашиваю заново
{
    if (dnsWarmBusy) return null;
    dnsWarmBusy = true;
    const started = Date.now ();
    let filled = 0, ips = 0, failed = 0;
    try
    {
        const book = await dnsBookLoad ();
        const now = Date.now ();
        const stale = name =>
        {
            const rec = book[name];
            return !(rec && rec.ips && rec.ips.length && (now - (rec.at || 0)) < (rec.ttl || DNS_TTL_DEF));
        };
        const todo = [];
        for (const n of Object.keys (book))                                // список имён не задаю: держу свежим всё, что есть в книге
            if (todo.length < DNS_WARM_MAX && stale (n)) todo.push (n);
        const queue = todo.slice ();
        const worker = async () =>
        {
            while (queue.length)
            {
                if ((Date.now () - started) > DNS_WARM_MAX_MS) return;      // не затягиваю проход надолго
                const name = queue.shift ();
                const got = await dnsAskSources (name);
                if (!got) { failed++; continue; }
                const rec = await dnsNote (name, got.ips, got.ms, got.src, got.ttl, got.info);
                filled++;
                ips += (rec && rec.ips ? rec.ips.length : (got.ips || []).length);
            }
        };
        const crew = [];
        for (let i = 0; i < Math.min (DNS_WARM_PARALLEL, queue.length); i++) crew.push (worker ());
        await Promise.all (crew);
        await dnsBookSave (true);
        if (BOT_RUN)
        {
            dnsWarmRuns++;
            if (failed && failed !== dnsWarmLastFail)
                console.error ('[' + (d()) + '] [net] книга имя↔адрес: в этот раз не ответили ' + failed +
                    ' из ' + todo.length + ' (обновил ' + filled + ') -- спрошу заново по сроку, музыка от этого не встаёт');
            else if (!failed && (dnsWarmRuns === 1 || (dnsWarmRuns % 60) === 1))
                console.log ('[' + (d()) + '] [net] книга имя↔адрес: раз в час докладываю -- всё отвечает, ' +
                    'за проход обновляю ' + filled + ' имён (адресов ' + ips + '), время ' +
                    (Math.round ((Date.now () - started) / 100) / 10) + ' с; в остальное время молчу, скажу при переменах');
            dnsWarmLastFail = failed;
        }
        return { filled: filled, ips: ips, failed: failed };
    }
    catch (e) { return null; }
    finally { dnsWarmBusy = false; }
}

async function netCacheHarvest ()     // живой справочник самой системы: что она сама спросила -- то и в книге
{
    const out = await new Promise (res =>                 // только без ожидания в потоке: чужой запрос
    {                                                     // справочника не должен замораживать голос и музыку
        try
        {
            require ('child_process').execFile ('powershell',
                ['-NoProfile', '-NonInteractive', '-EncodedCommand', NET_CACHE_PS_ENC],
                { encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
                (e, stdout) => res (e ? '' : String (stdout || '')));
        }
        catch (e) { res (''); }
    });
    if (!out) return { names: 0, ips: 0, added: 0 };
    const book = await dnsBookLoad ();
    const seen = {};
    let ips = 0, added = 0;
    const rows = [];
    for (const line of out.split (/\r?\n/))
    {
        const parts = line.trim ().split ('|');
        if (parts.length < 2) continue;
        const name = parts[0].trim ().toLowerCase ().replace (/\.$/, '');   // без точки на конце: иначе то же имя попадёт дважды
        const ip = parts[1].trim ();
        if (!/^[a-z0-9_.-]{3,253}$/.test (name)) continue;
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test (ip) || dohBadIp (ip)) continue;
        rows.push ({ name: name, ip: ip, ttl: Number (parts[2]) || 0 });
    }
    rows.sort ((a, b) => (b.ttl || 0) - (a.ttl || 0));   // свежие -- первыми: обрезка не съест как раз живое
    for (const r of rows)
    {
        if (ips >= NET_CACHE_MAX) break;
        ips++;
        if (seen[r.name] === undefined)
        {
            seen[r.name] = true;
            if (!book[r.name] || !(book[r.name].ips || []).length) added++;
        }
        await dnsNote (r.name, [r.ip], 0, 'кэш системы', r.ttl);
    }
    await dnsBookSave (true);
    const names = Object.keys (seen).length;
    if (BOT_RUN && added)
        console.log ('[' + (d()) + '] [net] книга имя↔адрес: из справочника системы взял имён ' + names +
            ' (адресов ' + ips + '), новых имён ' + added);
    return { names: names, ips: ips, added: added };
}
async function ipCandidates (host)   // порядок тот же, что у книги; в конце -- копилка сервиса
{
    const out = [], seen = {};
    const now = Date.now ();
    try
    {
        const book = await dnsBookLoad ();
        const rec = book[host];
        if (rec && rec.ips && rec.ips.length)
        {
            const list = rec.ips.slice ().sort (dnsIpCmp (now));
            for (const x of list)
                if (x.ip && !seen[x.ip]) { seen[x.ip] = true; out.push ({ ip: x.ip, svc: '' }); }
        }
    }
    catch (e) { }
    try
    {
        const p = await poolPick (host);
        if (p && p.ip && !seen[p.ip]) { seen[p.ip] = true; out.push ({ ip: p.ip, svc: p.svc }); }
    }
    catch (e) { }
    return out.slice (0, IP_TRY_MAX);
}

function dohProxyStart ()
{
    return new Promise (res =>
    {
        if (dohProxyPort) return res (dohProxyPort);
        const http = require ('http'), net = require ('net');
        const srv = http.createServer ((req, r) => { r.writeHead (400); r.end (); });
        srv.on ('connect', async (req, cSock, head) =>
        {
            const parts = String (req.url || '').split (':');
            const host = parts[0], port = Number (parts[1] || 443);
            await ipResolve (host);                      // освежаю книгу (ответ не обязателен)
            const cand = await ipCandidates (host);
            if (!cand.length)
            {
                dohOops++;
                try { cSock.end ('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (e) { }
                return;
            }
            let idx = 0, closed = false;
            const fail502 = () => { if (!closed) { closed = true; try { cSock.end ('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (e) { } } };
            const tryNext = () =>
            {
                if (closed) return;
                const c = cand[idx++];
                if (!c) { dohOops++; return fail502 (); }
                let done = false;
                const up = net.connect (port, c.ip, () =>
                {
                    if (done) return;
                    done = true;
                    clearTimeout (timer);
                    dohCalls++;
                    lastConnNote (host, c.ip);   // запомнил пару имя->адрес: если трек скачается, отмечу её как проверенную
                    ipOkNote (host, c.ip);   // по этому адресу ответило -- сверка не нужна
                    if (c.svc) poolTouch (c.ip, false);
                    try { cSock.write ('HTTP/1.1 200 Connection Established\r\n\r\n'); } catch (e) { }
                    if (head && head.length) up.write (head);
                    up.pipe (cSock); cSock.pipe (up);
                });
                const timer = setTimeout (() =>
                {
                    if (done) return;
                    done = true;
                    try { up.destroy (); } catch (e) { }
                    ipFailNote (host, c.ip);
                    if (c.svc) poolTouch (c.ip, true);
                    ipViaLog ('адрес не ответил -- беру следующий', host + ' -> ' + c.ip + ' (попытка ' + idx + ' из ' + cand.length + ')');
                    tryNext ();
                }, IP_TRY_TIMEOUT_MS);
                up.on ('error', () =>
                {
                    if (done) return;
                    done = true;
                    clearTimeout (timer);
                    ipFailNote (host, c.ip);
                    if (c.svc) poolTouch (c.ip, true);
                    ipViaLog ('адрес не ответил -- беру следующий', host + ' -> ' + c.ip + ' (попытка ' + idx + ' из ' + cand.length + ')');
                    tryNext ();
                });
                cSock.on ('error', () => { try { up.destroy (); } catch (e) { } });
            };
            tryNext ();
        });
        srv.on ('error', () => res (0));
        srv.once ('listening', () =>
        {
            try { srv.unref (); } catch (e) { }
            dohProxyPort = srv.address ().port;
            res (dohProxyPort);
        });
        try { srv.listen (0, '127.0.0.1'); } catch (e) { res (0); }
    });
}

function netFingerprint ()
{
    try
    {
        const nets = require ('os').networkInterfaces ();
        for (const k of Object.keys (nets))
            for (const a of (nets[k] || []))
                if (a && a.family === 'IPv4' && !a.internal) return k + '/' + String (a.mac || '') + '/' + String (a.address || '');
    }
    catch (e) { }
    return '';
}
let netMemCache = { at: 0, val: null };
async function netMem ()
{
    if (netMemCache.val !== null && (Date.now () - netMemCache.at) < 30000) return netMemCache.val;
    let val = null;
    try
    {
        const srv = dbServerList ()[0];
        if (srv) val = await db (srv, 'netState', 'route_memory');
    }
    catch (e) { }
    netMemCache = { at: Date.now (), val: val };
    return val;
}
async function netMemNote (kind, proxy)
{
    try
    {
        const srv = dbServerList ()[0];
        if (!srv || !kind) return;
        const val = { fingerprint: netFingerprint (), kind: String (kind), proxy: String (proxy || ''), at: Date.now () };
        await db (srv, 'netState', 'route_memory', val);
        netMemCache = { at: Date.now (), val: val };
    }
    catch (e) { }
}
async function netMemWin (kind)            // по этому маршруту трек реально скачался -- не проба, а факт
{
    try
    {
        const srv = dbServerList ()[0];
        if (!srv || !kind) return;
        const cur = (netMemCache && netMemCache.val) ? netMemCache.val : null;
        const val = Object.assign ({}, cur || {}, { fingerprint: netFingerprint (), kind: String (kind), at: Date.now () });
        val.wins = (cur && cur.kind === kind) ? ((cur.wins || 0) + 1) : 1;
        await db (srv, 'netState', 'route_memory', val);
        netMemCache = { at: Date.now (), val: val };
    }
    catch (e) { }
}
async function routeMemoryOrder (list)
{
    const m = await netMem ();
    if (!m || !m.kind || !m.fingerprint || m.fingerprint !== netFingerprint ()) return list;
    const i = list.findIndex (r => r && r.kind === m.kind);
    if (i <= 0) return list;
    return [list[i], ...list.slice (0, i), ...list.slice (i + 1)];
}

let routeSig = '';
function routeSigLog (sig, text)
{
    if (sig === routeSig) return;
    if (!BOT_RUN) { routeSig = sig; return; }
    const first = !routeSig;
    routeSig = sig;
    if (first) return;
    console.log ('[' + (d()) + '] [music] ' + text);
}

let directWarnedAt = 0;
async function ytRoutes ()
{
    if (!MUSIC_PROXIES.length)
    {
        const dnsOk = await directUsable ();
        const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
        const dohPort = MUSIC_DOH ? await dohProxyStart () : 0;
        const dohRoute = dohPort ? { proxy: 'http://127.0.0.1:' + dohPort, kind: 'doh' } : null;
        const dohSig = dohPort ? '|doh:1' : '|doh:0';
        const dohUse = (dohRoute && !dp.ok) ? (await dohCarryCheck ()).ok : !!dohRoute;   // путь только если он везёт музыку
        if (dohRoute && !dohUse)
            routeSigLog ('doh-nocarry', 'прямого пути нет, а свой маршрут по адресам музыку не везёт -- путём для музыки его не считаю; ' +
                'включи обход DPI (tools\\obhod.cmd) или впиши прокси в MUSIC.proxy; очередь и место в треке держу');
        const out = [];
        if (dp.ok) out.push ({ proxy: '', kind: 'direct' });
        if (dohRoute && dohUse) out.push (dohRoute);
        if (!dp.ok) out.push ({ proxy: '', kind: 'direct' });
        if (!dp.ok && dnsOk)
            routeSigLog ('direct-bad' + dohSig, 'прокси не задан, а прямой путь не отвечает (' + (dp.why || 'нет ответа') + ') -- ' +
                (dohRoute && dohUse ? 'пробую свой DoH-маршрут'
                    : 'похоже на блокировку провайдера: включи обход DPI (запрет/winws) или подними VPN-прокси' +
                        (dohRoute ? ' (свой маршрут по адресам музыку не везёт -- проверено живым yt-dlp)' : '')) +
                '; очередь и место в треке держу, пробую каждые ' + Math.round (NET_PING_STEP_MS / 1000) + ' с');
        else if (!dp.ok)
            routeSigLog ('dns-bad' + dohSig, 'твой DNS не резолвит youtube.com -- ' + (dohRoute && dohUse
                ? 'иду своим DoH-маршрутом: имена разрешает сам бот через DNS-over-HTTPS, системный DNS тут не нужен'
                : 'включи прокси (MUSIC.proxy) или смени DNS: 1.1.1.1 и 8.8.8.8 часто не резолвят youtube.com, а 9.9.9.9 и 94.140.14.14 -- резолвят'));
        else if (dohRoute)
            routeSigLog ('direct-ok' + dohSig, 'играю напрямую (прокси не задан), DoH-маршрут лежит запасным');
        else
            routeSigLog ('direct-ok' + dohSig, 'прямой путь снова отвечает -- играю напрямую');
        return await routeMemoryOrder (out);
    }
    const dnsOk = await directUsable ();
    if (!dnsOk && (Date.now () - directWarnedAt) > 600000)
    {
        directWarnedAt = Date.now ();
        console.log ('[' + (d()) + '] [music] youtube.com не резолвится локально -- иду через прокси (DIRECT на этой машине невозможен)');
    }
    const { alive } = await liveProxyList ();
    const liveRoutes = alive.map (p => ({ proxy: p, kind: 'proxy' }));
    const directRoute = { proxy: '', kind: 'direct' };
    const dohPort = MUSIC_DOH ? await dohProxyStart () : 0;
    const dohRoute = dohPort ? { proxy: 'http://127.0.0.1:' + dohPort, kind: 'doh' } : null;
    const dohSig = dohPort ? '|doh:1' : '|doh:0';
    const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
    const dohUse = (dohRoute && !dp.ok) ? (await dohCarryCheck ()).ok : !!dohRoute;       // путь только если он везёт музыку
    const dohOk = dohRoute && dohUse ? dohRoute : null;
    if (!alive.length && !dp.ok)
        routeSigLog ('p:|d:0' + dohSig, 'рабочих маршрутов нет: прокси молчат (' + MUSIC_PROXIES.join (', ') +
            '), прямой путь не отвечает (' + (dp.why || 'нет ответа') + ') -- похоже на блокировку провайдера: включи свой обход DPI (запрет/winws) или подними VPN-прокси. ' +
            (dohOk ? 'Свой DoH-маршрут у меня есть -- пробую и его. '
                : (dohRoute ? 'Свой DoH-маршрут есть, но музыку он не везёт (проверил живым yt-dlp). ' : 'Свой DoH-маршрут выключен (MUSIC.doh). ')) +
            'очередь и место в треке держу, пробую каждые ' +
            Math.round (NET_PING_STEP_MS / 1000) + ' с');
    else if (!alive.length)
        routeSigLog ('p:|d:1' + dohSig, 'иду напрямую, прокси молчат (' + MUSIC_PROXIES.join (', ') +
            ') -- прямой путь отвечает; если и он даст сбой, музыка подождёт сеть, очередь не пострадает');
    else if (!dp.ok)
        routeSigLog ('p:' + alive.join ('|') + '|d:0', 'иду через прокси ' + alive.join (', ') +
            ' -- прямой путь не отвечает (' + (dp.why || 'нет ответа') + ')');
    else
        routeSigLog ('p:' + alive.join ('|') + '|d:1', 'отвечают оба пути: прокси ' + alive.join (', ') +
            ' и DIRECT -- основной прокси, прямой остаётся запасным');
    if (!dnsOk)
    {
        routeSigLog ('dns-bad' + dohSig, 'твой DNS не резолвит youtube.com -- ' + (dohRoute
            ? 'иду своим DoH-маршрутом: имена разрешает сам бот через DNS-over-HTTPS, системный DNS тут не нужен'
            : 'включи прокси (MUSIC.proxy) или смени DNS: 1.1.1.1 и 8.8.8.8 часто не резолвят youtube.com, а 9.9.9.9 и 94.140.14.14 -- резолвят'));
        const bad = [...liveRoutes];
        if (dohOk) bad.push (dohOk);
        if (!bad.length) bad.push (directRoute);
        return await routeMemoryOrder (bad);
    }
    const out = [...liveRoutes];
    if (dp.ok) out.push (directRoute);
    if (dohOk) out.push (dohOk);
    if (!dp.ok) out.push (directRoute);
    return await routeMemoryOrder (out);
}

function sectionProxyFor (viaProxy)
{
    const self = /^https?:\/\//i.test (String (viaProxy || '')) ? viaProxy : '';
    if (self && !proxyBrieflyBad (self)) return self;
    for (const p of MUSIC_PROXIES)
        if (/^https?:\/\//i.test (p) && p !== self && !proxyBrieflyBad (p)) return p;
    return self;
}

function sectionProxyWhy (sectionProxy)
{
    if (sectionProxy) return ' (секция шла через ' + sectionProxy + ')';
    return MUSIC_PROXIES.some (p => /^https?:\/\//i.test (p))
        ? ' (у HTTP-прокси сбой -- секция шла напрямую)'
        : ' (в конфиге только SOCKS, а ffmpeg его не понимает -- секция шла напрямую)';
}

if (MUSIC_PROXY && BOT_RUN)
    (async () =>
    {
        const ok = await directWorks ();
        const why = ok ? '' : await directWhy ();
        console.log ('[' + (d()) + '] [music] запасной путь DIRECT: ' + (ok
            ? 'есть -- имя резолвится и прямой запрос проходит (проверил youtube.com)'
            : 'НЕ работает -- ' + (why || 'нет ответа') +
              ': всё идёт ТОЛЬКО через прокси, и если прокси отвалится, музыка подождёт сеть ' +
              '(очередь и место в треке держатся, попытки трека не тратятся)'));
    }) ();

async function netRouteAnswers ()
{
    if (!MUSIC_PROXIES.length) return await directUsable ();
    for (const p of MUSIC_PROXIES)
        if (await pingProxy (p, 1500))
        {
            proxyMarkGood (p);
            pingCache.set (String (p), { ok: true, at: Date.now () });
            return true;
        }
    return await directWorks ();
}

function clipWords (s, max)
{
    const _s = String (s === undefined || s === null ? '' : s).trim ();
    if (_s.length <= max) return _s;
    const _cut = _s.slice (0, max);
    const _sp = _cut.lastIndexOf (' ');
    return (_sp > max * 0.6 ? _cut.slice (0, _sp) : _cut) + '...';
}

function oneLine (s, max = 200)
{
    return clipWords (String (s === undefined || s === null ? '' : s).replace (/\s+/g, ' '), max);
}

const EXIT_HINTS =
{
    '-1':         'ffmpeg: общая ошибка',
    '-9':         'процесс убит (KILL)',
    '-13':        'нет доступа (EACCES)',
    '-15':        'процесс завершён (TERM)',
    '-22':        'неверные данные (EINVAL)',
    '-1094995529':'ffmpeg: не смог прочитать поток (Invalid data)',
};
function exitCodeText (code)
{
    let _n = Number (code);
    if (!Number.isFinite (_n)) return String (code);
    if (_n > 2147483647) _n -= 4294967296;
    const _h = EXIT_HINTS[String (_n)];
    return String (_n) + (_h ? ' (' + _h + ')' : '');
}

function ytDlpErr (e, max = 200)
{
    let _s = oneLine ((e && (e.stderr || e.message)) || e, max + 120);
    _s = _s.replace (/\[[^\]]*@\s*(?:0x)?[0-9a-fA-F]{6,}\]/g, '').replace (/\s+/g, ' ').trim ();
    _s = _s.replace (/\bcode (\d{6,})/g, (_m, _n) => 'code ' + exitCodeText (_n));
    return clipWords (_s, max);
}

function failedFast (proc, ms = 1500)
{
    if (!proc || typeof proc.then !== 'function') return Promise.resolve (false);
    return Promise.race
    ([
        proc.then (() => false).catch (() => true),
        new Promise (r => setTimeout (() => r (false), ms)),
    ]);
}

function isGoneError (e)
{
    const s = String ((e && (e.stderr || e.message)) || e);
    return /video unavailable|this video is unavailable|has been removed|removed by the uploader|is not available|private video|no longer available|has been terminated|blocked (?:it )?(?:on copyright|in your country)|not available in your country/i.test (s);
}

function streamFirstData (source, proc, ms)
{
    return new Promise (resolve =>
    {
        if (!source) return resolve (false);
        let done = false;
        const finish = ok =>
        {
            if (done) return;
            done = true;
            clearTimeout (timer);
            try { source.removeListener ('data', onData); } catch {}
            resolve (ok);
        };
        const onData = () => finish (true);
        const timer = setTimeout (() => finish (false), ms);
        source.once ('data', onData);
        if (proc && typeof proc.catch === 'function') proc.catch (() => finish (false));
    });
}

const SEEK_FFSEEK_MAX = 120;
const SEEK_SECTIONS_WAIT_MS = 8000;
const SEEK_SECTIONS_WAIT_PROXY_MS = 20000;
function seekSectionWait (opened)
{
    return (opened && opened.sectionProxy) ? SEEK_SECTIONS_WAIT_PROXY_MS : SEEK_SECTIONS_WAIT_MS;
}

function isNetworkError (e)
{
    let s = String ((e && e.stderr) || (e && e.message) || e);
    return /SocksHTTPS|proxy|timed out|timeout|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|refused|reset|URLError|getaddrinfo|network/i.test (s);
}

function isBotCheckError (e)
{
    const s = String ((e && (e.stderr || e.message)) || e);
    return /sign in to confirm|not a bot|confirm you.{0,4}re not a bot|too many requests|HTTP Error 429|rate.?limit/i.test (s);
}
function isRouteError (e)
{
    if (isGoneError (e)) return false;
    const s = String ((e && (e.stderr || e.message)) || e);
    return isNetworkError (e) || isBotCheckError (e) ||
        /unable to download (?:api page|video data)|giving up after|got error|HTTP Error 403/i.test (s);
}

let ytDlpQuiet = 0;
function ytRouteLabel (route, addr)
{
    const kind = route && route.kind ? String (route.kind) : (addr ? 'proxy' : 'direct');
    if (kind === 'doh') return 'сам: имена спросил по адресу в шифрованном виде (системный справочник имён не участвовал)';
    if (kind === 'proxy') return 'через прокси ' + addr + ' (это твой VPN)';
    return 'напрямую, без прокси';
}

async function ytDlpRun (query, optsBase)
{
    const startedAt = Date.now ();
    let routes = await ytRoutes ();
    let lastErr;
    let failedRoutes = 0;
    let triedList = [];
    for (let route of routes)
    {
        const addr = route && route.proxy ? String (route.proxy) : '';
        const tries = (addr && routes.length === 1) ? 2 : 1;
        for (let attempt = 1; attempt <= tries; attempt++)
        {
            if (attempt > 1)
            {
                if (!ytDlpQuiet)
                    console.log ('[' + (d()) + '] [music] прокси не ответил -- пробую ещё раз');
                await new Promise (res => setTimeout (res, 1200));
            }
            try
            {
                let opts = Object.assign ({ retries: 1, extractorRetries: 1 }, ytdlpCookieOpts (), optsBase, addr
                    ? { proxy: addr, socketTimeout: 10 }
                    : {});
                let r = await ytdlp (query, opts);
                if (addr) proxyMarkGood (addr);
                if (route && route.kind) netMemNote (route.kind, addr);   // запомнил, что сработало в этой сети
                if (route && route.kind) netMemWin (route.kind);          // и что по нему трек реально скачался
                const _qh = /^https?:\/\/([^\/]+)/.exec (String (query || ''));
                const _last = (route && route.kind === 'doh' && lastConn && (Date.now () - lastConn.at) < 120000) ? lastConn : null;
                if (_last) await dnsPlayNote (_last.host, _last.ip);       // точный факт: шёл моим маршрутом через этот адрес
                else if (_qh) await dnsPlayNote (_qh[1], '');             // факт без адреса: имя точно пригодилось для музыки
                if (!ytDlpQuiet)
                    console.log ('[' + (d()) + '] [music] взял трек ' + ytRouteLabel (route, addr) +
                        ' за ' + ((Date.now () - startedAt) / 1000).toFixed (1) + ' с' +
                        (failedRoutes ? ', до этого не сработало маршрутов: ' + failedRoutes : ''));
                return r;
            }
            catch (e)
            {
                lastErr = e;
                failedRoutes++;
                triedList.push (addr ? 'через прокси ' + addr : 'напрямую');
                if (!ytDlpQuiet)
                    console.error ('[music] ' + (addr ? 'через прокси ' + addr : 'напрямую') + ' не вышло: ' + ytDlpErr (e, 150));
                if (!isRouteError (e)) throw e;
                if (addr) proxyMarkBad (addr);
            }
        }
    }
    if (!ytDlpQuiet)
        console.error ('[' + (d()) + '] [music] трек взять не удалось: попробовал путей ' + routes.length +
            (triedList.length ? ' (' + [...new Set (triedList)].join ('; ') + ')' : '') +
            ' -- очередь и место в треке держу, беру заново, когда сеть оживёт');
    throw lastErr;
}

const MUSIC_VOLUME = 0.5;
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
            volume: MUSIC_VOLUME,
            textChannelId: null,
            playedMs: 0,
            playingSince: null,
            seekTrack: null,
            seekSec: 0,
            savedChannelId: null,
            pending: false,
            leftByUser: false,
            pausedByNobody: false,
            playedToSomeone: false,
            streamRetries: 0,
            skipRequested: false,
            startedAtSec: 0,
            startedFromSeek: false,
            justJoinedAt: 0,
            lastErrorAt: 0,
            playerWired: false,
            streamHandle: null,
            guildId: guildId,
            history: null,
            historyFromDb: false,
            repeat: null,
        };
    if (!$music[guildId].guildId) $music[guildId].guildId = guildId;
    return $music[guildId];
}

function isStaffInteraction (interaction)
{
    const server = interaction.guildId;
    if (!(server in SERVERS)) return false;
    const member = interaction.member;
    if (!member) return false;
    const s = SERVERS[server];
    const roles = member._roles ||
        (member.roles && member.roles.cache ? [...member.roles.cache.keys ()] : []);
    return !!((s.role_admin && roles.includes (s.role_admin)) ||
              (s.role_moder && roles.includes (s.role_moder)));
}

function isAdminInteraction (interaction)
{
    const server = interaction.guildId;
    if (!(server in SERVERS)) return false;
    const role_admin = SERVERS[server].role_admin;
    if (!role_admin) return false;
    const member = interaction.member;
    if (!member) return false;
    const roles = member._roles ||
        (member.roles && member.roles.cache ? [...member.roles.cache.keys ()] : []);
    return roles.includes (role_admin);
}

function isDJ (interaction)
{
    const server = interaction.guildId;
    if (!(server in SERVERS)) return false;
    let role_dj = SERVERS[server].role_dj || '';
    let member = interaction.member;
    if (!member) return false;
    if (member._roles.includes (SERVERS[server].role_admin)) return true;
    if (SERVERS[server].role_moder && member._roles.includes (SERVERS[server].role_moder)) return true;
    if (role_dj && member._roles.includes (role_dj)) return true;
    return !role_dj;
}

async function trackInfo (query)
{
    const info = await ytDlpRun
    (
        query,
        {
            dumpSingleJson: true,
            noWarnings: true,
            noPlaylist: true,
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

async function playlistInfo (query)
{
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

let musicNormalizeReady = false;
function probeNormalize ()
{
    return new Promise (resolve =>
    {
        if (!MUSIC_NORMALIZE) return resolve (false);
        if (!ffmpegPath) return resolve (false);
        let p;
        try
        {
            p = spawn (ffmpegPath,
                ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
                 '-i', 'anullsrc=r=48000:cl=stereo', '-af', MUSIC_NORMALIZE_FILTER,
                 '-t', '0.2', '-f', 'null', '-'],
                { windowsHide: true });
        }
        catch (e) { return resolve (false); }
        let err = '';
        let guard = setTimeout (() => { try { p.kill (); } catch {} resolve (false); }, 8000);
        p.stderr.on ('data', d => { err += String (d); });
        p.on ('error', () => { clearTimeout (guard); resolve (false); });
        p.on ('close', code =>
        {
            clearTimeout (guard);
            if (code !== 0 && err.trim ())
                console.error ('[music] выравнивание громкости недоступно: ' + ytDlpErr ({ stderr: err }, 150));
            resolve (code === 0);
        });
    });
}

const MUSIC_CACHE = MUSIC_CFG.cache !== false;
const MUSIC_CACHE_DIR = pathMod.isAbsolute (String (MUSIC_CFG.cache_dir || 'music_cache'))
    ? String (MUSIC_CFG.cache_dir)
    : pathMod.join (__dirname, String (MUSIC_CFG.cache_dir || 'music_cache'));
const MUSIC_CACHE_MAX_MB = MUSIC_CFG.cache_max_mb === undefined || MUSIC_CFG.cache_max_mb === null
    ? 2048
    : Math.max (0, Math.round (Number (MUSIC_CFG.cache_max_mb) || 0));
const MUSIC_CACHE_SHORT_MAX_MINUTES = (MUSIC_CFG.cache_short_max_minutes !== undefined && MUSIC_CFG.cache_short_max_minutes !== null)
    ? MUSIC_CFG.cache_short_max_minutes
    : undefined;
const MUSIC_CACHE_SHORT_MAX_SEC = (MUSIC_CACHE_SHORT_MAX_MINUTES === undefined || MUSIC_CACHE_SHORT_MAX_MINUTES === null
    ? 15
    : Math.max (0, Math.round (Number (MUSIC_CACHE_SHORT_MAX_MINUTES) || 0))) * 60;
const MUSIC_CACHE_KEEP_PLAYED = MUSIC_CFG.cache_keep_played !== false;
const MUSIC_CACHE_LONG_SETS = MUSIC_CACHE &&
    ((MUSIC_CFG.cache_long_sets === undefined || MUSIC_CFG.cache_long_sets === null)
        ? true : MUSIC_CFG.cache_long_sets === true);
const CACHE_PART_USEFUL_BYTES  = 65536;
const CACHE_PART_BYTES_PER_SEC = 16384;
const CACHE_PART_SAFE_FACTOR   = 0.9;
const CACHE_PART_AHEAD_SEC     = 20;
const CACHE_PART_MIN_AHEAD_SEC = 10;
const DISK_RETRY_MS            = 3000;
const CACHE_FILL_EVERY_MS      = 15000;      // как часто поглядываю, есть ли что догрузить
const CACHE_FILL_DEPTH         = 20;         // на сколько треков вперёд смотрю
const CACHE_FILL_FAIL_MS       = 10 * 60000; // трек, который не лёг, не трогаю 10 минут
const cachePartSpent = new Set ();
const cacheLongBusy = new Set ();           // ключи, которые качаются прямо сейчас (фоном)
const cacheFillBusy = new Set ();           // то же для догрузки очереди: один трек -- одна закачка
function cacheFullName (key) { return pathMod.join (MUSIC_CACHE_DIR, key + '.m4a'); }
function cachePartName (key) { return pathMod.join (MUSIC_CACHE_DIR, key + '.dl.m4a'); }
if (MUSIC_CACHE)
    console.log ('[' + (d()) + '] [music] кэш аудио: ВКЛЮЧЁН -- ' + MUSIC_CACHE_DIR + ' (' +
        (MUSIC_CACHE_MAX_MB ? 'лимит ' + MUSIC_CACHE_MAX_MB + ' МБ, старое удаляется само' : 'без лимита места') + ')' +
        (MUSIC_CACHE_KEEP_PLAYED
            ? '; проигранное остаётся НА ДИСКЕ ЗАПАСОМ: сеть или YouTube отвалились -- трек играет со своей копии, '
                + 'уходит только по лимиту (выключить: cache_keep_played: false)'
            : '; проигранные файлы удаляются сразу (cache_keep_played: false) -- на диске только играющий и предзагрузка') +
        (MUSIC_CACHE_SHORT_MAX_SEC ? '; треки до ' + Math.round (MUSIC_CACHE_SHORT_MAX_SEC / 60) +
            ' мин качаю на диск до старта, ' + (MUSIC_CACHE_LONG_SETS ? 'длинные сеты -- целиком в фоне'
                : 'длинные сеты пишу во время игры') : ''));
else
    console.log ('[' + (d()) + '] [music] кэш аудио: выключен (MUSIC.cache: false) -- звук идёт потоком, как раньше');
if (MUSIC_CACHE_LONG_SETS)
    console.log ('[' + (d()) + '] [music] длинные сеты: качаю на диск ЦЕЛИКОМ в фоне (' +
        (MUSIC_CACHE_SHORT_MAX_SEC ? 'всё, что длиннее ' + Math.round (MUSIC_CACHE_SHORT_MAX_SEC / 60) + ' мин' : 'вообще все') +
        ') -- файл уходит вперёд музыки, поэтому перезапуск и перемотка обходятся без YouTube' +
        '; это второй запрос на такой трек и примерно 57 МБ на час звука');
if (MUSIC_CACHE)
    console.log ('[' + (d()) + '] [music] запас вперёд: пока играет музыка, бот сам догружает на диск треки из очереди, ' +
        'которых в запасе ещё нет -- по одному, до ' + CACHE_FILL_DEPTH + ' треков вперёд, каждые ' +
        Math.round (CACHE_FILL_EVERY_MS / 1000) + ' с; один трек -- один файл, дважды одно и то же не качается ' +
        '(тот же трек в списке повторов -- это тот же файл, а не второй)');
const MUSIC_COOKIES_FILE = (() =>
{
    const raw = String (MUSIC_CFG.cookies_file === undefined || MUSIC_CFG.cookies_file === null
        ? '' : MUSIC_CFG.cookies_file).trim ();
    if (!raw) return '';
    return pathMod.isAbsolute (raw) ? raw : pathMod.join (__dirname, raw);
}) ();
const MUSIC_COOKIES_BROWSER = (() =>
{
    const raw = String (MUSIC_CFG.cookies_from_browser === undefined || MUSIC_CFG.cookies_from_browser === null
        ? '' : MUSIC_CFG.cookies_from_browser).trim ();
    return raw;
}) ();
function ytdlpCookieOpts ()
{
    if (MUSIC_COOKIES_FILE) return { cookies: MUSIC_COOKIES_FILE };
    if (MUSIC_COOKIES_BROWSER) return { cookiesFromBrowser: MUSIC_COOKIES_BROWSER };
    return {};
}
if (MUSIC_COOKIES_FILE && MUSIC_COOKIES_BROWSER)
    console.error ('[config] заданы И MUSIC.cookies_file, И MUSIC.cookies_from_browser -- беру файл, cookie из браузера не читаю (убери лишнее)');
if (MUSIC_COOKIES_FILE)
{
    let _ckThere = false;
    try { _ckThere = fsMod.existsSync (MUSIC_COOKIES_FILE); } catch (e) { }
    if (_ckThere)
        console.log ('[' + (d()) + '] [music] cookie-файл (MUSIC.cookies_file): ' + MUSIC_COOKIES_FILE +
            ' -- передаю в каждый запуск yt-dlp');
    else
        console.error ('[config] MUSIC.cookies_file = "' + MUSIC_COOKIES_FILE +
            '": файла нет -- запускаю без cookie (относительный путь считается от папки с ботом)');
}
else if (MUSIC_COOKIES_BROWSER)
    console.log ('[' + (d()) + '] [music] cookie беру из браузера «' + MUSIC_COOKIES_BROWSER +
        '» (--cookies-from-browser; файл не нужен) -- проверить: `node . cookies`');

const COOKIE_CHECK_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
function cookieVerdict (e)
{
    const s = String ((e && (e.stderr || e.message)) || e);
    if (/too many requests|HTTP Error 429|rate.?limit/i.test (s)) return 'net';
    if (/the page needs to be reloaded/i.test (s)) return 'stale';
    if (isBotCheckError (e)) return 'anon';
    if (/video unavailable|private video|not available in your country|premieres in/i.test (s)) return 'video';
    if (isRouteError (e) || isNetworkError (e) ||
        /timed out|proxy|ECONN|socket|EOF|reset|HTTP Error 4\d\d|HTTP Error 5\d\d/i.test (s)) return 'net';
    return 'other';
}
async function cookieRealCheck ()
{
    ytDlpQuiet++;
    try
    {
        await ytDlpRun (COOKIE_CHECK_URL, { simulate: true, quiet: true, noWarnings: true, noPlaylist: true });
        return { ok: true, verdict: 'ok' };
    }
    catch (e) { return { ok: false, verdict: cookieVerdict (e), why: ytDlpErr (e, 200) }; }
    finally { ytDlpQuiet--; }
}
async function cookieStartupCheck ()
{
    const src = MUSIC_COOKIES_FILE ? ('файл: ' + MUSIC_COOKIES_FILE)
                                   : ('браузер: «' + MUSIC_COOKIES_BROWSER + '»');
    const r = await cookieRealCheck ();
    if (r.verdict === 'stale' || r.verdict === 'anon')
        console.error ('[' + (d()) + '] [music] ВНИМАНИЕ: YouTube эти cookie НЕ принимает (' + src + '): ' + r.why +
            ' -- каждый трек будет спотыкаться. Проверь `node . cookies`: возьми ФАЙЛ cookie (MUSIC.cookies_file,' +
            ' так делает сам владелец -- этот путь работает) или убери cookie вовсе (анонимный путь работает).' +
            ' Файл можно собрать самому: `node . cookies --save firefox` (только домены музыки, с проверкой у YouTube).');
    else if (r.verdict === 'ok')
        console.log ('[' + (d()) + '] [music] cookie приняты YouTube (' + src + ') -- контрольный запрос прошёл');
}
if (BOT_RUN && (MUSIC_COOKIES_FILE || MUSIC_COOKIES_BROWSER))
    cookieStartupCheck ().catch (() => { });

const YTDLP_PATH = (ytdlp && ytdlp.constants && ytdlp.constants.YOUTUBE_DL_PATH) || 'yt-dlp';
const YTDLP_AUTO_UPDATE = MUSIC_CFG.ytdlp_auto_update !== false;
const YTDLP_UPDATE_AFTER = (() => { const v = Number (MUSIC_CFG.ytdlp_update_after_fails); return Number.isFinite (v) && v >= 0 ? Math.floor (v) : 5; }) ();
const YTDLP_CHECK_DAYS = (() => { const v = Number (MUSIC_CFG.ytdlp_check_days); return Number.isFinite (v) && v >= 0 ? Math.floor (v) : 60; }) ();
const YTDLP_UPDATE_DAYS = (() =>
{
    const v = Number (MUSIC_CFG.ytdlp_update_days);
    if (v === 0) return 0;
    return Number.isFinite (v) && v > 0 ? Math.floor (v) : 30;
}) ();
const YTDLP_FAIL_WINDOW_MS = 15 * 60 * 1000;
const YTDLP_UPDATE_COOLDOWN_MS = 60 * 60 * 1000;
let ytdlpVersion = '';
let ytdlpUpdating = false;
let ytdlpLastUpdateAt = 0;
let ytdlpFails = [];
let ytdlpPlanAt = 0;

function ytdlpRunOnce (argsArr, timeoutMs = 20000)
{
    return new Promise (resolve =>
    {
        let out = '', err = '', done = false;
        const fin = code => { if (done) return; done = true; resolve ({ code, out, err }); };
        let p = null;
        try { p = spawn (YTDLP_PATH, argsArr, { windowsHide: true }); }
        catch (e) { resolve ({ code: -2, out: '', err: String ((e && e.message) || e) }); return; }
        const t = setTimeout (() => { try { p.kill (); } catch (e) { } fin (-1); }, timeoutMs);
        p.stdout.on ('data', b => { out += String (b); });
        p.stderr.on ('data', b => { err += String (b); });
        p.on ('error', e => { clearTimeout (t); err += ' ' + String ((e && e.message) || e); fin (-2); });
        p.on ('close', c => { clearTimeout (t); fin (c); });
    });
}
function ytdlpAgeDays ()
{
    const m = /^(\d{4})\.(\d{2})\.(\d{2})/.exec (String (ytdlpVersion || ''));
    if (!m) return null;
    const t = Date.UTC (Number (m[1]), Number (m[2]) - 1, Number (m[3]));
    return Math.max (0, Math.floor ((Date.now () - t) / 86400000));
}
async function ytdlpVersionRead ()
{
    const r = await ytdlpRunOnce (['--version'], 15000);
    ytdlpVersion = String (r.out || '').trim ().split ('\n')[0];
    return ytdlpVersion;
}
function ytdlpNoVersionWhy (r)
{
    const e = oneLine (String ((r && r.err) || '').replace (/\s+/g, ' ').trim (), 160);
    if (!r) return 'нет ответа';
    if (r.code === -1) return 'не ответил за 15 с (таймаут)';
    if (r.code === -2) return 'не запускается' + (e ? ': ' + e : '');
    return 'код ' + r.code + (e ? ': ' + e : '');
}
function botIsExiting () { try { return $exiting === true; } catch (e) { return false; } }
async function ytdlpStartupReport ()
{
    let r = null, v = '';
    for (let attempt = 1; attempt <= 2; attempt++)
    {
        r = await ytdlpRunOnce (['--version'], 15000);
        v = String (r.out || '').trim ().split ('\n')[0];
        ytdlpVersion = v;
        if (v) break;
        if (attempt === 1) await new Promise (res => setTimeout (res, 3000));
    }
    if (!v)
    {
        if (botIsExiting ()) return;
        console.error ('[' + (d()) + '] [music] yt-dlp: версию узнать не вышло (' + ytdlpNoVersionWhy (r) +
            ') -- если повторяется, проверь бинарник или обнови его: ' + YTDLP_PATH + ' (вручную: node . ytdlp)');
        return;
    }
    const age = ytdlpAgeDays ();
    console.log ('[' + (d()) + '] [music] yt-dlp ' + v +
        (age === null ? '' : ' (выпуск ' + age + ' ' + plural (age, 'день', 'дня', 'дней') + ' назад)') +
        (YTDLP_AUTO_UPDATE
            ? '; при частых ошибках загрузки обновлю сам (вручную: node . ytdlp -U)'
            : '; автообновление выключено (MUSIC.ytdlp_auto_update: false)'));
    if (age !== null && YTDLP_CHECK_DAYS && age > YTDLP_CHECK_DAYS)
        console.log ('[' + (d()) + '] [music] yt-dlp давно не обновлялся (' + age + ' ' +
            plural (age, 'день', 'дня', 'дней') + ') -- если YouTube начнёт ругаться на всех роликах, обнови: `node . ytdlp -U`');
    if (YTDLP_UPDATE_DAYS)
        console.log ('[' + (d()) + '] [music] yt-dlp: плановое обновление ВКЛЮЧЕНО -- раз в сутки обновляю сам, если версии больше ' +
            YTDLP_UPDATE_DAYS + ' ' + plural (YTDLP_UPDATE_DAYS, 'день', 'дня', 'дней') + ' (MUSIC.ytdlp_update_days; 0 -- только по ошибкам загрузки)');
    await ytdlpPlannedCheck ('при старте').catch (() => { });
}
function ytdlpNoteFail (why)
{
    const now = Date.now ();
    ytdlpFails = ytdlpFails.filter (t => now - t < YTDLP_FAIL_WINDOW_MS);
    ytdlpFails.push (now);
    if (!YTDLP_AUTO_UPDATE || YTDLP_UPDATE_AFTER <= 0) return;
    if (ytdlpFails.length < YTDLP_UPDATE_AFTER) return;
    if (ytdlpUpdating || (now - ytdlpLastUpdateAt) < YTDLP_UPDATE_COOLDOWN_MS) return;
    ytdlpFails = [];
    ytdlpTryUpdate ('за ' + Math.round (YTDLP_FAIL_WINDOW_MS / 60000) + ' мин не заиграло ' + YTDLP_UPDATE_AFTER +
        ' треков, последняя причина: ' + why).catch (() => { });
}
async function ytdlpTryUpdate (reason)
{
    if (ytdlpUpdating) return false;
    ytdlpUpdating = true;
    ytdlpLastUpdateAt = Date.now ();
    const before = ytdlpVersion;
    console.log ('[' + (d()) + '] [music] yt-dlp: похоже на устаревшую версию (' + reason +
        ') -- пробую обновить (yt-dlp -U), это может занять минуту');
    const r = await ytdlpRunOnce (['-U'], 180000);
    const after = await ytdlpVersionRead ();
    ytdlpUpdating = false;
    const txt = oneLine ((String (r.out || '') + ' ' + String (r.err || '')).replace (/\s+/g, ' ').trim (), 160);
    if (after && after !== before)
        console.log ('[' + (d()) + '] [music] yt-dlp обновлён: ' + (before || '?') + ' -> ' + after + ' -- беру треки дальше');
    else if (r.code === 0)
    {
        const _planned = /^планово/.test (String (reason || ''));
        console.log ('[' + (d()) + '] [music] yt-dlp уже свежий (' + (after || before || '?') + ')' +
            (_planned ? ' -- обновлять нечего, это была плановая проверка'
                      : ' -- значит дело не в нём: смотри маршрут/прокси и сами видео'));
    }
    else
        console.error ('[' + (d()) + '] [music] yt-dlp обновить не вышло (код ' + r.code + (txt ? ': ' + txt : '') + ') -- обнови вручную: `node . ytdlp -U`');
    return true;
}
async function ytdlpPlannedCheck (why)
{
    if (!YTDLP_UPDATE_DAYS || ytdlpUpdating) return;
    const now = Date.now ();
    if (now < ytdlpPlanAt) return;
    ytdlpPlanAt = now + 24 * 60 * 60 * 1000;
    const age = ytdlpAgeDays ();
    const ver = ytdlpVersion || 'версия неизвестна';
    const aged = (age === null ? '' : ' (' + age + ' ' + plural (age, 'день', 'дня', 'дней') + ')');
    if (age !== null && age > YTDLP_UPDATE_DAYS)
    {
        console.log ('[' + (d()) + '] [music] yt-dlp: плановая проверка (' + why + ') -- ' + ver + aged +
            ', а порог ' + YTDLP_UPDATE_DAYS + ' ' + plural (YTDLP_UPDATE_DAYS, 'день', 'дня', 'дней') + ': версия старше -- обновляю сам');
        await ytdlpTryUpdate ('планово: версия старше ' + YTDLP_UPDATE_DAYS + ' ' + plural (YTDLP_UPDATE_DAYS, 'день', 'дня', 'дней') +
            ' (календарь)' + (ytdlpVersion ? ': ' + ytdlpVersion : ''));
        return;
    }
    console.log ('[' + (d()) + '] [music] yt-dlp: плановая проверка (' + why + ') -- ' + ver + aged +
        ', порог ' + YTDLP_UPDATE_DAYS + ': пока свежая, не трогаю (следующая через сутки)');
}
if (YTDLP_UPDATE_DAYS)
    setInterval (() => { ytdlpPlannedCheck ('по таймеру').catch (() => { }); }, 60 * 60 * 1000).unref ();

async function ytdlpCli (args)
{
    $cliOwnScreen ();
    const upd = args.some (a => /^(-u|--update)$/i.test (a));
    console.log ('[ytdlp] бинарник: ' + YTDLP_PATH);
    const v = await ytdlpVersionRead ();
    if (!v) { console.error ('[ytdlp] версию узнать не вышло -- бинарник не отвечает (проверь путь и права)'); return 1; }
    const age = ytdlpAgeDays ();
    console.log ('[ytdlp] версия: ' + v +
        (age === null ? '' : ' (выпуск ' + age + ' ' + plural (age, 'день', 'дня', 'дней') + ' назад)') +
        (YTDLP_CHECK_DAYS && age !== null && age > YTDLP_CHECK_DAYS ? ' -- СТАРАЯ, советую обновить' : ''));
    if (!upd) { console.log ('[ytdlp] обновить:  node . ytdlp -U'); return 0; }
    console.log ('[ytdlp] обновляю (yt-dlp -U)...');
    const r = await ytdlpRunOnce (['-U'], 300000);
    const txt = oneLine ((String (r.out || '') + ' ' + String (r.err || '')).replace (/\s+/g, ' ').trim (), 200);
    const v2 = await ytdlpVersionRead ();
    if (v2 && v2 !== v) console.log ('[ytdlp] готово: ' + v + ' -> ' + v2);
    else if (r.code === 0) console.log ('[ytdlp] версия не изменилась (' + v + ') -- уже самая свежая');
    else console.error ('[ytdlp] обновление не удалось (код ' + r.code + (txt ? ': ' + txt : '') +
        ') -- можно скачать yt-dlp.exe вручную и положить поверх старого');
    return 0;
}

function cookiesFileReport ()
{
    let t = '';
    try { t = fsMod.readFileSync (MUSIC_COOKIES_FILE, 'utf8'); }
    catch (e) { return { ok: false, why: 'файл не читается: ' + oneLine ((e && e.message) || e) }; }
    const lines = t.split (/\r?\n/).filter (l => l.trim () && !l.trim ().startsWith ('#'));
    const dom = new Map ();
    for (const l of lines)
    {
        const c = l.split ('\t');
        if (c.length < 7) continue;
        const d0 = String (c[0]).replace (/^\./, '').toLowerCase ();
        dom.set (d0, (dom.get (d0) || 0) + 1);
    }
    const yt = [...dom.keys ()].filter (d0 => /(^|\.)youtube\.com$|(^|\.)google\.com$|(^|\.)googlevideo\.com$/.test (d0));
    return { ok: lines.length > 0, lines: lines.length, domains: dom.size, yt,
        top: [...dom.entries ()].sort ((a, b) => b[1] - a[1]).slice (0, 6) };
}
const COOKIE_PROVIDER_HOSTS = ['youtube.com', 'youtu.be', 'googlevideo.com', 'soundcloud.com', 'bandcamp.com'];
const COOKIE_LOGIN_NAME = /^(SID|HSID|SSID|APISID|SAPISID|SIDCC|LOGIN_INFO|ST-|__Secure-\dP?(SID|APISID)|__Secure-YEC$|__Secure-YENID$)/i;
const COOKIE_GUEST_NAME = /^(GPS|PREF|SOCS|YSC|wide|VISITOR_INFO1_LIVE|VISITOR_PRIVACY_METADATA|__Secure-BUCKET|__Secure-ROLLOUT_TOKEN|__Secure-YNID)$/;

function cookieHostWanted (_host)
{
    const _h = String (_host === undefined || _host === null ? '' : _host).replace (/^\./, '').toLowerCase ();
    return COOKIE_PROVIDER_HOSTS.some (_d => _h === _d || _h.endsWith ('.' + _d));
}
function cookiesRowsDedup (_rows)
{
    const _m = new Map ();
    for (const _r of _rows)
    {
        const _k = _r.host + '|' + (_r.path || '/') + '|' + _r.name;
        const _old = _m.get (_k);
        if (!_old || Number (_r.expiry || 0) > Number (_old.expiry || 0)) _m.set (_k, _r);
    }
    return [..._m.values ()];
}
function cookiesNetscapeText (_rows, _source)
{
    const _out = ['# Netscape HTTP Cookie File',
        '# Собрано ботом PANDAMIA из браузера (' + _source + '), ' + new Date ().toLocaleString (), ''
    ];
    let _skipped = 0;
    for (const _r of _rows)
    {
        const _val = String (_r.value === undefined || _r.value === null ? '' : _r.value);
        if (/[\t\r\n]/.test (_val) || /[\t\r\n]/.test (String (_r.name))) { _skipped++; continue; }
        _out.push ([(_r.isHttpOnly ? '#HttpOnly_' : '') + _r.host,
            String (_r.host).startsWith ('.') ? 'TRUE' : 'FALSE',
            _r.path || '/', _r.isSecure ? 'TRUE' : 'FALSE',
            Math.max (0, Math.floor (Number (_r.expiry || 0))), _r.name, _val].join ('\t'));
    }
    return { text: _out.join ('\n') + '\n', skipped: _skipped };
}
function firefoxProfileResolve (_spec)
{
    const _root = pathMod.join (process.env.APPDATA || '', 'Mozilla', 'Firefox');
    let _s = String (_spec === undefined || _spec === null ? '' : _spec).trim ();
    const _m = /^([a-z0-9]+)\s*:\s*(.+)$/i.exec (_s);
    if (_m)
    {
        if (!/^firefox$/i.test (_m[1])) return { why: _m[1] };
        _s = _m[2].trim ();
    }
    if (_s && !/[\\\/]/.test (_s) && !/^firefox$/i.test (_s)) return { why: _s };
    if (/[\\\/]/.test (_s))
        return fsMod.existsSync (pathMod.join (_s, 'cookies.sqlite')) ? { dir: _s }
            : { why: 'в папке нет cookies.sqlite: ' + _s };
    let _ini = '';
    try { _ini = fsMod.readFileSync (pathMod.join (_root, 'profiles.ini'), 'utf8'); }
    catch (e) { return { why: 'profiles.ini не читается: ' + pathMod.join (_root, 'profiles.ini') }; }
    const _sections = [];
    let _cur = null;
    for (const _raw of _ini.split (/\r?\n/))
    {
        const _line = _raw.trim ();
        const _sec = /^\[(.+)\]$/.exec (_line);
        if (_sec) { _cur = { name: _sec[1], keys: {} }; _sections.push (_cur); continue; }
        if (!_cur || !_line || _line.startsWith (';') || _line.startsWith ('#')) continue;
        const _eq = _line.indexOf ('=');
        if (_eq > 0) _cur.keys[_line.slice (0, _eq).trim ()] = _line.slice (_eq + 1).trim ();
    }
    const _dirOf = (_x) => { const _d = _x.keys.IsRelative === '0' ? _x.keys.Path : pathMod.join (_root, _x.keys.Path);
        return fsMod.existsSync (pathMod.join (_d, 'cookies.sqlite')) ? _d : ''; };
    const _cands = [];
    for (const _x of _sections)
    {
        if (/^Install/i.test (_x.name) && _x.keys.Default)
            _cands.push ({ why: 'рабочий профиль Firefox', name: _x.keys.Default, dir: _dirOf ({ keys: { IsRelative: '1', Path: _x.keys.Default } }) });
    }
    for (const _x of _sections.filter (_y => /^Profile/i.test (_y.name) && _y.keys.Path))
        _cands.push ({ why: _x.keys.Default === '1' ? 'помечен Default=1' : 'есть cookie', name: _x.name, dir: _dirOf (_x) });
    const _hit = _cands.find (_x => _x.dir);
    if (!_hit)
        return { why: 'ни в одном профиле Firefox нет cookies.sqlite (' + (_cands.map (_x => _x.name).join (', ') || 'профилей нет') + ')' };
    return { dir: _hit.dir, profile: _hit.name, why: _hit.why };
}
function firefoxCookieRows (_dir)
{
    const _fs = require ('fs'), _os = require ('os');
    let _tmp = '';
    try
    {
        _tmp = _fs.mkdtempSync (pathMod.join (_os.tmpdir (), 'panda-cookie-'));
        for (const _f of ['cookies.sqlite', 'cookies.sqlite-wal', 'cookies.sqlite-shm'])
            try { _fs.copyFileSync (pathMod.join (_dir, _f), pathMod.join (_tmp, _f)); } catch (e) { }
        if (!_fs.existsSync (pathMod.join (_tmp, 'cookies.sqlite')))
            return { why: 'в папке нет cookies.sqlite: ' + _dir };
        let DatabaseSync = null;
        try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) { }
        if (!DatabaseSync) return { why: 'этот Node не умеет читать SQLite (node:sqlite) -- нужен Node 22+' };
        const _db = new DatabaseSync (pathMod.join (_tmp, 'cookies.sqlite'), { readOnly: true });
        try { return { rows: _db.prepare ('SELECT host, name, value, path, expiry, isSecure, isHttpOnly FROM moz_cookies').all () }; }
        finally { _db.close (); }
    }
    catch (e) { return { why: oneLine ((e && e.message) || e, 200) }; }
    finally { try { if (_tmp) _fs.rmSync (_tmp, { recursive: true, force: true }); } catch (e) { } }
}
async function cookieTextVerdict (_text)
{
    const _fs = require ('fs'), _os = require ('os');
    const _dir = _fs.mkdtempSync (pathMod.join (_os.tmpdir (), 'panda-ck-'));
    const _file = pathMod.join (_dir, 'cookies.txt');
    _fs.writeFileSync (_file, _text);
    ytDlpQuiet++;
    try
    {
        await ytDlpRun (COOKIE_CHECK_URL, { simulate: true, quiet: true, noWarnings: true, noPlaylist: true,
            cookies: _file, cookiesFromBrowser: undefined });
        return { ok: true };
    }
    catch (e) { return { ok: false, verdict: cookieVerdict (e), why: ytDlpErr (e, 160) }; }
    finally
    {
        ytDlpQuiet--;
        try { _fs.rmSync (_dir, { recursive: true, force: true }); } catch (e) { }
    }
}

const CHROMIUM_BROWSERS = {
    chrome:   ['Google/Chrome/User Data', 'Google/Chrome Beta/User Data', 'Google/Chrome Dev/User Data'],
    edge:     ['Microsoft/Edge/User Data'],
    chromium: ['Chromium/User Data'],
    brave:    ['BraveSoftware/Brave-Browser/User Data'],
    vivaldi:  ['Vivaldi/User Data'],
    opera:    ['Opera Software/Opera Stable', 'Opera Software/Opera GX Stable'],
    helium:   ['imput/Helium/User Data', 'Helium/User Data', 'NetImput/Helium/User Data'],
};
function chromiumDataDirFind (_spec)
{
    const _s = String (_spec === undefined || _spec === null ? '' : _spec).trim ();
    const _colon = _s.indexOf (':');
    const _name = (_colon > 0 ? _s.slice (0, _colon) : _s).trim ().toLowerCase ();
    const _given = _colon > 0 ? _s.slice (_colon + 1).trim () : '';
    if (_given)
    {
        const _dir = pathMod.isAbsolute (_given) ? _given : pathMod.join (process.env.LOCALAPPDATA || '', _given);
        return fsMod.existsSync (_dir) ? { dir: _dir, name: _name } : { why: 'папки нет: ' + _dir };
    }
    const _bases = [process.env.LOCALAPPDATA || '', process.env.APPDATA || ''].filter (_b => _b);
    const _cands = CHROMIUM_BROWSERS[_name] || [];
    for (const _rel of _cands)
        for (const _base of _bases)
        {
            const _dir = pathMod.join (_base, _rel);
            if (fsMod.existsSync (_dir)) return { dir: _dir, name: _name };
        }
    return { why: _cands.length ? '(искал: ' + _cands.join (', ') + ')' : 'такого браузера не знаю' };
}
function chromiumCookieFileOf (_profileDir)
{
    for (const _rel of ['Network/Cookies', 'Cookies'])
    {
        const _p = pathMod.join (_profileDir, _rel);
        if (fsMod.existsSync (_p)) return _p;
    }
    return '';
}
function chromiumProfilePick (_dataDir, _want)
{
    const _dirOf = (_name) => pathMod.join (_dataDir, _name);
    if (_want)
    {
        const _dir = pathMod.isAbsolute (_want) ? _want : _dirOf (_want);
        return fsMod.existsSync (_dir) ? { dir: _dir, why: 'назван вручную (--profile)' }
            : { why: 'профиля «' + _want + '» нет: ' + _dir };
    }
    if (chromiumCookieFileOf (_dataDir)) return { dir: _dataDir, why: 'cookie лежат в самой папке браузера' };
    let _last = 'Default';
    try
    {
        const _ls = JSON.parse (fsMod.readFileSync (pathMod.join (_dataDir, 'Local State'), 'utf8'));
        if (_ls && _ls.profile && typeof _ls.profile.last_used === 'string' && _ls.profile.last_used)
            _last = _ls.profile.last_used;
    }
    catch (e) { }
    if (fsMod.existsSync (_dirOf (_last))) return { dir: _dirOf (_last), why: 'последний использованный профиль (' + _last + ')' };
    try
    {
        for (const _name of fsMod.readdirSync (_dataDir))
            if (/^Profile \d+$/.test (_name) && chromiumCookieFileOf (_dirOf (_name)))
                return { dir: _dirOf (_name), why: 'первый профиль с cookie (' + _name + ')' };
    }
    catch (e) { }
    return { why: 'в папке браузера нет профиля с cookie: ' + _dataDir };
}
function dpapiUnprotect (_buf)
{
    const _ps = 'Add-Type -AssemblyName System.Security; $ProgressPreference = "SilentlyContinue"; ' +
        '[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect(' +
        '[Convert]::FromBase64String(\'' + _buf.toString ('base64') + '\'), $null, \'CurrentUser\'))';
    let _r = null;
    try
    {
        _r = require ('child_process').spawnSync ('powershell',
            ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from (_ps, 'utf16le').toString ('base64')],
            { encoding: 'utf8', timeout: 30000, windowsHide: true });
    }
    catch (e) { return null; }
    if (!_r || _r.status !== 0 || !_r.stdout) return null;
    const _lines = String (_r.stdout).split (/\r?\n/).map (_s => _s.trim ())
        .filter (_s => _s && !_s.startsWith ('#<') && !_s.startsWith ('<'));
    const _b64 = _lines.length ? _lines[_lines.length - 1] : '';
    if (!_b64 || !/^[A-Za-z0-9+/=]+$/.test (_b64)) return null;
    try { return Buffer.from (_b64, 'base64'); } catch (e) { return null; }
}
function chromiumKeyRead (_dataDir)
{
    let _ls = null;
    try { _ls = JSON.parse (fsMod.readFileSync (pathMod.join (_dataDir, 'Local State'), 'utf8')); }
    catch (e) { return { why: 'Local State не читается (без него ключа cookie не достать): ' + oneLine ((e && e.message) || e, 80) }; }
    const _enc = _ls && _ls.os_crypt && _ls.os_crypt.encrypted_key;
    if (!_enc || typeof _enc !== 'string') return { why: 'в Local State нет ключа os_crypt.encrypted_key' };
    const _raw = Buffer.from (_enc, 'base64');
    if (_raw.subarray (0, 5).toString () !== 'DPAPI')
        return { why: 'ключ cookie не от Windows (префикс «' + _raw.subarray (0, 5).toString ('latin1') + '») -- разбирать такой не умею' };
    const _key = dpapiUnprotect (_raw.subarray (5));
    if (!_key || _key.length !== 32)
        return { why: 'Windows не отдал ключ cookie через DPAPI' + (_key && _key.length ? ' (длина ' + _key.length + ')' : '') };
    return { key: _key };
}
const CHROMIUM_PROCS = {
    chrome:   ['chrome.exe'],
    edge:     ['msedge.exe'],
    chromium: ['chromium.exe'],
    brave:    ['brave.exe'],
    vivaldi:  ['vivaldi.exe'],
    opera:    ['opera.exe'],
    helium:   ['helium.exe'],
};
let _chromiumProcsCache = null;
function chromiumProcsRunning ()
{
    if (_chromiumProcsCache) return _chromiumProcsCache;
    const _found = {};
    try
    {
        const _out = String (require ('child_process').execSync ('tasklist /FO CSV /NH',
            { encoding: 'utf8', timeout: 15000, windowsHide: true }));
        for (const _line of _out.split (/\r?\n/))
        {
            const _m = /^"([^"]+)","(\d+)"/.exec (_line);
            if (!_m) continue;
            const _n = _m[1].toLowerCase ();
            if (!_found[_n]) _found[_n] = _m[2];
        }
    }
    catch (e) { }
    _chromiumProcsCache = _found;
    return _found;
}
function chromiumProcsOf (_browser)
{
    const _all = chromiumProcsRunning ();
    let _key = String (_browser === undefined || _browser === null ? '' : _browser).trim ().toLowerCase ();
    const _colon = _key.indexOf (':');
    if (_colon > 0) _key = _key.slice (0, _colon);
    const _names = CHROMIUM_PROCS[_key] || Object.keys (CHROMIUM_PROCS).map (_k => CHROMIUM_PROCS[_k][0]);
    const _out = [];
    for (const _n of _names) if (_all[_n]) _out.push (_n + ' (pid ' + _all[_n] + ')');
    return _out;
}
function chromiumCookieRowsRead (_dataDir, _profileDir, _label)
{
    const _fs = require ('fs');
    const _file = chromiumCookieFileOf (_profileDir);
    if (!_file) return { why: 'в профиле нет базы cookie (ни Network/Cookies, ни Cookies): ' + _profileDir };
    let _bytes = null;
    try { _bytes = _fs.readFileSync (_file); }
    catch (e)
    {
        const _run = chromiumProcsOf (_label);
        return { why: 'браузер ' + (_label ? '«' + _label + '» ' : '') + 'держит базу cookie открытой (' +
            oneLine ((e && e.message) || e, 70) + '). ' + (_run.length
                ? _run.join (', ') + ' запущен, а Chrome-like браузеры не отдают эту базу, пока работают' +
                  ' (не только копирование, но и чтение -- так задумано браузером). Закрой его и повтори.'
                : 'сам браузер не запущен -- файл занял кто-то другой; проверь, нет ли второго экземпляра,' +
                  ' и права на папку профиля.') };
    }
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) { }
    if (!DatabaseSync) return { why: 'этот Node не умеет читать SQLite (node:sqlite) -- нужен Node 22+' };
    let _tmp = '';
    try
    {
        _tmp = _fs.mkdtempSync (pathMod.join (require ('os').tmpdir (), 'panda-cr-'));
        _fs.writeFileSync (pathMod.join (_tmp, 'Cookies'), _bytes);
        const _db = new DatabaseSync (pathMod.join (_tmp, 'Cookies'));
        let _all = [];
        try
        {
            _all = _db.prepare ('SELECT host_key AS host, name, encrypted_value, path, ' +
                'CAST (expires_utc / 1000000 - 11644473600 AS INTEGER) AS expiry, is_secure, is_httponly FROM cookies').all ();
        }
        finally { _db.close (); }
        const _mine = _all.filter (_r => cookieHostWanted (_r.host));
        const _key = chromiumKeyRead (_dataDir);
        if (_key.why) return { why: _key.why, total: _mine.length };
        let _v20 = 0, _pre = 0, _fail = 0;
        const _plain = [];
        for (const _r of _mine)
        {
            const _b = Buffer.from (_r.encrypted_value);
            const _p3 = _b.subarray (0, 3).toString ('latin1');
            if (_p3 === 'v20') { _v20++; continue; }
            if (_p3 !== 'v10' && _p3 !== 'v11') { _pre++; continue; }
            try
            {
                const _dec = require ('crypto').createDecipheriv ('aes-256-gcm', _key.key, _b.subarray (3, 15));
                _dec.setAuthTag (_b.subarray (_b.length - 16));
                _plain.push ({ row: _r, pt: Buffer.concat ([_dec.update (_b.subarray (15, _b.length - 16)), _dec.final ()]) });
            }
            catch (e) { _fail++; }
        }
        let _cut = 0;
        if (_plain.length)
        {
            const _first = _plain[0].pt;
            while (_cut < _first.length && _plain.every (_x => _x.pt.length > _cut && _x.pt[_cut] === _first[_cut])) _cut++;
            if (_cut < 24 || _cut > 64) _cut = 0;
        }
        const _rows = [];
        for (const _x of _plain)
        {
            const _val = _x.pt.subarray (_cut).toString ('utf8');
            if (!_val) { _fail++; continue; }
            _rows.push ({ host: _x.row.host, name: _x.row.name, value: _val, path: _x.row.path,
                expiry: _x.row.expiry, isSecure: _x.row.is_secure, isHttpOnly: _x.row.is_httponly });
        }
        return { rows: _rows, total: _mine.length, decrypted: _plain.length - _fail, v20: _v20, pre: _pre, fail: _fail, cut: _cut };
    }
    catch (e) { return { why: 'разобрать базу cookie не вышло: ' + oneLine ((e && e.message) || e, 160) }; }
    finally { try { if (_tmp) _fs.rmSync (_tmp, { recursive: true, force: true }); } catch (e) { } }
}

async function cookiesSaveCli (_args)
{
    $cliOwnScreen ();
    const _flag = (_n) => { const _i = _args.findIndex (_a => new RegExp ('^' + _n + '$', 'i').test (_a)); return _i >= 0 ? String (_args[_i + 1] || '').trim () : ''; };
    const _pos = [];
    for (let _i = 0; _i < _args.length; _i++)
    {
        const _a = _args[_i];
        if (/^(--to|--browser)$/i.test (_a)) { _i++; continue; }
        if (/^-/.test (_a) || /^(cookies|node|\.)$/i.test (_a)) continue;
        _pos.push (_a);
    }
    const _browser = _flag ('--browser') || _pos[0] || MUSIC_COOKIES_BROWSER || 'firefox';
    const _dry = _args.some (_a => /^--dry$/i.test (_a));
    const _to = _flag ('--to');
    const _profileWant = _flag ('--profile');
    console.log ('[cookies] собираю файл сам: ' + (_browser ? 'браузер «' + _browser + '»' : 'браузер не назван'));
    let _rows = [], _src = '';
    if (/^firefox/i.test (_browser))
    {
        const _prof = firefoxProfileResolve (_browser);
        if (!_prof.dir)
        {
            console.error ('[cookies] профиль Firefox не найден: ' + _prof.why);
            console.error ('[cookies] можно указать путь вручную:  node . cookies --save firefox:C:\\путь\\к\\профилю');
            return 1;
        }
        console.log ('[cookies] профиль Firefox: ' + _prof.dir +
            (_prof.profile ? ' (' + _prof.profile + (_prof.why ? ', ' + _prof.why : '') + ')' : ''));
        const _got = firefoxCookieRows (_prof.dir);
        if (_got.why)
        {
            console.error ('[cookies] прочитать профиль не вышло: ' + _got.why);
            return 1;
        }
        _rows = cookiesRowsDedup (_got.rows.filter (_r => cookieHostWanted (_r.host)));
        _src = 'firefox';
        console.log ('[cookies] в профиле ' + _got.rows.length + ' строк, из них про музыку -- ' + _rows.length);
    }
    else
    {
        const _cd = chromiumDataDirFind (_browser);
        if (!_cd.dir)
        {
            console.error ('[cookies] браузер «' + _browser + '» не нашёл: ' + _cd.why);
            console.error ('[cookies] знаю: firefox, chrome, edge, chromium, brave, opera, vivaldi, helium --' +
                ' или путь вручную:  node . cookies --save chrome:C:\\путь\\к\\User Data');
            return 1;
        }
        console.log ('[cookies] браузер «' + _cd.name + '»: ' + _cd.dir);
        const _cp = chromiumProfilePick (_cd.dir, _profileWant);
        if (!_cp.dir) { console.error ('[cookies] профиль не найден: ' + _cp.why); return 1; }
        console.log ('[cookies] профиль: ' + _cp.dir + ' (' + _cp.why + ')');
        const _run = chromiumProcsOf (_cd.name);
        if (_run.length)
            console.log ('[cookies] браузер запущен: ' + _run.join (', ') +
                ' -- Chrome и Edge не отдают базу cookie, пока работают (Firefox отдаёт всегда, Helium -- как повезёт).' +
                ' Если чтение сейчас не выйдет, закрой браузер и повтори.');
        const _cr = chromiumCookieRowsRead (_cd.dir, _cp.dir, _browser);
        if (_cr.why) { console.error ('[cookies] ' + _cr.why); return 1; }
        console.log ('[cookies] строк в базе про музыку: ' + _cr.total + ', из них расшифровано ' + _cr.decrypted +
            (_cr.v20 ? ', привязанных к приложению (v20, не достать) -- ' + _cr.v20 : ''));
        if (_cr.cut)
            console.log ('[cookies] у расшифрованных значений был общий заголовок ' + _cr.cut +
                ' байт (так их пишет Windows) -- отброшен, значения в порядке');
        _rows = cookiesRowsDedup (_cr.rows.filter (_r => cookieHostWanted (_r.host)));
        _src = _cd.name;
        if (!_cr.total)
        {
            console.error ('[cookies] в базе нет строк про музыку -- войди в YouTube ЭТИМ браузером и повтори.');
            return 1;
        }
        if (!_cr.decrypted)
        {
            console.error ('[cookies] ни одну строку расшифровать не вышло: Windows привязал cookie к приложению' +
                ' (v20) -- такие cookie достаёт только сам браузер, и в файл их не выложить.' +
                ' Закрывать браузер тут бессмысленно: дело в самих cookie, а не в занятом файле.');
            console.error ('[cookies] что делать: либо браузер, где cookie не привязаны (у владельца так было с Helium),' +
                ' либо профиль Firefox, либо готовый файл.');
            return 1;
        }
        console.log ('[cookies] из них про музыку -- ' + _rows.length);
    }
    if (!_rows.length)
    {
        console.error ('[cookies] нет cookie музыкальных доменов (' + COOKIE_PROVIDER_HOSTS.join (', ') + ')' +
            ' -- войди в YouTube ЭТИМ браузером и повтори, иначе собирать нечего.');
        return 1;
    }
    return await cookieSaveRowsCli (_rows, _src, { to: _to, dry: _dry });
}
async function cookieSaveRowsCli (_rows, _src, _opt)
{
    const _variants = [
        ['как есть', _rows],
        ['без cookie входа (аккаунт Google)', _rows.filter (_r => !COOKIE_LOGIN_NAME.test (String (_r.name)))],
        ['только гостевые (без входа вовсе)', _rows.filter (_r => COOKIE_GUEST_NAME.test (String (_r.name)))],
    ];
    let _win = '', _winText = '', _winN = 0;
    for (const [_name, _list] of _variants)
    {
        if (!_list.length) { console.log ('[cookies] набор «' + _name + '»: пусто -- пропускаю'); continue; }
        const _made = cookiesNetscapeText (_list, _src);
        const _ver = await cookieTextVerdict (_made.text);
        if (_ver.ok)
        {
            console.log ('[cookies] набор «' + _name + '» (' + _list.length + ' строк): YouTube ПРИНЯЛ');
            _win = _name; _winText = _made.text; _winN = _list.length;
            break;
        }
        console.log ('[cookies] набор «' + _name + '» (' + _list.length + ' строк): YouTube не принял -- ' + _ver.why);
    }
    if (!_win)
    {
        console.error ('[cookies] ни один набор не подошёл: YouTube не принимает cookie этого профиля.');
        console.error ('[cookies] это значит, что вход в YouTube в этом браузере протух: зайди на youtube.com ИМ ЖЕ,' +
            ' убедись, что ты вошёл, и повтори команду.');
        console.error ('[cookies] ничего не менял -- файл на месте, музыка играет как играла.');
        return 1;
    }
    const _to = _opt && _opt.to ? String (_opt.to) : '';
    const _target = _to ? (pathMod.isAbsolute (_to) ? _to : pathMod.join (__dirname, _to))
        : (MUSIC_COOKIES_FILE || pathMod.join (__dirname, 'cookies.txt'));
    if (_opt && _opt.dry)
    {
        console.log ('[cookies] --dry: файл не трогаю. Собрал бы ' + _winN + ' строк (набор «' + _win + '») в ' + _target);
        return 0;
    }
    if (fsMod.existsSync (_target))
    {
        const _stamp = d ().replace (/[^0-9а-яёa-z]+/gi, '-');
        const _bak = pathMod.join (LOG_DIR, 'cookies-backup-' + _stamp + '.txt');
        try { fsMod.copyFileSync (_target, _bak); console.log ('[cookies] прежний файл сохранён: ' + _bak); }
        catch (e) { console.log ('[cookies] прежний файл сохранить не вышло (' + oneLine ((e && e.message) || e, 80) + ') -- перезаписываю'); }
    }
    try { fsMod.writeFileSync (_target, _winText); }
    catch (e) { console.error ('[cookies] записать файл не вышло: ' + oneLine ((e && e.message) || e, 160)); return 1; }
    console.log ('[cookies] файл записан: ' + _target + ' -- ' + _winN + ' строк, набор «' + _win + '», источник: ' + _src);
    if (MUSIC_COOKIES_FILE !== _target)
        console.log ('[cookies] впиши его в MUSIC: "cookies_file": "' + pathMod.basename (_target) + '"');
    if (_win !== 'как есть')
        console.log ('[cookies] почему не «как есть»: cookie входа (аккаунт Google) в этом профиле YouTube не принимает;' +
            ' зайдёшь в YouTube заново -- команда соберёт полный набор.');
    console.log ('[cookies] проверка:  node . cookies');
    return 0;
}
async function cookieCliVerdict ()
{
    console.log ('[cookies] проверяю по-настоящему: спрашиваю у YouTube метаданные контрольного видео...');
    const r = await cookieRealCheck ();
    if (r.verdict === 'ok')
    {
        console.log ('[cookies] YouTube ПРИНЯЛ cookie -- контрольный запрос прошёл, музыка заиграет');
        return 0;
    }
    if (r.verdict === 'stale' || r.verdict === 'anon')
    {
        console.error ('[cookies] НЕ ГОДЯТСЯ: YouTube эти cookie не принимает -- ' + r.why);
        console.error ('[cookies] с ними КАЖДЫЙ трек будет падать («The page needs to be reloaded»), а музыка -- рваться');
        if (MUSIC_COOKIES_FILE)
        {
            console.error ('[cookies] что делать: этот набор протух (обычно виноваты cookie ВХОДА в аккаунт Google,' +
                ' которые попали в файл) -- пересобери его:  node . cookies --save firefox');
            console.error ('[cookies] команда соберёт наборы заново и запишет тот, который YouTube РЕАЛЬНО принимает');
        }
        else
        {
            console.error ('[cookies] что делать: возьми ФАЙЛ cookie -- на этой машине работает только он:');
            console.error ('[cookies]   node . cookies --save firefox  -- соберу файл из браузера и сам проверю его у YouTube');
        }
        console.error ('[cookies] или убери cookie вовсе: анонимный путь здесь отвечает, музыка играет и без них');
        return 1;
    }
    if (r.verdict === 'video')
    {
        console.error ('[cookies] не уверен: контрольное видео недоступно (' + r.why + ') -- это не про cookie, проверь его в браузере');
        return 1;
    }
    console.log ('[cookies] проверить не вышло (маршрут/сеть): ' + r.why);
    console.log ('[cookies] это НЕ про cookie -- сами cookie прочитались нормально, попробуй команду позже');
    return 0;
}

async function cookiesCli (_args)
{
    if ((_args || process.argv.slice (2)).some (_a => /^--save$/i.test (_a)))
        return await cookiesSaveCli (_args || process.argv.slice (2));
    $cliOwnScreen ();
    console.log ('[cookies] источник cookie для yt-dlp: ' + (MUSIC_COOKIES_FILE ? 'файл'
        : (MUSIC_COOKIES_BROWSER ? 'браузер' : 'не задан (запросы идут анонимно)')));
    if (MUSIC_COOKIES_FILE)
    {
        const there = fsMod.existsSync (MUSIC_COOKIES_FILE);
        console.log ('[cookies] файл: ' + MUSIC_COOKIES_FILE + (there ? '' : ' -- ФАЙЛА НЕТ'));
        if (!there) return 1;
        const r = cookiesFileReport ();
        if (!r.ok) { console.error ('[cookies] ' + r.why); return 1; }
        console.log ('[cookies] строк с cookie: ' + r.lines + ', доменов: ' + r.domains +
            ' -- ' + r.top.map (d0 => d0[0] + ' (' + d0[1] + ')').join (', '));
        if (!r.yt.length)
        {
            console.error ('[cookies] в файле нет строк для youtube.com/google.com/googlevideo.com -- похоже, это не cookie YouTube (или выгрузка неполная): yt-dlp такой помощи не заметит');
            return 1;
        }
        console.log ('[cookies] cookie для YouTube на месте (' + r.yt.slice (0, 4).join (', ') + ') -- формат Netscape, годится');
        return await cookieCliVerdict ();
    }
    if (MUSIC_COOKIES_BROWSER)
    {
        console.log ('[cookies] браузер: ' + MUSIC_COOKIES_BROWSER + ' (yt-dlp --cookies-from-browser)');
        const r = await ytdlpRunOnce (['--cookies-from-browser', MUSIC_COOKIES_BROWSER, '--simulate', '--verbose',
            'https://example.invalid/cookie-check'], 30000);
        const all = String (r.out || '') + '\n' + String (r.err || '');
        const ext = /Extracted (\d+) cookies from ([^\n]+)/i.exec (all);
        const dbg = /Extracting cookies from ([^\n]+)/i.exec (all);
        const bad = /(could not find|could not copy|failed to (?:decrypt|read|extract)|decryption failed|no cookies|unsupported (?:platform|browser))/i.exec (all);
        if (ext) { console.log ('[cookies] yt-dlp прочитал ' + ext[1] + ' cookie из ' + String (ext[2]).trim ()); return await cookieCliVerdict (); }
        if (dbg) { console.log ('[cookies] yt-dlp читает cookie из ' + String (dbg[1]).trim () + ' (количество не назвал)'); return await cookieCliVerdict (); }
        if (bad)
        {
            console.error ('[cookies] браузерные cookie не прочитались: ' + oneLine (bad[0], 160) +
                ' -- закрой браузер и повтори (Chrome/Edge держат файл cookie открытым), или укажи профиль (firefox:C:\\путь\\к\\профилю), или возьми доступный здесь браузер');
            return 1;
        }
        console.error ('[cookies] не понял ответ yt-dlp -- вот что он сказал: ' + oneLine (String (r.err || r.out || 'без вывода'), 300));
        return 1;
    }
    const _anon = await cookieRealCheck ();
    if (_anon.verdict === 'ok')
        console.log ('[cookies] проверено: и БЕЗ cookie YouTube отвечает (контрольный запрос прошёл) -- если музыка играет, возиться с cookie не обязательно');
    else if (_anon.verdict === 'anon' || _anon.verdict === 'stale')
        console.log ('[cookies] проверено: без cookie YouTube отвечает «' + _anon.why + '» -- вот от этого cookie и спасают');
    else
        console.log ('[cookies] проверить анонимный путь не вышло (' + _anon.why + ') -- это про сеть/маршрут, не про cookie');
    console.log ('[cookies] ничего не задано -- запросы идут анонимно. Способы это исправить (любой один; тут работает первый):');
    console.log ('[cookies]   1) САМ:  node . cookies --save firefox  -- соберу файл из браузера (firefox, helium, chrome, edge...),' +
        ' оставлю только домены музыки, сам проверю набор у YouTube и запишу тот, который он принял;' +
        ' останется вписать его в MUSIC:  "cookies_file": "cookies.txt"');
    console.log ('[cookies]   2) ФАЙЛ руками: расширение "Get cookies.txt" выгружает файл в формате Netscape; положи его рядом с ботом и укажи  "cookies_file": "cookies.txt"');
    console.log ('[cookies]   3) БЕЗ ФАЙЛА (необязательный ключ): в блок MUSIC добавь  "cookies_from_browser": "firefox"  (или chrome, edge, brave) -- yt-dlp прочитает cookie из браузера сам.');
    console.log ('[cookies]      Для YouTube на этой машине так НЕ работает (набор профиля YouTube не принимает): годится для SoundCloud и Bandcamp,' +
        ' а у Chrome и Edge требует ЗАКРЫТОГО браузера -- проверено 25.09.2026');
    return 0;
}

if (BOT_RUN && !process.argv.slice (2).some (_a => /^ytdlp$/i.test (_a)))
    ytdlpStartupReport ().catch (() => { });

let cacheDirOk = false;
function cacheDirReady ()
{
    if (cacheDirOk) return true;
    try
    {
        fsMod.mkdirSync (MUSIC_CACHE_DIR, { recursive: true });
        cacheDirOk = true;
        cacheCleanStale ();
    }
    catch (e) { console.error ('[' + (d()) + '] [music] папка кэша недоступна (' + MUSIC_CACHE_DIR + '): ' +
        oneLine (e.message) + ' -- играю потоком, как раньше'); }
    return cacheDirOk;
}
function cacheCleanStale ()
{
    let names = [];
    try { names = fsMod.readdirSync (MUSIC_CACHE_DIR); } catch { return 0; }
    let kept = 0, junk = 0, bestSec = 0;
    for (const f of names)
    {
        if (!f.includes ('.dl.')) continue;
        const p = pathMod.join (MUSIC_CACHE_DIR, f);
        let st = null;
        try { st = fsMod.statSync (p); } catch { continue; }
        if (!st.isFile () || st.size < CACHE_PART_USEFUL_BYTES)
        {
            try { fsMod.unlinkSync (p); junk++; } catch {}
            continue;
        }
        kept++;
        bestSec = Math.max (bestSec, cachePartSeconds (st.size));
    }
    if (kept)
        console.log ('[' + (d()) + '] [music] кэш: оставил ' + kept + ' ' +
            plural (kept, 'недокачанный файл', 'недокачанных файла', 'недокачанных файлов') +
            ' прошлого запуска (записи примерно на ' + fmtDur (Math.round (bestSec)) +
            ') -- если позиция трека внутри, продолжу с диска сразу, без YouTube');
    else if (junk)
        console.log ('[' + (d()) + '] [music] кэш: убрал ' + junk + ' ' +
            plural (junk, 'огрызок', 'огрызка', 'огрызков') + ' прошлого запуска (мельче ' +
            Math.round (CACHE_PART_USEFUL_BYTES / 1024) + ' КБ -- продолжать с них нечего)');
    return kept;
}
function fmtMb (bytes) { return Math.max (1, Math.round (Number (bytes || 0) / 1048576)) + ' МБ'; }
function cachePartSeconds (bytes) { return Math.max (0, Number (bytes || 0) / CACHE_PART_BYTES_PER_SEC); }
function cacheKeyOf (track)
{
    const src = String ((track && (track.url || track.streamUrl)) || '');
    return crypto.createHash ('sha1').update (src).digest ('hex').slice (0, 16);
}
function cacheFind (track)
{
    if (!MUSIC_CACHE || !track || track.isLive || !cacheDirReady ()) return null;
    const base = cacheKeyOf (track) + '.';
    let names = [];
    try { names = fsMod.readdirSync (MUSIC_CACHE_DIR); } catch { return null; }
    for (const n of names)
    {
        if (!n.startsWith (base) || n.includes ('.dl.')) continue;
        const p = pathMod.join (MUSIC_CACHE_DIR, n);
        try { if (fsMod.statSync (p).size > 8192) return p; } catch {}
    }
    return null;
}
function cacheDropParts (key)
{
    let names = [];
    try { names = fsMod.readdirSync (MUSIC_CACHE_DIR); } catch { return; }
    for (const n of names)
        if (n.startsWith (key + '.dl.'))
            try { fsMod.unlinkSync (pathMod.join (MUSIC_CACHE_DIR, n)); } catch {}
}
function cachePartAny (track)
{
    // самая длинная пригодная запись этого трека на диске (то, с чего можно продолжить)
    if (!MUSIC_CACHE || !track || track.isLive || !cacheDirReady ()) return null;
    const base = cacheKeyOf (track) + '.dl.';
    let names = [];
    try { names = fsMod.readdirSync (MUSIC_CACHE_DIR); } catch { return null; }
    let best = null;
    for (const n of names)
    {
        if (!n.startsWith (base)) continue;
        if (cachePartSpent.has (n)) continue;
        const p = pathMod.join (MUSIC_CACHE_DIR, n);
        let st = null;
        try { st = fsMod.statSync (p); } catch { continue; }
        if (!st.isFile () || st.size < CACHE_PART_USEFUL_BYTES) continue;
        const sec = cachePartSeconds (st.size) * CACHE_PART_SAFE_FACTOR;
        if (!best || sec > best.sec) best = { file: p, name: n, sec: Math.round (sec) };
    }
    return best;
}
function cachePartFind (track, posSec, loose = false)
{
    if (!MUSIC_CACHE || !track || track.isLive || !cacheDirReady ()) return null;
    if (!(Number (posSec) >= 1)) return null;
    if (cacheLongBusy.has (cacheKeyOf (track))) return null;
    const best = cachePartAny (track);
    if (!best) return null;
    const want = Math.max (0, Math.round (Number (posSec) || 0));
    if (want + (loose ? CACHE_PART_MIN_AHEAD_SEC : CACHE_PART_AHEAD_SEC) > best.sec) return null;
    return best;
}
function cachePlayFrom (track, posSec = 0)
{
    if (!MUSIC_CACHE || !track || track.isLive) return null;
    const file = cacheFind (track);
    if (file) return { file: file, kind: 'copy', loose: false, what: 'целая копия этого трека' };
    const part = cachePartFind (track, posSec, true);
    if (part) return { file: part.file, kind: 'part', loose: true,
                       what: 'своя запись этого трека (примерно до ' + fmtDur (part.sec) + ')' };
    return null;
}
function netDiskPick (m)
{
    const t = (m && (m.seekTrack || (m.tracks && m.tracks[0]))) || null;
    if (!t) return null;
    const sec = (m.seekTrack === t) ? (m.seekSec || 0) : (t.seek || 0);
    return cachePlayFrom (t, sec);
}
function cacheSpendPart (file)
{
    const name = pathMod.basename (String (file || ''));
    if (!name) return;
    cachePartSpent.add (name);
    const drop = () =>
    {
        try { if (!fsMod.existsSync (file)) return true; fsMod.unlinkSync (file); return true; }
        catch { return false; }
    };
    if (drop ()) return;
    setTimeout (() => { if (!drop ()) setTimeout (drop, 700).unref (); }, 400).unref ();
}
function cachePromoteParts (key, track)
{
    // один трек -- один файл (имя всегда <sha1 адреса>.m4a): второй копии того же трека не будет,
    // а чужие огрызки (например, запись во время игры) тут не трогаю: своё имя -- .dl.stream
    const dst = cacheFullName (key);
    const src = cachePartName (key);
    let size = 0;
    try
    {
        if (fsMod.existsSync (dst))
        {
            // копия уже есть -- второй файл того же трека не нужен, но более полный оставляю
            const a = fsMod.existsSync (src) ? fsMod.statSync (src).size : 0;
            const b = fsMod.statSync (dst).size;
            if (a > b)
            {
                try { fsMod.renameSync (src, dst); }        // наша копия полнее -- заменяет прежнюю
                catch { try { fsMod.unlinkSync (src); } catch { } }
            }
            else
                try { fsMod.unlinkSync (src); } catch { }    // наша копия не полнее -- не держу вторую
            return dst;
        }
        if (!fsMod.existsSync (src)) return null;
        size = fsMod.statSync (src).size;
        if (size <= 8192) { fsMod.unlinkSync (src); return null; }
        fsMod.renameSync (src, dst);
    }
    catch { return null; }
    console.log ('[' + (d()) + '] [music] сохранил на диск: ' + (track && track.title ? track.title : 'трек') + ' (' + fmtMb (size) + ')');
    return dst;
}
async function cacheDownload (track, holder = {})
{
    cacheDirReady ();
    const viaProxy = ((await ytRoutes ())[0] || {}).proxy || '';
    const key = cacheKeyOf (track);
    cacheDropParts (key);
    const proc = ytdlp.exec
    (
        track.url,
        {
            o: cachePartName (key),
            noPart: true,
            quiet: true,
            noWarnings: true,
            noPlaylist: true,
            ...ytdlpCookieOpts (),
            ...(viaProxy ? { proxy: viaProxy, socketTimeout: 10 } : {}),
            f: 'bestaudio[acodec!=none][ext=m4a]/bestaudio[acodec!=none]/bestaudio/best',
            retries: 3,
        }
    );
    holder.stop = () =>
    {
        holder.cancelled = true;
        try { proc.weKilled = true; } catch {}
        try { if (typeof proc.kill === 'function') proc.kill (); } catch {}
        cacheDropParts (key);
    };
    try { await proc; }
    catch (e)
    {
        cacheDropParts (key);
        if (holder.cancelled) return null;
        throw e;
    }
    const file = cachePromoteParts (key, track);
    if (file) pruneCache ([file]);
    return file;
}
function longSetCached (track)
{
    return !!(MUSIC_CACHE_LONG_SETS && track && !track.isLive &&
        Number (track.duration) > MUSIC_CACHE_SHORT_MAX_SEC);
}
function longDownloadPrune (m)
{
    if (!m) return;
    const alive = t => !!t && (t === m.current || (m.tracks || []).includes (t));
    if (m.longDl && !alive (m.longDl.track)) cancelLongDownload (m);
    if (m.longWant && !alive (m.longWant)) m.longWant = null;
}
function cancelLongDownload (m)
{
    const h = m && m.longDl;
    if (m) m.longWant = null;
    if (!h) return;
    m.longDl = null;
    try { if (typeof h.stop === 'function') h.stop (); } catch {}
    cacheLongBusy.delete (h.key);
}
function startLongDownload (guildId, track, why = '')
{
    const m = $music[guildId];
    if (!m || !longSetCached (track) || cacheFind (track)) return;
    if (m.longDl)
    {
        if (m.longDl.track !== track) m.longWant = track;
        return;
    }
    const key = cacheKeyOf (track);
    const holder = { key: key, track: track };
    m.longDl = holder;
    cacheLongBusy.add (key);
    console.log ('[' + (d()) + '] [music] качаю сет на диск целиком в фоне (' +
        (why || 'файл идёт вперёд музыки -- перезапуск потом продолжит с диска') +
        '): ' + (track.title || 'трек'));
    cacheDownload (track, holder).then
    (
        file =>
        {
            if (m.longDl === holder) m.longDl = null;
            cacheLongBusy.delete (key);
            if (file)
                console.log ('[' + (d()) + '] [music] сет целиком на диске: ' + (track.title || 'трек') +
                    ' -- теперь он продолжается и перематывается без YouTube');
            const want = m.longWant;
            m.longWant = null;
            if (want && longSetCached (want))
                startLongDownload (guildId, want, 'заранее: предыдущий сет уже на диске');
        },
        e =>
        {
            if (m.longDl === holder) m.longDl = null;
            cacheLongBusy.delete (key);
            const want = m.longWant;
            m.longWant = null;
            if (want && longSetCached (want))
                startLongDownload (guildId, want, 'заранее: предыдущая закачка закончилась');
            if (holder.cancelled) return;
            console.error ('[music] сет на диск не лёг (' + (track.title || 'трек') + '): ' + ytDlpErr (e, 150) +
                ' -- музыку это не ломает, играю потоком');
        }
    );
}
function cacheTeeStart (track)
{
    if (!MUSIC_CACHE || !track || track.isLive || cacheFind (track) || !cacheDirReady ()) return null;
    const key = cacheKeyOf (track);
    const part = pathMod.join (MUSIC_CACHE_DIR, key + '.dl.stream');
    let ws;
    try { ws = fsMod.createWriteStream (part); } catch { return null; }
    ws.on ('error', () => { ws.__dead = true; });
    return {
        key, part, ws,
        finalize ()
        {
            try
            {
                if (ws.__dead) { try { fsMod.unlinkSync (part); } catch {} return null; }
                const size = fsMod.existsSync (part) ? fsMod.statSync (part).size : 0;
                if (size <= 8192) { try { fsMod.unlinkSync (part); } catch {} return null; }
                const file = cacheFullName (key);
                if (fsMod.existsSync (file))     // копия уже есть (например, скачалась в фоне) -- второй файл не нужен
                {
                    try { fsMod.unlinkSync (part); } catch {}
                    return file;
                }
                fsMod.renameSync (part, file);
                console.log ('[' + (d()) + '] [music] сохранил на диск: ' + (track.title || 'трек') + ' (' + fmtMb (size) + ')');
                pruneCache ([file]);
                return file;
            }
            catch { return null; }
        },
        abort ()
        {
            if (this.__done) return;
            this.__done = true;
            try { ws.destroy (); } catch {}
            const drop = () =>
            {
                try { if (!fsMod.existsSync (part)) return true; fsMod.unlinkSync (part); return true; }
                catch { return false; }
            };
            ws.once ('close', drop);
            let tries = 0;
            const again = setInterval (() => { if (drop () || ++tries >= 8) clearInterval (again); }, 400);
        },
    };
}
function cacheQueueRank ()
{
    // порядок цену файлов: 3 -- нужен прямо сейчас (играет, продолжу, готовится, качается);
    // 2 -- впереди в очереди (тот самый запас, который копится); 1 -- проигранное (уходит первым, самое старое вперёд)
    const rank = new Map ();
    const put = (t, level, order) =>
    {
        if (!t || t.isLive) return;
        const k = cacheKeyOf (t);
        const was = rank.get (k);
        if (was && was.level >= level) return;
        rank.set (k, { level: level, order: order || 0 });
    };
    for (const id of Object.keys ($music))
    {
        const m = $music[id];
        if (!m) continue;
        put (m.current, 3);
        put (m.seekTrack, 3);
        if (m.preload) put (m.preload.track, 3);
        if (m.longDl) put (m.longDl.track, 3);
        if (m.fill) put (m.fill.track, 3);
        for (let i = 0; i < (m.tracks || []).length; i++)
            put (m.tracks[i], 2, i + 1);
    }
    for (const k of cacheLongBusy) rank.set (k, { level: 3, order: 0 });
    for (const k of cacheFillBusy) rank.set (k, { level: 3, order: 0 });
    return rank;
}
function pruneCache (keepPaths = [])
{
    if (!MUSIC_CACHE_MAX_MB) return;
    const limit = MUSIC_CACHE_MAX_MB * 1048576;
    let names = [];
    try { names = fsMod.readdirSync (MUSIC_CACHE_DIR); } catch { return; }
    const keep = new Set ((keepPaths || []).filter (Boolean).map (p => pathMod.basename (p)));
    const rank = cacheQueueRank ();
    const items = [];
    let total = 0;
    for (const n of names)
    {
        const p = pathMod.join (MUSIC_CACHE_DIR, n);
        try { const st = fsMod.statSync (p); if (!st.isFile ()) continue; items.push ({ n, p, size: st.size, at: st.mtimeMs }); total += st.size; }
        catch {}
    }
    if (total <= limit) return;
    for (const it of items)
    {
        const r = rank.get (it.n.split ('.')[0]);
        if (keep.has (it.n) || (r && r.level === 3)) { it.level = 3; it.why = 'нужен сейчас'; }
        else if (r && r.level === 2) { it.level = 2; it.why = 'ещё впереди в очереди'; it.order = r.order; }
        else { it.level = 1; it.why = 'уже проигран'; }
    }
    items.sort ((a, b) => (a.level - b.level) ||
        (a.level === 2 ? (b.order - a.order) : 0) || (a.at - b.at));
    let freed = 0;
    for (const it of items)
    {
        if (total - freed <= limit) break;
        if (it.level >= 3) break;               // дальше только то, что нужно сейчас
        try
        {
            fsMod.unlinkSync (it.p); freed += it.size;
            console.log ('[' + (d()) + '] [music] кэш переполнен -- убрал файл (' + fmtMb (it.size) + '): ' + it.why +
                (it.level === 2 ? ' -- догружу, когда подойдёт ближе' : ''));
        }
        catch {}
    }
    if (freed && total - freed > limit)
        console.log ('[' + (d()) + '] [music] кэш: лимит ' + MUSIC_CACHE_MAX_MB +
            ' МБ временно превышен -- остальное нужно сейчас или ещё впереди, убирать нечего');
}
function cacheKeysInUse ()
{
    const set = new Set ();
    for (const [k, r] of cacheQueueRank ())
        if (r.level >= 2) set.add (k);
    return set;
}
function cacheDropUnused (retries = 5)
{
    if (!MUSIC_CACHE || MUSIC_CACHE_KEEP_PLAYED || !cacheDirOk) return;
    const keep = cacheKeysInUse ();
    let names = [];
    try { names = fsMod.readdirSync (MUSIC_CACHE_DIR); } catch { return; }
    const busy = [];
    let dropped = 0, freed = 0;
    for (const n of names)
    {
        const k = n.split ('.')[0];
        if (!/^[0-9a-f]{16}$/.test (k)) continue;
        if (keep.has (k)) continue;
        const p = pathMod.join (MUSIC_CACHE_DIR, n);
        let st;
        try { st = fsMod.statSync (p); } catch { continue; }
        if (!st.isFile ()) continue;
        try { fsMod.unlinkSync (p); dropped++; freed += st.size; }
        catch { busy.push (p); }
    }
    if (dropped)
        console.log ('[' + (d()) + '] [music] кэш: убрал ' + dropped + ' ' +
            plural (dropped, 'файл', 'файла', 'файлов') + ' (' + fmtMb (freed) +
            ') -- на диске остаются только то, что играет, готовится и ещё впереди в очереди');
    if (busy.length && retries > 0)
        setTimeout (() =>
        {
            const still = cacheKeysInUse ();
            let left = 0;
            for (const p of busy)
            {
                if (still.has (pathMod.basename (p).split ('.')[0])) continue;
                try { fsMod.unlinkSync (p); } catch { left++; }
            }
            if (left && retries > 1) setTimeout (() => cacheDropUnused (retries - 1), 700);
        }, 700).unref ();
}

function openCachedTrack (track, file, seekSec = 0)
{
    if (!ffmpegPath) return null;
    const args = ['-hide_banner', '-loglevel', 'error'];
    const cut = (!track.isLive && seekSec >= 1) ? Math.max (0, Math.floor (seekSec)) : 0;
    if (cut) args.push ('-ss', String (cut));
    args.push ('-i', file);
    if (musicNormalizeReady) args.push ('-af', MUSIC_NORMALIZE_FILTER);
    args.push ('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
    let ff;
    try { ff = spawn (ffmpegPath, args, { windowsHide: true }); }
    catch (e) { console.error ('[music] с диска не заиграть: ' + oneLine (e.message)); return null; }
    ff.stdin.on ('error', () => {});
    ff.stdout.on ('error', () => {});
    ff.on ('error', () => {});
    let err = '';
    ff.stderr.on ('data', ch => { err += String (ch); });
    ff.on ('close', code =>
    {
        if (code === 0 || code === null || ff.weKilled) return;
        console.error ('[' + (d()) + '] [music] играю с диска, но ffmpeg оборвался: код ' + exitCodeText (code) +
            (err.trim () ? ' -- ' + ytDlpErr ({ stderr: err }, 160) : ''));
    });
    const resource = createAudioResource (ff.stdout, { inputType: StreamType.Raw, inlineVolume: true });
    if (resource.volume) resource.volume.setVolume (MUSIC_VOLUME);
    return { resource, viaProxy: false, source: null, proc: null, ff, fromCache: true, seeked: true };
}

// ---------------------------------------------------------------------------
// запас вперёд: пока играет музыка, бот сам догружает на диск треки из очереди,
// которых в запасе ещё нет. Один трек -- одна закачка и один файл, очередь не трогаю.
// ---------------------------------------------------------------------------
function cacheFillPlan (m)
{
    // что из очереди ещё не лежит на диске (смотрю вперёд до CACHE_FILL_DEPTH треков)
    const plan = { total: 0, have: 0, part: [], need: [], skip: [] };
    const list = (m && m.tracks) || [];
    const seen = new Set ();
    for (let i = 0; i < list.length && i < CACHE_FILL_DEPTH; i++)
    {
        const t = list[i];
        if (!t || t.gone) continue;
        const seenKey = cacheKeyOf (t);
        if (seen.has (seenKey)) continue;      // тот же трек в списке дважды -- это один трек
        seen.add (seenKey);
        if (t.isLive) { plan.skip.push ({ t: t, why: 'прямой эфир' }); continue; }
        const dur = Number (t.duration) || 0;
        if (!dur) { plan.skip.push ({ t: t, why: 'длительность неизвестна' }); continue; }
        if (!MUSIC_CACHE_SHORT_MAX_SEC || dur > MUSIC_CACHE_SHORT_MAX_SEC)
        { plan.skip.push ({ t: t, why: 'длинная запись' }); continue; }
        plan.total++;
        if (cacheFind (t)) { plan.have++; continue; }
        const part = cachePartAny (t);
        if (part) { plan.have++; plan.part.push ({ t: t, sec: part.sec }); continue; }
        plan.need.push ({ t: t, at: i + 1 });
    }
    return plan;
}
function cacheFillPick (m)
{
    const plan = cacheFillPlan (m);
    for (const c of plan.need)
    {
        const t = c.t;
        const key = cacheKeyOf (t);
        if (cacheFillBusy.has (key) || cacheLongBusy.has (key)) continue;
        if (t === m.current || t === m.seekTrack) continue;
        if (m.preload && m.preload.track === t) continue;      // предзагрузка идёт первой
        if (m.longDl && m.longDl.track === t) continue;
        const bad = m.fillFail && m.fillFail.get (key);
        if (bad && bad > Date.now ()) continue;
        return { track: t, key: key, plan: plan };
    }
    return null;
}
function cacheFillStop (m)
{
    const h = m && m.fill;
    if (m) m.fill = null;
    if (!h) return;
    try { if (typeof h.stop === 'function') h.stop (); } catch {}
    cacheFillBusy.delete (h.key);
}
function cacheFillDone (m, plan)
{
    // одна строка, когда весь видимый запас уже на диске (и снова -- как только появится новый трек)
    if (!plan.total || plan.need.length) { m.fillDone = false; return; }
    if (m.fillDone) return;
    m.fillDone = true;
    console.log ('[' + (d()) + '] [music] запас вперёд собран: ' + plan.have + ' из ' + plan.total +
        ' ' + plural (plan.total, 'трека', 'треков', 'треков') + ' впереди уже на диске' +
        (plan.part.length ? ' (ещё ' + plan.part.length + ' начаты частично)' : '') +
        ' -- новые треки догружу сам, пока играет музыка');
}
async function cacheFillTick (guildId)
{
    const m = $music[guildId];
    if (!m || !MUSIC_CACHE || m.leaving || m.fill || m.netWait) return;
    if (!m.current || !m.connection || !(m.tracks || []).length) return;   // догружаю, только когда музыка идёт
    if ($deadScan[guildId]) return;                                        // сейчас проверка очереди -- не мешаю
    const pick = cacheFillPick (m);
    if (!pick) { cacheFillDone (m, cacheFillPlan (m)); return; }
    const holder = { key: pick.key, track: pick.track };
    m.fill = holder;
    holder.promise = (async () =>
    {
        let file = null, err = null;
        try { file = await cacheDownload (pick.track, holder); }
        catch (e) { err = e; }
        return { file: file, err: err };
    }) ();
    cacheFillBusy.add (pick.key);
    console.log ('[' + (d()) + '] [music] догружаю вперёд: ' + (pick.track.title || 'трек') +
        ' (это ' + pick.plan.need[0].at + '-й от игры; на диске ' + (pick.plan.total - pick.plan.need.length) +
        ' из ' + pick.plan.total + ' впереди)');
    let res = null;
    try { res = await holder.promise; } catch (e) { res = { err: e }; }
    cacheFillBusy.delete (pick.key);
    if (m.fill === holder) m.fill = null;
    if (holder.cancelled) return;
    if (!res || !res.file)
    {
        if (!m.fillFail) m.fillFail = new Map ();
        m.fillFail.set (pick.key, Date.now () + CACHE_FILL_FAIL_MS);
        console.error ('[' + (d()) + '] [music] заранее не легло (' + (pick.track.title || 'трек') + '): ' +
            (res && res.err ? ytDlpErr (res.err, 140) : 'файл на диск не лёг') +
            ' -- музыку это не ломает: трек заиграет как обычно, попробую позже');
        return;
    }
    const plan = cacheFillPlan (m);
    if ((m.tracks || []).includes (pick.track))
        console.log ('[' + (d()) + '] [music] запас вперёд: ' + (pick.track.title || 'трек') + ' -- на диске теперь ' +
            plan.have + ' из ' + plan.total + ' впереди' + (plan.need.length ? ' (осталось ' + plan.need.length + ')' : ''));
    else
        console.log ('[' + (d()) + '] [music] запас вперёд: ' + (pick.track.title || 'трек') +
            ' -- из очереди он уже ушёл, но копия осталась на диске');
    cacheFillDone (m, plan);
}
if (MUSIC_CACHE)
    setInterval (() =>
    {
        for (const id of Object.keys ($music))
        {
            if ($music[id] && $music[id].fill) continue;
            cacheFillTick (id).catch (() => {});
        }
    }, CACHE_FILL_EVERY_MS).unref ();

function cacheQueueSaved (server)
{
    // последняя записанная очередь этого сервера: только чтение (бот может работать прямо сейчас)
    let DatabaseSync = null;
    try { ({ DatabaseSync } = require ('node:sqlite')); } catch (e) { }
    const file = pathMod.join (__dirname, server + '.sqlite');
    if (!DatabaseSync || !fsMod.existsSync (file)) return null;
    let db = null, rows = [];
    try
    {
        db = new DatabaseSync (file, { readOnly: true });
        rows = db.prepare ('SELECT key, value FROM keyv').all ();
    }
    catch (e) { try { if (db) db.close (); } catch (e2) { } return { broken: oneLine ((e && e.message) || e) }; }
    try { db.close (); } catch (e) { }
    const st = dbPeekValue (rows, 'musicState:queue');
    return (st && typeof st === 'object') ? st : null;
}

function cacheCli (args = [])
{
    $cliOwnScreen ();
    const _mb = n => (Number (n || 0) / 1048576).toFixed (1) + ' МБ';
    const _when = t => new Date (t).toLocaleString ();
    if (!MUSIC_CACHE)
    {
        console.log ('[cache] кэш музыки выключен в конфиге (MUSIC.cache: false) -- файлов нет и не будет');
        return 0;
    }
    const _dir = pathMod.resolve (MUSIC_CACHE_DIR);
    console.log ('[cache] папка кэша музыки: ' + _dir);
    if (!fsMod.existsSync (_dir))
    {
        console.log ('[cache] папки ещё нет -- она появится, когда бот скачает первый трек');
        console.log ('[cache] пределы: лимит ' + (MUSIC_CACHE_MAX_MB ? MUSIC_CACHE_MAX_MB + ' МБ' : 'без лимита') +
            ', на диск до старта качаются треки до ' + (MUSIC_CACHE_SHORT_MAX_SEC ? Math.round (MUSIC_CACHE_SHORT_MAX_SEC / 60) + ' мин' : '0 мин'));
        return 0;
    }
    let names = [];
    try { names = fsMod.readdirSync (_dir); }
    catch (e) { console.log ('[cache] не смог прочитать папку: ' + oneLine (e.message)); return 1; }
    const files = [];
    for (const n of names)
    {
        const p = pathMod.join (_dir, n);
        let st = null;
        try { st = fsMod.statSync (p); } catch { continue; }
        if (st.isFile ()) files.push ({ n, p, size: st.size, at: st.mtimeMs, part: n.includes ('.dl.') });
    }
    const parts = files.filter (f => f.part);
    const done = files.filter (f => !f.part).sort ((a, b) => b.at - a.at);
    const total = done.reduce ((a, f) => a + f.size, 0);
    const partSize = parts.reduce ((a, f) => a + f.size, 0);
    if (args.includes ('--clear'))
    {
        let n = 0, bytes = 0, bad = 0;
        for (const f of files)
            try { fsMod.unlinkSync (f.p); n++; bytes += f.size; } catch { bad++; }
        console.log ('[cache] удалил: файлов ' + n + ' (' + _mb (bytes) + ')' + (bad ? ', не отдались: ' + bad : ''));
        console.log ('[cache] ничего не потеряно: это скачанные треки, а не данные бота -- он скачает их заново');
        return 0;
    }
    console.log ('[cache] готовых треков: ' + done.length + ' (' + _mb (total) + ')' +
        (parts.length ? ', недокачанных файлов: ' + parts.length + ' (' + _mb (partSize) + ')' : '') +
        ', лимит: ' + (MUSIC_CACHE_MAX_MB ? MUSIC_CACHE_MAX_MB + ' МБ' : 'без лимита'));
    if (!MUSIC_CACHE_KEEP_PLAYED)
        console.log ('[cache] проигранное не хранится (cache_keep_played: false): на диске только играющий трек и предзагрузка');
    else if (done.length)
        console.log ('[cache] это ЗАПАС: если YouTube или сеть отвалится, бот возьмёт трек из своей копии и очередь не встанет' +
            ' (не нужно -- выключить: cache_keep_played: false)');
    {
        const _doneKeys = new Set (), _partBest = new Map ();
        for (const f of done) _doneKeys.add (f.n.split ('.')[0]);
        for (const f of parts)
        {
            const _k = f.n.split ('.')[0];
            const _sec = Math.round (cachePartSeconds (f.size) * CACHE_PART_SAFE_FACTOR);
            if (!_partBest.has (_k) || _partBest.get (_k) < _sec) _partBest.set (_k, _sec);
        }
        let _anyQueue = false;
        for (const _srv of Object.keys (SERVERS).filter (_k => /^\d{17,20}$/.test (_k)))
        {
            const st = cacheQueueSaved (_srv);
            if (st && st.broken)
            {
                console.log ('[cache] сервер ' + _srv + ': не смог прочитать очередь (' + st.broken + ') -- пропускаю');
                continue;
            }
            if (!st) continue;
            _anyQueue = true;
            const _nm = (SERVERS[_srv] || {}).name;
            const cur = st.current || null;
            const ahead = (Array.isArray (st.tracks) ? st.tracks : []).slice (0, CACHE_FILL_DEPTH);
            let have = 0, skip = 0, live = 0;
            const need = [], part = [];
            for (const t of ahead)
            {
                if (!t) continue;
                if (t.isLive) { live++; continue; }
                const dur = Number (t.duration) || 0;
                if (!dur || !MUSIC_CACHE_SHORT_MAX_SEC || dur > MUSIC_CACHE_SHORT_MAX_SEC) { skip++; continue; }
                const _k = cacheKeyOf (t);
                if (_doneKeys.has (_k)) { have++; continue; }
                const _sec = _partBest.get (_k);
                if (_sec) { have++; part.push ({ t: t, sec: _sec }); continue; }
                need.push (t);
            }
            console.log ('[cache]');
            console.log ('[cache] --- чего ещё нет в запасе: сервер ' + _srv + (_nm ? ' («' + _nm + '»)' : '') + ' ---');
            if (cur)
            {
                const _ck = cacheKeyOf (cur);
                console.log ('[cache] играет сейчас: «' + clipText (cur.title || 'трек', 48) + '» -- ' +
                    (_doneKeys.has (_ck) ? 'своя копия на диске'
                        : (_partBest.get (_ck) ? 'записано частично, примерно до ' + fmtDur (_partBest.get (_ck))
                            : 'копии нет, звук идёт потоком')));
            }
            if (!ahead.length)
                console.log ('[cache] очередь пуста -- догружать нечего');
            else
            {
                console.log ('[cache] впереди ' + ahead.length + ' ' +
                    plural (ahead.length, 'трек', 'трека', 'треков') + ': с копией ' + have +
                    ', не хватает ' + need.length +
                    (part.length ? ', начаты частично ' + part.length : '') +
                    (skip ? ', на диск не кладу (длинные или без длительности) ' + skip : '') +
                    (live ? ', прямых эфиров ' + live : ''));
                if (need.length)
                    console.log ('[cache]   ждут диска (по порядку): ' + need.slice (0, 5).map (t =>
                        '«' + clipText (t.title || 'трек', 40) + '»' +
                        (Number (t.duration) > 0 ? ' (' + fmtDur (t.duration) + ')' : '')).join (', ') +
                        (need.length > 5 ? ' и ещё ' + (need.length - 5) : ''));
                if (part.length)
                    console.log ('[cache]   начаты частично: ' + part.slice (0, 3).map (x =>
                        '«' + clipText (x.t.title || 'трек', 40) + '» до ' + fmtDur (x.sec)).join (', ') +
                        (part.length > 3 ? ' и ещё ' + (part.length - 3) : ''));
            }
            if (st.at)
                console.log ('[cache] (по последней записи бота: ' + _when (st.at) + ')' +
                    (st.elapsed ? ', играл на ' + fmtDur (st.elapsed) : ''));
        }
        if (_anyQueue)
        {
            console.log ('[cache]');
            console.log ('[cache] это бот догружает сам: пока играет музыка -- по одному треку каждые ' +
                Math.round (CACHE_FILL_EVERY_MS / 1000) + ' с, вперёд до ' + CACHE_FILL_DEPTH +
                ' треков; один трек -- один файл, дважды одно и то же не качается; когда место кончается, ' +
                'первым уходит давно проигранное, а то, что впереди, -- в последнюю очередь');
        }
    }
    if (parts.length)
    {
        console.log ('[cache] недокачанное НЕ выбрасывается (v2.72): если позиция трека внутри записанного куска, ' +
            'продолжение идёт С ДИСКА сразу, без YouTube; мельче ' + Math.round (CACHE_PART_USEFUL_BYTES / 1024) +
            ' КБ бот убирает сам -- продолжать с них нечего');
        console.log ('[cache] с чего можно продолжить (в имени -- <sha1 адреса>, не название):');
        for (const f of parts.slice (0, 8))
            console.log ('  ' + f.n.padEnd (26) + _mb (f.size).padStart (10) + '  ~' +
                fmtDur (Math.round (cachePartSeconds (f.size))) + ' записи');
        if (parts.length > 8) console.log ('  ... и ещё ' + (parts.length - 8));
        console.log ('[cache] стирать их можно в любой момент: это не данные бота, а запись звука');
    }
    if (!files.length)
    {
        console.log ('[cache] пока пусто -- ничего не скачано');
        return 0;
    }
    console.log ('[cache] самое свежее (файл = <sha1 адреса>.m4a, имена треков бот в кэше не хранит):');
    for (const f of done.slice (0, 10))
        console.log ('  ' + f.n.padEnd (26) + _mb (f.size).padStart (10) + '  ' + _when (f.at));
    if (done.length > 10) console.log ('  ... и ещё ' + (done.length - 10));
    console.log ('[cache] удалять можно ВСЁ и в любой момент: в базе про кэш ничего нет, при необходимости бот скачает заново');
    console.log ('[cache] стереть целиком: `node . cache --clear`' +
        '; применить лимит к старому: `node . cache --prune`' +
        '; выключить кэш совсем: MUSIC.cache = false в config.json');
    if (args.includes ('--prune'))
    {
        console.log ('[cache] применяю лимит (' + MUSIC_CACHE_MAX_MB + ' МБ)...');
        pruneCache ([]);
        let after = 0;
        try { for (const n of fsMod.readdirSync (_dir)) after += fsMod.statSync (pathMod.join (_dir, n)).size; } catch {}
        console.log ('[cache] после уборки в папке ' + _mb (after));
    }
    return 0;
}

function configCli ()
{
    $cliOwnScreen ();
    const hasTop = _k => Object.prototype.hasOwnProperty.call (CONFIG_RAW || {}, _k);
    const _mus = (CONFIG_RAW && CONFIG_RAW.MUSIC && typeof CONFIG_RAW.MUSIC === 'object') ? CONFIG_RAW.MUSIC : {};
    const hasM = _k => Object.prototype.hasOwnProperty.call (_mus, _k);
    const YN = v => (v ? 'да' : 'нет');
    const orDash = v => (v === undefined || v === null || String (v) === '' ? '--' : String (v));
    const lines = [];
    const rows = [];
    const sec = t => rows.push ({ sec: t });
    const row = (k, v, src) => rows.push ({ k: String (k), v: String (v), src: String (src) });

    lines.push ('чем бот РЕАЛЬНО работает (только чтение; бот не запускается)');
    lines.push ('колонки: ключ | значение | откуда взято (config.json или значение по умолчанию)');
    lines.push ('секреты не печатаю: TOKEN и db_key видно только как «задан/пусто»');

    sec ('верхний уровень');
        row ('ID', CONFIG_APP_ID ? CONFIG_APP_ID : (TOKEN_APP_ID ? TOKEN_APP_ID : '--'),
            CONFIG_APP_ID ? (APP_ID_MISMATCH ? 'config.json (НО токен от ' + TOKEN_APP_ID + ' -- регистрирую по токену)' : 'config.json')
                : (TOKEN_APP_ID ? 'в файле нет -- беру из TOKEN' : 'нет ни в файле, ни в TOKEN: слэш-команды не встанут'));
    row ('TOKEN', TOKEN ? 'задан (секрет)' : 'ПУСТО -- бот не запустится', hasTop ('TOKEN') ? 'config.json' : '-- (в файле нет)');
    row ('PREFIX', orDash (PREFIX), hasTop ('PREFIX') ? 'config.json' : 'в файле нет: текстовые команды молчат');
    row ('DEBUG', YN (DEBUG), hasTop ('DEBUG') ? 'config.json' : 'по умолчанию (выкл)');
    row ('MESSAGE_CONTENT', YN (USE_MESSAGE_CONTENT), hasTop ('MESSAGE_CONTENT') ? 'config.json' : 'по умолчанию (запрашиваю)');
    row ('GUILD_MEMBERS', YN (USE_GUILD_MEMBERS), hasTop ('GUILD_MEMBERS') ? 'config.json' : 'по умолчанию (запрашиваю)');
    row ('STARTUP_DM', Array.isArray (STARTUP_DM) ? STARTUP_DM.length + ' адрес(ов)' : '--', hasTop ('STARTUP_DM') ? 'config.json' : 'по умолчанию (никому)');
    row ('OWNER (хостинг)', OWNER_HOSTER || 'НЕ ЗАДАН (нет /rekey и контакта)', hasTop ('OWNER') ? 'config.json' : '-- (в файле нет)');
    row ('db_key', DB_KEYS.length ? 'задан (шифрование ВКЛ)' : 'пусто (база открыта)', hasTop ('db_key') ? 'config.json' : '-- (в файле нет)');
    row ('db_key_prev', Array.isArray (db_key_prev) ? db_key_prev.length + ' шт' : '0', hasTop ('db_key_prev') ? 'config.json' : 'по умолчанию (0)');
    row ('privacy_url', PRIVACY_URL ? 'задан' : 'пусто (ссылки не будет)', hasTop ('privacy_url') ? 'config.json' : '-- (в файле нет)');
    row ('show_privacy_url', YN (SHOW_PRIVACY_URL), hasTop ('show_privacy_url') ? 'config.json' : 'по умолчанию (показывать)');
    row ('backup_minutes', BACKUP_EVERY_MINUTES + (BACKUP_EVERY_MINUTES ? ' мин' : ' (только при старте и вручную)'), hasTop ('backup_minutes') ? 'config.json' : 'по умолчанию (60)');
    row ('backup_keep (копий с датой)', BACKUP_KEEP + (BACKUP_KEEP ? '' : ' (старые не убираю)'), hasTop ('backup_keep') ? 'config.json' : 'по умолчанию (5)');
    row ('log_dir', LOG_DIR, hasTop ('log_dir') ? 'config.json' : 'по умолчанию (logs)');
    row ('log_keep_months', LOG_KEEP_MONTHS || '0 (не удалять)', hasTop ('log_keep_months') ? 'config.json' : 'по умолчанию (0)');

    sec ('музыка (MUSIC)');
    row ('proxy', MUSIC_PROXIES.length ? MUSIC_PROXIES.join (', ') : 'нет -- напрямую (DIRECT)', hasM ('proxy') ? 'config.json' : (process.env.MUSIC_PROXY ? 'переменная окружения MUSIC_PROXY' : '-- (в файле нет)'));
    row ('doh (свой маршрут по адресам)', YN (MUSIC_DOH), hasM ('doh') ? 'config.json' : 'по умолчанию (вкл: имена разрешаю сам, системный DNS не участвует)');
    row ('dpi_heal (поднимать обход сам)', YN (MUSIC_DPI_HEAL), hasM ('dpi_heal') ? 'config.json' : 'по умолчанию (вкл: пробую поднять обход, когда ни один путь не отвечает)');
    row ('cookies_file', MUSIC_COOKIES_FILE || '-- (не задан)', hasM ('cookies_file') ? 'config.json' : '-- (в файле нет)');
    row ('cookies_from_browser (необязательный)', MUSIC_COOKIES_BROWSER || '-- (не задан)', hasM ('cookies_from_browser') ? 'config.json' : 'не нужен, если задан cookies_file');
    row ('normalize (громкость)', YN (MUSIC_NORMALIZE), hasM ('normalize') ? 'config.json' : 'по умолчанию (вкл)');
    row ('filter', MUSIC_NORMALIZE_FILTER, hasM ('filter') ? 'config.json' : 'по умолчанию');
    row ('channel_status (шапка)', YN (MUSIC_CHANNEL_STATUS), hasM ('channel_status') ? 'config.json' : 'по умолчанию (не трогаю)');
    row ('ytdlp_auto_update', YN (YTDLP_AUTO_UPDATE), hasM ('ytdlp_auto_update') ? 'config.json' : 'по умолчанию (вкл)');
    row ('ytdlp_update_after_fails', YTDLP_UPDATE_AFTER, hasM ('ytdlp_update_after_fails') ? 'config.json' : 'по умолчанию (5)');
    row ('ytdlp_check_days', YTDLP_CHECK_DAYS, hasM ('ytdlp_check_days') ? 'config.json' : 'по умолчанию (60)');
    row ('ytdlp_update_days', YTDLP_UPDATE_DAYS
        ? YTDLP_UPDATE_DAYS + ' ' + plural (YTDLP_UPDATE_DAYS, 'день', 'дня', 'дней') + ' (обновляю сам)'
        : '0 (только по ошибкам загрузки)', hasM ('ytdlp_update_days') ? 'config.json' : 'по умолчанию (30)');
    row ('skip_absent_author', YN (MUSIC_SKIP_ABSENT), hasM ('skip_absent_author') ? 'config.json' : 'по умолчанию (да)');
    row ('cache (диск)', YN (MUSIC_CACHE), hasM ('cache') ? 'config.json' : 'по умолчанию (вкл)');
    row ('cache_dir', MUSIC_CACHE_DIR, hasM ('cache_dir') ? 'config.json' : 'по умолчанию (music_cache)');
    row ('cache_short_max_minutes', Math.round (MUSIC_CACHE_SHORT_MAX_SEC / 60) + ' мин',
        hasM ('cache_short_max_minutes') ? 'config.json' : 'по умолчанию (15)');
    row ('cache_long_sets', YN (MUSIC_CACHE_LONG_SETS), hasM ('cache_long_sets') ? 'config.json' : 'по умолчанию (вкл)');
    row ('cache_max_mb', MUSIC_CACHE_MAX_MB || '0 (без лимита)', hasM ('cache_max_mb') ? 'config.json' : 'по умолчанию (2048)');
    row ('cache_keep_played', YN (MUSIC_CACHE_KEEP_PLAYED), hasM ('cache_keep_played') ? 'config.json' : 'по умолчанию (вкл: копии остаются запасом)');
    row ('cache_fill (запас вперёд)', MUSIC_CACHE
            ? 'да: очередь догружается сама, по одному треку каждые ' + Math.round (CACHE_FILL_EVERY_MS / 1000) + ' с, до ' + CACHE_FILL_DEPTH + ' вперёд'
            : 'нет (кэш выключен)',
        'в коде: отдельного ключа нет, живёт вместе с cache');
    row ('queue_check (заранее)', YN (MUSIC_QUEUE_CHECK), hasM ('queue_check') ? 'config.json' : 'по умолчанию (вкл)');
    row ('queue_check_depth', QUEUE_CHECK_DEPTH + ' треков (первые ' + QUEUE_CHECK_STRICT + ' -- yt-dlp)', hasM ('queue_check_depth') ? 'config.json' : 'по умолчанию (20)');
    row ('queue_check_gap_ms', QUEUE_CHECK_GAP_MS + ' мс', hasM ('queue_check_gap_ms') ? 'config.json' : 'по умолчанию (5000)');
    row ('history_len', MUSIC_HISTORY_LEN + ' пачек', hasM ('history_len') ? 'config.json' : 'по умолчанию (25)');
    row ('history_tracks', MUSIC_HISTORY_TRACKS + ' треков', hasM ('history_tracks') ? 'config.json' : 'по умолчанию (500)');
    row ('queue_live_ms', QUEUE_LIVE_MS ? QUEUE_LIVE_MS + ' мс (миллисекунды)' : '0 (сам не обновляю)', hasM ('queue_live_ms') ? 'config.json' : 'по умолчанию (30000)');
    row ('net_wait_ms', NET_WAIT_MS + ' мс (до ' + NET_WAIT_MAX_MS + ' мс)', hasM ('net_wait_ms') ? 'config.json' : 'по умолчанию (10000)');

    for (const id of Object.keys (SERVERS))
    {
        if (!/^\d{17,20}$/.test (id)) continue;
        const s = SERVERS[id], has = _k => Object.prototype.hasOwnProperty.call (s, _k);
        const nm = s.name ? ' («' + s.name + '»)' : '';
        const on = s.allow === true;
        sec ('сервер ' + id + nm + (on ? ' -- обслуживается'
            : (has ('allow') ? ' -- ВЫКЛЮЧЕН (allow: false): бот его не обслуживает'
                : ' -- НЕ ОБСЛУЖИВАЕТСЯ: нет ключа "allow" (поставь "allow": true)')));
        row ('allow', YN (on), has ('allow') ? 'config.json' : 'в файле нет -- экземпляр не обслуживается');
        row ('name', orDash (s.name), has ('name') ? 'config.json' : '-- (в файле нет)');
        for (const k of ['log_channel', 'pipe_channel_source', 'pipe_channel_target', 'channel_common',
                         'role_admin', 'role_moder', 'role_dj', 'role_for_manage', 'role_for_no_speak',
                         'role_for_no_stream', 'role_for_no_media', 'role_for_no_chat',
                         'temp_category', 'temp_lobby', 'welcome_channel', 'welcome_message',
                         'welcome_public_channel', 'welcome_public_message', 'owner_server'])
            row (k, orDash (s[k]), has (k) ? 'config.json' : '-- (в файле нет)');
        row ('tag_add (ключ в нике)', YN (tagEnabled (id)),
            s.tag_add === undefined || s.tag_add === null ? 'по умолчанию (не ставится)'
                : (typeof s.tag_add === 'boolean' ? 'config.json' : 'config.json (мусор -- выкл, см. замечания)'));
        row ('tag (ключ в нике)', typeof s.tag === 'string'
                ? (s.tag ? s.tag : 'пусто -- ключ не ставится')
                : TAG_DEFAULT + ' (по умолчанию)',
            has ('tag') ? 'config.json' : 'по умолчанию (' + TAG_DEFAULT + ')');
        row ('welcome_prefix', s.welcome_prefix === false ? 'нет (без описания бота)' : 'да', has ('welcome_prefix') ? 'config.json' : 'по умолчанию (да)');
        row ('queue_page', (Number (s.queue_page) || 15) + ' треков (в коде максимум 25)', has ('queue_page') ? 'config.json' : 'по умолчанию (15)');
        row ('onLeaveBanTimeout', (Number (s.onLeaveBanTimeout) || 0) + (Number (s.onLeaveBanTimeout) ? ' мин' : ' (механизм выкл)'), has ('onLeaveBanTimeout') ? 'config.json' : 'в коде 0 -- без ключа не работает');
        row ('onLeaveBanRealy', YN (flagOn (id, 'onLeaveBanRealy')), has ('onLeaveBanRealy') ? 'config.json' : 'по умолчанию (нет -- не наказываю)');
        row ('onEnterBanRealy', YN (flagOn (id, 'onEnterBanRealy')), has ('onEnterBanRealy') ? 'config.json' : 'по умолчанию (нет -- не наказываю)');
        row ('save_roles', YN (s.save_roles !== false), has ('save_roles') ? 'config.json' : 'по умолчанию (вкл)');
        row ('save_roles_days', (Number (s.save_roles_days) || 0) + ' (0 -- всегда)', has ('save_roles_days') ? 'config.json' : 'по умолчанию (0)');
        row ('save_roles_exclude', Array.isArray (s.save_roles_exclude) ? s.save_roles_exclude.length + ' шт' : '0', has ('save_roles_exclude') ? 'config.json' : 'по умолчанию (пусто)');
        row ('bans_history_days', (Number (s.bans_history_days) || 0) + ' (0 -- всегда)', has ('bans_history_days') ? 'config.json' : 'по умолчанию (0)');
        row ('deaf_exempt', Array.isArray (s.deaf_exempt) ? s.deaf_exempt.length + ' шт' : '0', has ('deaf_exempt') ? 'config.json' : 'по умолчанию (пусто)');
        row ('show_owner_hoster', YN (s.show_owner_hoster !== false), has ('show_owner_hoster') ? 'config.json' : 'по умолчанию (да)');
        row ('show_owner_server', YN (s.show_owner_server !== false), has ('show_owner_server') ? 'config.json' : 'по умолчанию (да)');
        row ('show_privacy_url (сервер)', YN (showPrivacyUrl (id)) + (PRIVACY_URL ? '' : ' (ссылки нет)'), has ('show_privacy_url') ? 'config.json' : 'по верхнему show_privacy_url');
    }

    for (const l of lines) console.log ('[config] ' + l);
    const body = rows.filter (r => r.k);
    const kw = Math.max (24, ...body.map (r => r.k.length)) + 2;
    const vw = Math.max (20, ...body.map (r => r.v.length)) + 2;
    for (const r of rows)
    {
        if (r.sec) { console.log ('[config]'); console.log ('[config]  ' + r.sec); continue; }
        console.log ('[config]    ' + r.k.padEnd (kw) + r.v.padEnd (vw) + r.src);
    }
    const issues = configSanityIssues ();
    const drift = configDriftIssues ();
    const tmpl = configTemplateIssues ();
    console.log ('[config]');
    if (!issues.length)
        console.log ('[config] замечаний [config] нет -- так и должно быть');
    else
    {
        console.log ('[config] замечания [config] (' + issues.length + '):');
        for (const i of issues) console.log ('[config]   ' + i);
    }
    for (const i of drift) console.log ('[config] ' + i);
    if (tmpl.hard.length || tmpl.soft.length)
    {
        console.log ('[config] ШАБЛОНЫ КОНФИГОВ' + (tmpl.hard.length ? ' (РАСХОЖДЕНИЕ -- код 1)' : ' (замечания)') +
            ': эталон -- config.example.json, config.minimal.json -- чтобы запуститься, config.json -- только не по умолчанию:');
        for (const i of tmpl.hard) console.log ('[config]   ' + i);
        for (const i of tmpl.soft) console.log ('[config]   ' + i);
        console.log ('[config]   правка: порядок, блоки и подсказки -- в config.example.json, потом то же в остальных (config.json правит человек: бот его не переписывает)');
    }
    console.log ('[config] все ключи и пояснения к ним -- config.example.json; здесь только то, что бот взял сейчас');
    return tmpl.hard.length ? 1 : 0;
}

if (process.argv.slice (2).some (_a => /^config$/i.test (_a)))
{
    let _code = 0;
    try { _code = configCli (); }
    catch (e) { console.log ('[config] ошибка: ' + ((e && e.message) || e)); _code = 1; }
    $cliDone (_code);
}

if (process.argv.slice (2).some (_a => /^cache$/i.test (_a)))
{
    let _code = 0;
    try { _code = cacheCli (process.argv.slice (2)); }
    catch (e) { console.log ('[cache] ошибка: ' + ((e && e.message) || e)); _code = 1; }
    $cliDone (_code);
}

if (process.argv.slice (2).some (_a => /^cookies$/i.test (_a)))
    (async () =>
    {
        let _code = 1;
        try { _code = await cookiesCli (process.argv.slice (2)); }
        catch (e) { console.log ('[cookies] ошибка: ' + ((e && e.message) || e)); }
        $cliDone (_code);
    }) ();

if (process.argv.slice (2).some (_a => /^obhod$/i.test (_a)))
    (async () =>
    {
        let _code = 1;
        try { _code = await obhodCli (process.argv.slice (2)); }
        catch (e) { console.log ('[obhod] ошибка: ' + ((e && e.message) || e)); }
        $cliDone (_code);
    }) ();

if (process.argv.slice (2).some (_a => /^ytdlp$/i.test (_a)))
    (async () =>
    {
        let _code = 1;
        try { _code = await ytdlpCli (process.argv.slice (2)); }
        catch (e) { console.log ('[ytdlp] ошибка: ' + ((e && e.message) || e)); }
        $cliDone (_code);
    }) ();

async function createTrackStream (track, seekSec = 0, seekMode = 'sections', partLoose = false)
{
    const _cached = MUSIC_CACHE ? cacheFind (track) : null;
    if (_cached)
    {
        const r = openCachedTrack (track, _cached, seekSec);
        if (r) return r;
    }
    if (seekSec >= 1 && !track.isLive)
    {
        const _part = cachePartFind (track, seekSec, partLoose);
        if (_part)
        {
            const rp = openCachedTrack (track, _part.file, seekSec);
            if (rp)
            {
                console.log ('[' + (d()) + '] [music] продолжаю с диска (недокачанный файл прошлого запуска: ' +
                    'записи примерно на ' + fmtDur (_part.sec) + ', беру с ' + fmtDur (Math.round (seekSec)) + '): ' +
                    (track.title || 'трек'));
                return { ...rp, fromPart: true, partFile: _part.file, partName: _part.name, partSec: _part.sec };
            }
        }
    }
    let viaProxy = ((await ytRoutes ())[0] || {}).proxy || '';
    const seek = (seekMode === 'sections' && seekSec >= 1 && !track.isLive);
    const seekProxy = seek ? sectionProxyFor (viaProxy) : '';
    const seekInFfmpeg = (seekMode === 'ffseek' && seekSec >= 1 && !track.isLive);
    const ytdlpStream = ytdlp.exec
    (
        track.url,
        {
            o: '-',
            quiet: true,
            noWarnings: true,
            noPlaylist: true,
            ...ytdlpCookieOpts (),
            ...(viaProxy ? { proxy: viaProxy, socketTimeout: 10 } : {}),
            f: 'bestaudio[acodec!=none][ext=m4a]/bestaudio[acodec!=none]/bestaudio/best',
            bufferSize: '4M',
            retries: 3,
            ...(seek ? { ffmpegLocation: ffmpegPath, downloadSections: '*' + Math.max (0, Math.floor (seekSec) - 1) + '-inf' } : {}),
            ...(seekProxy ? { downloaderArgs: 'ffmpeg_i:-http_proxy ' + seekProxy } : {}),
        }
    );
    if (ytdlpStream && typeof ytdlpStream.catch === 'function')
        ytdlpStream.catch (e =>
        {
            ytdlpStream.lastErr = e;
            if (ytdlpStream.weKilled) return;
            console.error ('[music] yt-dlp завершился: ' + ytDlpErr (e));
        });
    let ff = null, input = ytdlpStream.stdout, raw = false;
    if (musicNormalizeReady || seekInFfmpeg)
    {
        try
        {
            const args = ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0'];
            if (seekInFfmpeg) args.push ('-ss', String (Math.max (0, Math.floor (seekSec))));
            if (musicNormalizeReady) args.push ('-af', MUSIC_NORMALIZE_FILTER);
            args.push ('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
            ff = spawn (ffmpegPath, args, { windowsHide: true });
        }
        catch (e)
        {
            console.error ('[music] ffmpeg не поднялся: ' + oneLine (e.message) + ' -- играю без него');
            ff = null;
        }
        if (ff)
        {
            ytdlpStream.stdout.on ('error', () => {});
            ff.stdin.on ('error', () => {});
            ff.stdout.on ('error', () => {});
            ytdlpStream.stdout.pipe (ff.stdin);
            let ffErr = '';
            ff.stderr.on ('data', d => { ffErr += String (d); });
            ff.on ('error', () => {});
            const ffNoiseIfGone = () => isGoneError (ytdlpStream.lastErr);
            ff.on ('close', code =>
            {
                if (code === 0 || code === null) return;
                if (ff.weKilled) return;
                if (ffNoiseIfGone ()) return;
                console.error ('[' + (d()) + '] [music] выравнивание громкости оборвалось: код ' + exitCodeText (code) +
                    (ffErr.trim () ? ' -- ' + ytDlpErr ({ stderr: ffErr }, 160) : '') +
                    ' -- обычно это НЕ про громкость: так обрывается сам поток (ffmpeg у нас последний' +
                    ' в цепочке yt-dlp -> ffmpeg, поэтому ругается он). Трек не бросаю: пробую продолжить' +
                    ' его с той же секунды, и только если не выйдет -- иду к следующему. Ниже об этом' +
                    ' будет сказано прямо: «поток оборвался ... -- продолжаю тот же трек, попытка N/3».');
            });
            input = ff.stdout;
            raw = true;
        }
    }
    let tee = null;
    if (!seek && !seekInFfmpeg && !track.isLive && MUSIC_CACHE && !longSetCached (track))
    {
        tee = cacheTeeStart (track);
        if (tee)
        {
            ytdlpStream.stdout.pipe (tee.ws);
            ytdlpStream.then (() => { if (ytdlpStream.weKilled) tee.abort (); else tee.finalize (); },
                              () => tee.abort ());
        }
    }
    const resource = createAudioResource
    (
        input,
        {
            inputType: raw ? StreamType.Raw : StreamType.Arbitrary,
            inlineVolume: true,
        }
    );
    if (resource.volume)
        resource.volume.setVolume (MUSIC_VOLUME);
    return { resource, viaProxy, source: ytdlpStream.stdout, proc: ytdlpStream, ff: ff, tee: tee,
             sectionProxy: seekProxy,
             seeked: (seekMode === 'sections' && seek) || (seekMode === 'ffseek' && !!ff) };
}

function authorVoiceId (guildId, track)
{
    if (!track || !track.byId) return null;
    const guild = client.guilds.cache.get (guildId);
    if (!guild || !guild.voiceStates) return null;
    if (client.user && track.byId === client.user.id) return null;
    const vs = guild.voiceStates.cache.get (track.byId);
    const chId = vs ? (vs.channelId || (vs.channel && vs.channel.id) || null) : null;
    if (!chId) return null;
    const ch = client.channels.cache.get (chId) ||
        (guild.channels && guild.channels.cache ? guild.channels.cache.get (chId) : null);
    if (!ch) return null;
    if (typeof ch.isVoiceBased === 'function' && !ch.isVoiceBased ()) return null;
    return ch.id;
}

function pickAuthorChannel (guildId, curChId)
{
    const m = $music[guildId];
    if (!m) return null;
    const cand = [];
    if (m.current) cand.push (m.current);
    for (const t of (m.tracks || []))
    {
        if (t !== m.current) cand.push (t);
        if (cand.length > 500) break;
    }
    for (const t of cand)
    {
        const aCh = authorVoiceId (guildId, t);
        if (!aCh || aCh === curChId) continue;
        const ch = client.channels.cache.get (aCh);
        if (ch) return { ch: ch, track: t };
    }
    return null;
}

function followTrackAuthor (guildId, track)
{
    const m = musicOf (guildId);
    if (!m.connection) return null;
    if (m.leaving) return null;
    if (Date.now () - (m.justJoinedAt || 0) < 5000) return null;
    const chId = authorVoiceId (guildId, track);
    if (!chId) return null;
    if (m.connection.joinConfig && m.connection.joinConfig.channelId === chId) return null;
    const here = m.connection.joinConfig ? m.connection.joinConfig.channelId : null;
    if (here)
    {
        const g0 = client.guilds.cache.get (guildId);
        let others = 0;
        if (g0)
            for (const vs of g0.voiceStates.cache.values ())
                if (vs.channelId === here && vs.id !== (client.user && client.user.id) &&
                    String (vs.id) !== String (track.byId || '') && !voiceIsBot (g0, vs)) others++;
        if (others > 0)
        {
            const hereCh = client.channels.cache.get (here);
            console.log ('[' + (d()) + '] [music] остаюсь в «' + (hereCh ? hereCh.name : here) + '»: там ещё ' + others +
                ' ' + plural (others, 'слушатель', 'слушателя', 'слушателей') + ', а автор трека (' +
                (track.byName || track.byId) + ') слушает в другой комнате -- уйду, когда они уйдут (или по /join)');
            return null;
        }
    }
    const guild = client.guilds.cache.get (guildId);
    const ch = client.channels.cache.get (chId) ||
        (guild && guild.channels && guild.channels.cache ? guild.channels.cache.get (chId) : null);
    if (!ch) return null;
    const who = track.byName || '<@' + track.byId + '>';
    try
    {
        joinVoice (guildId, ch, guild, 'автор трека ' + who + ' слушает здесь');
        m.savedChannelId = ch.id;
        if (ch.type === ChannelType.GuildStageVoice)
            console.log ('[' + (d()) + '] [music] «' + ch.name + '» -- Stage-канал: чтобы музыку было слышно, ' +
                'Stage Moderator должен сделать бота спикером');
        return ch.name;
    }
    catch (e)
    {
        console.error ('[music] к автору трека не переехал: ' + oneLine (e.message));
        return null;
    }
}

function streamEndedEarly (track, at, startedAt = 0)
{
    if (!track) return false;
    if (!track.isLive && Number (track.duration) > 0)
        return at < Number (track.duration) - 5;
    const from = Number (startedAt) > 0 ? Number (startedAt) : 0;
    return at < from + 20;
}

function earlyEndResumeFrom (at, startedFromSeek, fromPart, startedAtSec)
{
    const sec = Math.max (0, Math.round (Number (at) || 0));
    if (fromPart) return sec;
    return (startedFromSeek && sec < (Number (startedAtSec) || 0) + 15) ? 0 : sec;
}

function musicNetStall (guildId, track, at, e)
{
    const m = $music[guildId];
    if (!m) return false;
    const why = ytDlpErr (e, 140);
    const pos = Math.max (0, Math.round (Number (at) || 0));
    if (track)
    {
        track.seek = pos;
        m.current = null;
        m.tracks.unshift (track);
        m.seekTrack = track;
        m.seekSec = pos;
        m.playedMs = pos * 1000;
        m.playingSince = null;
        m.startedAtSec = pos;
    }
    m.streamRetries = 0;
    m.playFailStreak = 0;
    const w = m.netWait || (m.netWait = { tries: 0, at: 0, lastWhy: '' });
    w.tries++;
    w.at = Date.now ();
    w.lastWhy = why;
    if (w.tries === 1) netOutageStart (guildId);      // счёт обрывов: начало
    else netOutageAttempt (guildId, w.tries);
    if (w.tries === 3) dpiSelfHeal ('музыка не может подняться: сеть не отвечает');   // пути не работают на самом деле
    w.nextAt = Date.now () + Math.min (NET_WAIT_MAX_MS,
        NET_WAIT_MS * Math.pow (2, Math.min (3, Math.max (0, w.tries - 1))));
    const chId = m.connection ? m.connection.joinConfig.channelId : m.savedChannelId;
    const heard = !!(chId && humansInChannel (guildId, chId) > 0);
    if (w.tries === 1)
        console.error ('[' + (d()) + '] [music] сеть/прокси не отвечает (' + why + ') -- ' +
            (track ? 'держу «' + (track.title || 'трек') + '»' + (pos ? ' на ' + fmtDur (pos) : '') + ' и ' : '') +
            'очередь не трогаю: пробую снова, как только связь вернётся' +
            (heard ? '' : ' (слушателей нет -- молчу, пока кто-нибудь не зайдёт)') +
            (dnsCache.ok === false ? ' [DIRECT не пробую: youtube.com локально не резолвится]'
                : (directProbeCache.ok === false ? ' [и прямой путь не отвечает: ' +
                    (directProbeCache.why || 'нет ответа') + ' -- проверь обход блокировки (zapret/VPN) или прокси]' : '')));
    else if (w.tries <= 3 || (w.tries % 5) === 0)
        console.error ('[' + (d()) + '] [music] сеть всё ещё не отвечает (попытка ' + w.tries + '): ' + why +
            ' -- музыка пойдёт сама, как только маршрут оживёт');
    const _copy = track ? cachePlayFrom (track, pos) : null;
    m.seekLoose = !!(_copy && _copy.loose);
    if (_copy && w.tries === 1)
        console.log ('[' + (d()) + '] [music] у меня есть ' + _copy.what +
            ' -- наружу не прошу: трек продолжу со своей копии, YouTube для этого не нужен');
    if (heard && w.tries === 1)
        outageDown (guildId, track, pos);
    if (!heard || !m.connection)
        m.pending = true;
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    saveMusicState (guildId);
    return true;
}

async function playNext (guildId)
{
    const m = musicOf (guildId);
    if (m.leaving) return;
    killStream (m.streamHandle);
    m.streamHandle = null;
    if (!m.tracks.length)
    {
        m.current = null;
        m.playedMs = 0;
        m.playingSince = null;
        m.streamRetries = 0;
        m.pausedByNobody = false;
        if (m.playedToSomeone)
        {
            console.log ('[' + (d()) + '] [music] очередь доиграна до конца -- вычеркиваю её из памяти');
            m.playedToSomeone = false;
            await clearMusicState (guildId);
        }
        scheduleVoiceStatus (guildId);
        schedulePresence ();
        return;
    }
    while (m.tracks.length && m.tracks[0] && m.tracks[0].gone)
    {
        const dead = m.tracks.shift ();
        deadDropNote (guildId);
        console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (проверено предзагрузкой): ' +
            (dead.title || 'трек') + ' -- убрал из очереди' +
            (dead.warn ? ' (этот трек проверка заранее помечала подозрительным)' : ''));
        if (!dead.goneTold)
            trackNotice (guildId, dead, '🗑 **' + (dead.title || 'Трек') + '** -- видео больше нет на YouTube, убрал из очереди.');
    }
    while (m.tracks.length && !m.tracks[0]) { m.tracks.shift (); console.error ('[' + (d()) + '] [music] в очереди была пустая запись -- убрал'); }
    if (!m.tracks.length) return playNext (guildId);
    if (m.seekTrack !== m.tracks[0]) m.streamRetries = 0;
    let track = m.tracks.shift ();
    m.current = track;
    followTrackAuthor (guildId, track);
    const fromPreload = !!(m.preload && m.preload.track === track);
    const fromDisk = !!(MUSIC_CACHE && !track.isLive && cacheFind (track));
    const seekFrom = (m.seekTrack === track && (m.seekSec || 0) >= 1) ? Math.round (m.seekSec) : 0;
    console.log ('[' + (d()) + '] [music] играю: ' + (track.title || track.url || 'трек') +
        (seekFrom ? ' (продолжаю с ' + fmtDur (seekFrom) + ')'
                  : (fromDisk ? ' (с диска: своя копия)' : (fromPreload ? ' (из предзагрузки, без паузы)' : ''))));
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    try
    {
        let resource = null, viaProxy = false, handle = null;
        let startedAt = 0;
        let fromPart = false, partFile = null;
        let playedFromDisk = false;
        let _loose = !!m.seekLoose;
        const p = m.preload;
        if (p && p.track === track && !(track.gone && p.proc && p.proc.lastErr))
        {
            m.preload = null;
            const r = await p.promise;
            if (r)
            {
                resource = r.resource; viaProxy = r.viaProxy;
                playedFromDisk = !!(r.fromCache || r.fromPart);
                handle = { resource: r.resource, source: p.source, proc: p.proc, ff: p.ff, tee: p.tee };
                if (resource) routeUseSet (guildId, r.viaProxy, (r.fromCache || r.fromPart) ? 'disk' : 'stream');
            }
        }
        else
        {
            dropPreload (m);
        }
        if (!resource)
        {
            let seekSec = (m.seekTrack === track) ? (m.seekSec || 0) : (track.seek || 0);
            if (track.isLive) seekSec = 0;
            const _diskNow = (MUSIC_CACHE && !track.isLive) ? cachePlayFrom (track, seekSec) : null;
            if (_diskNow)
            {
                m.seekLoose = !!_diskNow.loose;
                _loose = !!m.seekLoose;
                if (_diskNow.loose || m.netWait)
                    console.log ('[' + (d()) + '] [music] качать не буду: у меня уже есть ' + _diskNow.what +
                        ' -- играю с диска, YouTube для этого не нужен');
            }
            else if (m.fill && m.fill.track === track && !m.fill.cancelled)
            {
                // этот трек уже догружается заранее -- второй раз не качаю
                console.log ('[' + (d()) + '] [music] эту копию уже догружаю вперёд -- играю потоком, а файл догрузится сам: ' +
                    (track.title || 'трек'));
            }
            else if (MUSIC_CACHE && !track.isLive && Number (track.duration) > 0 &&
                Number (track.duration) <= MUSIC_CACHE_SHORT_MAX_SEC)
            {
                try
                {
                    console.log ('[' + (d()) + '] [music] качаю на диск: ' + (track.title || 'трек'));
                    await cacheDownload (track);
                }
                catch (e)
                {
                    if (isGoneError (e))
                        console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (' + (track.title || 'трек') +
                            ') -- запускать поток бессмысленно: ' + ytDlpErr (e, 120));
                    else
                        console.error ('[' + (d()) + '] [music] на диск не легло (' + (track.title || 'трек') +
                            '): ' + ytDlpErr (e, 150) + ' -- беру потоком');
                }
            }
            const _noSec = (m.seekNoSections || []).includes (track.url);
            const _trySections = seekSec >= 1 && seekSec > SEEK_FFSEEK_MAX && !_noSec;
            let opened = await createTrackStream (track, seekSec, _trySections ? 'sections' : (seekSec >= 1 ? 'ffseek' : 'none'), _loose);
            if (_trySections && !opened.fromCache)
            {
                const _waitMs = seekSectionWait (opened);
                const _ok = opened.seeked && !(await failedFast (opened.proc)) &&
                    await streamFirstData (opened.source, opened.proc, _waitMs);
                if (!_ok)
                {
                    m.seekNoSections = [...(m.seekNoSections || []), track.url].slice (-20);
                }
                if (!_ok)
                {
                    killStream (opened);
                    console.error ('[' + (d()) + '] [music] секция с ' + fmtDur (seekSec) +
                        ' ничего не отдала за ' + Math.round (_waitMs / 1000) + ' с' +
                        sectionProxyWhy (opened.sectionProxy) + ' -- беру тот же трек через ffmpeg');
                    opened = await createTrackStream (track, seekSec, 'ffseek', _loose);
                }
            }
            if (seekSec >= 1 && (!opened.seeked || await failedFast (opened.proc)))
            {
                killStream (opened);
                const back = (m.seekTrack === track) ? Math.max (0, Math.round (m.seekReturnSec || 0)) : 0;
                m.seekReturnSec = 0;
                if (back >= 1)
                {
                    console.error ('[' + (d()) + '] [music] перемотка на ' + fmtDur (seekSec) + ' не удалась ' +
                        '(источник не умеет навигацию) -- продолжаю с ' + fmtDur (back) + ', как и играло');
                    musicNotice (guildId, '⚠️ **' + (track.title || 'Трек') + '** -- источник не умеет навигацию, ' +
                        'перемотка не вышла. Продолжаю с `' + fmtDur (back) + '` (где и играло).');
                    opened = await createTrackStream (track, back, 'ffseek', _loose);
                }
                else
                {
                    console.error ('[' + (d()) + '] [music] продолжение с ' + fmtDur (seekSec) + ' не удалось -- беру трек с начала');
                    opened = await createTrackStream (track, 0, 'none');
                }
                seekSec = back;
            }
            m.seekReturnSec = 0;
            resource = opened.resource;
            playedFromDisk = !!(opened.fromCache || opened.fromPart);
            routeUseSet (guildId, opened.viaProxy, playedFromDisk ? 'disk' : 'stream');
            viaProxy = opened.viaProxy;
            handle = { resource: opened.resource, source: opened.source, proc: opened.proc, ff: opened.ff };
            startedAt = seekSec;
            fromPart = !!opened.fromPart;
            partFile = opened.partFile || null;
        }
        if (m.seekTrack && m.seekTrack !== track && m.seekSec) m.seekTrack.seek = m.seekSec;
        m.seekTrack = null;
        m.seekSec = 0;
        if (track.seek) track.seek = 0;
        m.playedMs = startedAt * 1000;
        m.playingSince = Date.now ();
        m.startedAtSec = startedAt;
        m.startedFromSeek = startedAt >= 1;
        m.partFile = partFile;
        m.pausedByNobody = false;
        wireStreamErrors (m, track, resource, viaProxy, guildId);
        m.streamHandle = handle;
        m.player.play (resource);
        m.playFailStreak = 0;
        m.seekLoose = false;
        if (m.netWait)
        {
            const _w = m.netWait;
            m.netWait = null;
            netOutageFinish (guildId, playedFromDisk);   // счёт обрывов: музыка поднялась сама
            console.log (playedFromDisk
                ? '[' + (d()) + '] [music] связи нет, но музыка идёт ИЗ СВОЕЙ КОПИИ (YouTube для неё не нужен)' +
                  ' -- очередь не стоит' + (startedAt ? '; продолжаю с ' + fmtDur (startedAt) : '')
                : '[' + (d()) + '] [music] сеть вернулась (попыток: ' + _w.tries +
                  ') -- музыка снова идёт' + (startedAt ? ' (с ' + fmtDur (startedAt) + ')' : ''));
        }
        if (m.netDownToldAt)
        {
            m.netDownToldAt = 0;
            musicNotice (guildId, outageUpText (track, startedAt, false, playedFromDisk));
        }
        if (track.warn)
        {
            console.log ('[' + (d()) + '] [music] проверка очереди: трек заиграл -- снимаю пометку «под вопросом» (' +
                (track.title || 'трек') + ')');
            track.warn = '';
            track.warnAt = 0;
        }
        if (m.longDl && m.longDl.track !== track) cancelLongDownload (m);
        if (!fromPart) startLongDownload (guildId, track);
        startPreload (guildId);
        cacheDropUnused ();
        const chId = m.connection ? m.connection.joinConfig.channelId : null;
        if (chId && humansInChannel (guildId, chId)) m.playedToSomeone = true;
        saveMusicState (guildId);
        checkListeners (guildId);
    }
    catch (e)
    {
        const _at = (m.seekTrack === track) ? (m.seekSec || 0) : (track.seek || 0);
        if (isRouteError (e) && musicNetStall (guildId, track, _at, e))
            return;
        console.error ('[' + (d()) + '] [music] трек не заиграл: ' + (track.title || track.url || 'трек') +
            ' -- ' + oneLine (e.message) + ' (беру следующий)');
        ytdlpNoteFail (oneLine (ytDlpErr (e, 120)));
        m.current = null;
        deadDropNote (guildId);
        {
            const _why = isGoneError (e) ? 'видео больше нет на YouTube' : ytDlpErr (e, 160);
            trackNotice (guildId, track, (isGoneError (e) ? '🗑 **' : '⚠️ **') + (track.title || 'Трек') +
                '** -- ' + (isGoneError (e) ? 'видео больше нет на YouTube: убрал из очереди.'
                    : 'не запустился, пропускаю.' + (_why ? ' Причина: ' + _why : '')));
        }
        m.playFailStreak = (m.playFailStreak || 0) + 1;
        if (m.playFailStreak >= 10)
        {
            console.error ('[' + (d()) + '] [music] ' + m.playFailStreak + ' треков подряд не заиграли -- ' +
                'останавливаюсь, чтобы не крутиться без конца (очередь помню, проверь лог выше)');
            m.playFailStreak = 0;
            return;
        }
        playNext (guildId);
    }
}

function dropPreload (m)
{
    const p = m && m.preload;
    if (!p) return;
    m.preload = null;
    p.cancelled = true;
    try { if (p.dlStop) p.dlStop (); } catch {}
    killStream ({ resource: p.resource, source: p.source, proc: p.proc, ff: p.ff, tee: p.tee });
}

function killStream (r)
{
    if (!r) return;
    try { if (r.proc) r.proc.weKilled = true; } catch {}
    try { if (r.ff) r.ff.weKilled = true; } catch {}
    try { if (r.resource) r.resource.playStream.destroy (); } catch {}
    try { if (r.source) r.source.destroy (); } catch {}
    try { if (r.tee) r.tee.abort (); } catch {}
    try { if (r.proc && typeof r.proc.kill === 'function') r.proc.kill (); } catch {}
    try { if (r.ff) { r.ff.stdin.destroy (); r.ff.stdout.destroy (); r.ff.kill (); } } catch {}
}

const PRELOAD_TRIES = 3;
const PRELOAD_RETRY_MS = 5000;
const sleep = ms => new Promise (r => setTimeout (r, ms));

async function preloadRetry (fn, p, next)
{
    let lastErr = null;
    for (let i = 1; i <= PRELOAD_TRIES; i++)
    {
        if (p.cancelled) return null;
        try { return await fn (); }
        catch (e) { lastErr = e; }
        if (p.cancelled) return null;
        if (isGoneError (lastErr)) throw lastErr;
        if (i < PRELOAD_TRIES)
        {
            console.log ('[' + (d()) + '] [music] предзагрузка не вышла (попытка ' + i + '/' + PRELOAD_TRIES + ', ' +
                (next.title || 'трек') + '): ' + ytDlpErr (lastErr, 120) + ' -- пробую ещё раз через ' +
                Math.round (PRELOAD_RETRY_MS / 1000) + ' с');
            await sleep (PRELOAD_RETRY_MS);
        }
    }
    throw lastErr;
}

function startPreload (guildId)
{
    const m = musicOf (guildId);
    const next = m.tracks[0];
    if (!next) { dropPreload (m); return; }
    if (m.preload && m.preload.track === next) return;
    dropPreload (m);
    if (longSetCached (next))
    {
        if (m.longDl && m.longDl.track !== next && m.longDl.track !== m.current) cancelLongDownload (m);
        startLongDownload (guildId, next, 'заранее: пока играет текущий трек -- к началу сета файл уже на диске');
    }
    if (m.fill && m.fill.track === next)
    {
        // уже догружается вперёд: второй запрос на тот же трек не запускаю
        console.log ('[' + (d()) + '] [music] предзагрузку не делаю: этот трек уже догружается на диск вперёд (' +
            (next.title || 'трек') + ')');
        return;
    }
    if (MUSIC_CACHE && !next.isLive && next.duration > 0 && next.duration <= MUSIC_CACHE_SHORT_MAX_SEC && !cacheFind (next))
    {
        const cp = { track: next, resource: null, viaProxy: false, cancelled: false, cacheOnly: true };
        const holder = {};
        cp.dlStop = () => holder.stop && holder.stop ();
        m.preload = cp;
        cp.promise = (async () =>
        {
            let lastErr = null;
            for (let i = 1; i <= PRELOAD_TRIES; i++)
            {
                if (cp.cancelled) return null;
                try
                {
                    const file = await cacheDownload (next, holder);
                    if (file)
                    {
                        console.log ('[' + (d()) + '] [music] предзагрузка готова (уже на диске): ' + (next.title || 'трек') +
                            (i > 1 ? ' -- со попытки ' + i : ''));
                        return { resource: null, viaProxy: false, fromCache: true };
                    }
                    lastErr = new Error ('файл на диск не лёг');
                }
                catch (e) { lastErr = e; }
                if (cp.cancelled) return null;
                if (isGoneError (lastErr))
                {
                    next.gone = true;
                    console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (' + (next.title || 'трек') +
                        ') -- уберу его из очереди, когда дойдёт; очередь не трогаю: ' + ytDlpErr (lastErr, 120));
                    return null;
                }
                if (i < PRELOAD_TRIES)
                {
                    console.log ('[' + (d()) + '] [music] предзагрузка не вышла (попытка ' + i + '/' + PRELOAD_TRIES + ', ' +
                        (next.title || 'трек') + '): ' + ytDlpErr (lastErr, 120) + ' -- пробую ещё раз через ' +
                        Math.round (PRELOAD_RETRY_MS / 1000) + ' с');
                    await sleep (PRELOAD_RETRY_MS);
                }
            }
            console.error ('[music] предзагрузка не удалась (' + (next.title || 'трек') + '): ' + ytDlpErr (lastErr) +
                (isRouteError (lastErr) ? ' -- сеть/прокси, трек не потерян: подключусь к нему заново, когда маршрут оживёт' : ''));
            return null;
        })();
        return;
    }
    const p = { track: next, resource: null, viaProxy: false, cancelled: false };
    m.preload = p;
    p.promise = preloadRetry (() => createTrackStream (next), p, next).then
    (
        r =>
        {
            if (p.cancelled || !r)
            {
                if (r) killStream (r);
                return null;
            }
            p.resource = r.resource;
            p.viaProxy = r.viaProxy;
            p.source = r.source;
            p.proc = r.proc;
            p.ff = r.ff;
            p.tee = r.tee;
            if (r.proc && typeof r.proc.catch === 'function')
                r.proc.catch (e =>
                {
                    if (!isGoneError (e) || next.gone) return;
                    next.gone = true;
                    console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (' + (next.title || 'трек') +
                        ') -- уберу из очереди, когда дойдёт; очередь не трогаю: ' + ytDlpErr (e, 120));
                });
            wireStreamErrors (m, next, r.resource, r.viaProxy, guildId);
            console.log ('[' + (d()) + '] [music] предзагрузка готова (следующий): ' + (next.title || 'трек'));
            return r;
        },
        e =>
        {
            p.cancelled = true;
            if (isGoneError (e))
            {
                next.gone = true;
                console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (' + (next.title || 'трек') +
                    ') -- уберу его из очереди, когда дойдёт; очередь не трогаю: ' + ytDlpErr (e, 120));
                next.goneTold = true;
                trackNotice (guildId, next, '🗑 **' + (next.title || 'Трек') + '** -- видео больше нет на YouTube: ' +
                    'уберу из очереди, когда дойдёт. Поставь другой трек, если он нужен.');
                return null;
            }
            console.error ('[music] предзагрузка не удалась (' + (next.title || 'трек') + '): ' + ytDlpErr (e) +
                (isRouteError (e) ? ' -- сеть/прокси, трек не потерян: подключусь к нему заново, когда маршрут оживёт' : ''));
            return null;
        }
    );
}

function wireStreamErrors (m, track, resource, viaProxy, guildId)
{
    if (resource.__errWired) return;
    resource.__errWired = true;
    resource.playStream.once ('error', e =>
    {
        const playing = m.current === track;
        if (viaProxy && isNetworkError (e)) proxyMarkBad (viaProxy);
        if (!playing)
        {
            console.error ('[music] обрыв потока (предзагрузка): ' + oneLine (e.message));
            if (m.preload && m.preload.track === track) m.preload = null;
            return;
        }
        if (isGoneError (e))
        {
            console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (' + (track.title || 'трек') +
                ') -- убираю из очереди: ' + ytDlpErr (e, 120));
            deadDropNote (guildId);
            trackNotice (guildId, track, '🗑 **' + (track.title || 'Трек') + '** -- видео больше нет на YouTube, убираю из очереди.');
            m.current = null;
            m.playedMs = 0;
            m.playingSince = null;
            m.streamRetries = 0;
            try { m.player.stop (true); } catch {}
            return;
        }
        if (isRouteError (e) && musicNetStall (guildId, track, Math.round (playedMsOf (m) / 1000), e))
        {
            m.player.stop (true);
            return;
        }
        const at = Math.round (playedMsOf (m) / 1000);
        if (at > (m.lastErrorAt || 0) + 30) m.streamRetries = 0;
        m.lastErrorAt = at;
        const attempt = (m.streamRetries || 0) + 1;
        if (attempt <= MUSIC_STREAM_RETRIES)
        {
            m.streamRetries = attempt;
            m.playedMs = at * 1000;
            m.playingSince = null;
            m.current = null;
            m.tracks.unshift (track);
            m.seekTrack = track;
            m.seekSec = at;
            console.error ('[music] поток оборвался (' + (at ? 'на ' + fmtDur (at) : 'в самом начале') +
                ', ' + oneLine (e.message) + ') -- продолжаю тот же трек, попытка ' + attempt + '/' + MUSIC_STREAM_RETRIES);
            saveMusicState (guildId);
            m.player.stop (true);
            return;
        }
        if (isNetworkError (e) && !isGoneError (e) && musicNetStall (guildId, track, at, e))
        {
            m.player.stop (true);
            return;
        }
        console.error ('[music] поток обрывается снова (' + attempt + ' раз) -- пропускаю: ' + (track.title || 'трек'));
        m.streamRetries = 0;
        m.current = null;
        const _why = ytDlpErr (e, 160);
        trackNotice (guildId, track, '⚠️ **' + (track.title || 'Трек') + '** -- не удалось воспроизвести, пропускаю.' +
            (_why ? ' Причина: ' + _why : ''));
        m.player.stop (true);
    });
}

const VOICE_STATUS_MIN_GAP_MS = 3000;
const musicRest = new REST ({ version: '10' }).setToken (TOKEN);
const $voiceStatus = {};

function fmtAgo (ms)
{
    let s = Math.max (0, Math.round (ms / 1000));
    let h = s / 3600 | 0, mi = (s % 3600) / 60 | 0;
    if (h) return h + ' ч ' + mi + ' мин';
    if (mi) return mi + ' мин';
    return s + ' сек';
}

function hhmm (ms)
{
    const dt = new Date (Number (ms) || 0);
    return pad (dt.getHours ()) + ':' + pad (dt.getMinutes ());
}

function voiceIsBot (guild, vs)
{
    if (vs.member && vs.member.user) return !!vs.member.user.bot;
    const mem = guild.members.cache.get (vs.id);
    if (mem && mem.user) return !!mem.user.bot;
    const usr = client.users.cache.get (vs.id);
    return usr ? !!usr.bot : false;
}

function humansInChannel (guildId, channelId)
{
    const guild = client.guilds.cache.get (guildId);
    if (!guild || !channelId) return 0;
    const selfId = client.user ? client.user.id : null;
    let n = 0;
    for (const vs of guild.voiceStates.cache.values ())
        if (vs.channelId === channelId && vs.id !== selfId && !voiceIsBot (guild, vs)) n++;
    return n;
}

async function humansInChannelChecked (guildId, channelId)
{
    const guild = client.guilds.cache.get (guildId);
    if (!guild || !channelId) return 0;
    const selfId = client.user ? client.user.id : null;
    let n = 0;
    for (const vs of guild.voiceStates.cache.values ())
    {
        if (vs.channelId !== channelId || vs.id === selfId) continue;
        if (vs.member && vs.member.user) { if (!vs.member.user.bot) n++; continue; }
        const mem = guild.members.cache.get (vs.id) ||
            (typeof guild.members.fetch === 'function'
                ? await guild.members.fetch (vs.id).catch (() => null) : null);
        if (mem && mem.user) { if (!mem.user.bot) n++; continue; }
        n++;
    }
    return n;
}

function clipText (s, max)
{
    s = String (s);
    max = Math.max (4, max | 0);
    return s.length <= max ? s : s.slice (0, max - 1) + '…';
}

function voiceStatusText (guildId)
{
    const m = $music[guildId];
    if (!m || !m.connection) return null;
    const chId = m.connection.joinConfig.channelId;
    const people = humansInChannel (guildId, chId);
    let parts = [];
    if (m.pausedByNobody && m.current)
        parts.push ('😴 нет слушателей: ' + (m.current.title || 'трек') +
            (m.current.isLive ? '' : ' — ' + fmtDur (m.current.duration)));
    else
        parts.push (nowPlayingLine (m.current, m.player.state.status === AudioPlayerStatus.Paused) ||
            '😴 музыка не играет');
    parts.push ('📜 очередь: ' + (m.tracks.length ? m.tracks.length : '—'));
    parts.push ('🎧 в канале: ' + people);
    if (m.since) parts.push ('⏱ бот тут: ' + fmtAgo (Date.now () - m.since));
    return parts.join (' • ').slice (0, 500);
}

const $statusChain = {};

function voiceStatusPush (channelId, status)
{
    if (!channelId) return Promise.resolve ();
    const prev = $statusChain[channelId] || Promise.resolve ();
    const next = prev
        .catch (() => {})
        .then (() => musicRest.put (Routes.channelVoiceStatus (channelId), { body: { status: status } }))
        .catch (e =>
        {
            console.error ('[' + (d()) + '] [music] статус канала не ' +
                (status === null ? 'снялся: ' : 'записался: ') + e.message);
            throw e;
        });
    next.catch (() => {}).then
    (
        () => { if ($statusChain[channelId] === next) delete $statusChain[channelId]; }
    );
    $statusChain[channelId] = next;
    return next;
}

function clearVoiceStatus (channelId)
{
    if (!MUSIC_CHANNEL_STATUS) return;
    if (!channelId) return;
    voiceStatusPush (channelId, null).catch (() => {});
}

async function writeVoiceStatus (guildId)
{
    const st = $voiceStatus[guildId] = $voiceStatus[guildId] || {};
    const text = voiceStatusText (guildId);
    if (text === null)
    {
        const old = st.channelId;
        st.text = null;
        st.channelId = null;
        clearVoiceStatus (old);
        return;
    }
    const channelId = $music[guildId].connection.joinConfig.channelId;
    if (st.text === text && st.channelId === channelId) return;
    const prev = { text: st.text, channelId: st.channelId };
    st.text = text;
    st.channelId = channelId;
    st.last = Date.now ();
    try
    {
        await voiceStatusPush (channelId, text);
    }
    catch (e)
    {
        console.error ('[' + (d()) + '] [music] статус канала не записался: ' + e.message);
        st.text = prev.text;
        st.channelId = prev.channelId;
    }
}

function scheduleVoiceStatus (guildId, immediate = false)
{
    if (!MUSIC_CHANNEL_STATUS) return;
    if (!guildId || !(guildId in SERVERS)) return;
    if (!$music[guildId] || !$music[guildId].connection) return;
    const st = $voiceStatus[guildId] = $voiceStatus[guildId] || {};
    if (st.timer) return;
    const wait = immediate ? Math.max (VOICE_STATUS_MIN_GAP_MS - (Date.now () - (st.last || 0)), 0) : VOICE_STATUS_MIN_GAP_MS;
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

if (/^clearstatus$/i.test (String (process.argv[2] || '')))
{
    const _ch = String (process.argv[3] || '').trim ();
    if (!/^\d{17,20}$/.test (_ch))
    {
        console.log ('[clearstatus] укажи id голосового канала:  node . clearstatus <id канала>\n' +
            '[clearstatus] id виден при включённом режиме разработчика (ПКМ по каналу -> «Копировать ID»),\n' +
            '[clearstatus] либо его печатает  node . dump  (строка musicState)');
        process.exit (1);
    }
    voiceStatusPush (_ch, null)
        .then (() => { console.log ('[clearstatus] статус (шапка) канала ' + _ch + ' снят'); $cliDone (0); })
        .catch (e => { console.error ('[clearstatus] не получилось: ' + oneLine (e && e.message || e)); $cliDone (1); });
}

async function loginWithIntentFallback ()
{
    if (USE_MESSAGE_CONTENT && client.options.intents.has (GatewayIntentBits.MessageContent) && !(await messageContentAllowed ()))
        dropIntent (GatewayIntentBits.MessageContent);
    if (USE_GUILD_MEMBERS && client.options.intents.has (GatewayIntentBits.GuildMembers) && !(await guildMembersAllowed ()))
        dropIntent (GatewayIntentBits.GuildMembers);
    const PRIV = [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers];
    for (let attempt = 0; attempt <= PRIV.length; attempt++)
    {
        try { await client.login (TOKEN); return ''; }
        catch (e)
        {
            const msg = String ((e && e.message) || e);
            const drop = /disallowed intent/i.test (msg) ? PRIV.find (i => client.options.intents.has (i)) : null;
            if (!drop) return msg;
            dropIntent (drop);
            console.error ('[' + (d()) + '] [voice] Discord не даёт разрешение «' + (INTENT_NAMES.get (drop) || 'привилегированное') +
                '» -- вхожу без него (на голосовой канал это не влияет)');
        }
    }
    return 'не смог войти в Discord даже без привилегированных разрешений';
}

const VOICE_CHECK_LOGIN_S = 30;
const VOICE_CHECK_MS = 25000;
if (/^voice$/i.test (String (process.argv[2] || '')))
{
    const _want = String (process.argv[3] || '').trim ();
    const _fin = (_code, _msg) =>
    {
        if (_msg) console.log ('[voice] ' + _msg);
        try { botLockRelease (); } catch (e) { }
        $cliDone (_code);
    };
    const _busy = botAlreadyRunning ();
    if (_busy && /уже запущен/.test (_busy)) _fin (1, _busy);
    else (async () =>
    {
        let _chId = _want;
        if (!_chId)
        {
            for (const _when of ['заходил', 'любой'])
            {
                for (const _g of Object.keys (SERVERS))
                {
                    const _v = await readVoiceState (_g);
                    if (!_v || !_v.channelId) continue;
                    if (_when === 'заходил' && _v.leftByUser) continue;
                    _chId = String (_v.channelId);
                    break;
                }
                if (_chId) break;
            }
        }
        if (!/^\d{17,20}$/.test (_chId))
        {
            return _fin (1, 'укажи голосовой канал:  node . voice <id канала>\n' +
                '[voice] id виден при включённом режиме разработчика (ПКМ по каналу -> «Копировать ID»),\n' +
                '[voice] либо он уже записан в базе (музыка туда заходила) -- тогда просто:  node . voice');
        }
        const _t0 = Date.now ();
        let _why = '';
        const _ready = new Promise (res =>
        {
            const _gr = () => { clearTimeout (_tm); clearInterval (_iv); res (''); };
            const _tm = setTimeout (() => { clearInterval (_iv); res ('не дождался входа в Discord за ' + VOICE_CHECK_LOGIN_S + ' с'); },
                VOICE_CHECK_LOGIN_S * 1000);
            const _iv = setInterval (() => { if (client.isReady && client.isReady ()) _gr (); }, 300);
            client.once ('clientReady', _gr);
            client.once ('ready', _gr);
        });
        _why = await loginWithIntentFallback ();
        const _r = await _ready;
        if (_why || _r)
            return _fin (1, 'не смог войти в Discord: ' + (_why || _r) + ' -- команды до бота не дойдут');
        console.log ('[voice] вошёл как ' + ((client.user && client.user.tag) ? client.user.tag : 'бот'));
        let _ch = null;
        try { _ch = await client.channels.fetch (_chId); }
        catch (e) { return _fin (1, 'канал ' + _chId + ' не нашёл: ' + oneLine ((e && e.message) || e)); }
        const _guild = (_ch && _ch.guild) ? _ch.guild : null;
        if (!_guild) return _fin (1, 'канал ' + _chId + ' не на сервере -- подключиться туда не могу');
        const _isVoice = (typeof _ch.isVoiceBased === 'function') ? _ch.isVoiceBased () : (_ch.type === 2 || _ch.type === 13);
        if (!_isVoice) return _fin (1, 'канал «' + _ch.name + '» не голосовой -- проверять нечего');
        console.log ('[voice] пробую войти в «' + _ch.name + '» (сервер «' + (_guild.name || _guild.id) + '»)...');
        let _conn = null;
        try
        {
            _conn = joinVoiceChannel
            (
                {
                    channelId: _ch.id,
                    guildId: _guild.id,
                    adapterCreator: _guild.voiceAdapterCreator,
                    selfDeaf: false,
                }
            );
        }
        catch (e) { return _fin (1, 'не смог начать подключение: ' + oneLine ((e && e.message) || e)); }
        const _onErr = e => { if (!_why) _why = oneLine ((e && e.message) || e); };
        _conn.on ('error', _onErr);
        _conn.on ('stateChange', (o, n) =>
        {
            if (!_why && n && n.status === VoiceConnectionStatus.Disconnected) _why = 'связь оборвалась сразу после подключения';
        });
        let _ok = false;
        try { await entersState (_conn, VoiceConnectionStatus.Ready, VOICE_CHECK_MS); _ok = true; }
        catch (e) { if (!_why) _why = oneLine ((e && e.message) || e); }
        const _sec = ((Date.now () - _t0) / 1000).toFixed (1);
        try { _conn.destroy (); } catch (e) { }
        if (_ok)
            return _fin (0, 'голос работает: канал «' + _ch.name + '» поднялся за ' + _sec +
                ' с (медиа-адрес ответил) -- музыка заиграет');
        return _fin (1, 'голос НЕ работает: канал «' + _ch.name + '» не поднялся за ' + (VOICE_CHECK_MS / 1000) +
            ' с' + (_why ? ' (' + _why + ')' : '') + ' -- пока это не наладится, музыка играть не сможет');
    }) ();
}

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

const musicSaveTick = setInterval
(
    () =>
    {
        for (let g in $music)
        {
            const m = $music[g];
            if (m && m.current && m.playingSince) saveMusicState (g);
        }
    },
    5 * 1000
);
if (musicSaveTick.unref) musicSaveTick.unref ();

const musicNetTick = setInterval
(
    async () =>
    {
        try
        {
            const now = Date.now ();
            for (const g of Object.keys ($music))
            {
                const m = $music[g];
                if (!m || !m.netWait || m.current) continue;
                if (m.leaving && m.connection) continue;
                if (!m.tracks.length && !m.seekTrack) { m.netWait = null; continue; }
                if (!m.connection && !m.leftByUser && m.savedChannelId)
                {
                    const gwReady = (typeof client.ws.status !== 'number' || client.ws.status === 0);
                    const guild = client.guilds.cache.get (g);
                    const ch = guild ? guild.channels.cache.get (m.savedChannelId) : null;
                    if (gwReady && guild && ch && typeof ch.isVoiceBased === 'function' && ch.isVoiceBased () &&
                        humansInChannel (g, ch.id) > 0 && (now - (m.netWait.rejoinAt || 0)) > 15000)
                    {
                        m.netWait.rejoinAt = now;
                        if (!m.netWait.rejoinLogged)
                        {
                            m.netWait.rejoinLogged = true;
                            console.log ('[' + (d()) + '] [music] меня нет в голосовом, а в «' + ch.name +
                                '» есть слушатели -- возвращаюсь сам');
                        }
                        voiceOutageAttempt (g);              // счёт обрывов: попытка возврата
                        startRestored (g, ch, guild);
                        if (m.connection) m.netWait = null;
                        continue;
                    }
                    if (!m.connection) continue;
                }
                const chId = m.connection ? m.connection.joinConfig.channelId : m.savedChannelId;
                if (!m.connection || !chId || humansInChannel (g, chId) <= 0) continue;
                const ready = await netRouteAnswers ();
                const justCame = ready && !m.netWait.up;
                m.netWait.up = ready;
                const _copy = ready ? null : netDiskPick (m);
                if (!ready && !_copy) continue;
                const _fastDisk = !!(_copy && (m.netWait.diskTries || 0) < 5 &&
                    now - (m.netWait.at || 0) >= DISK_RETRY_MS);
                if (!justCame && !_fastDisk && now < (m.netWait.nextAt || 0)) continue;
                if (justCame)
                    console.log ('[' + (d()) + '] [music] маршрут снова отвечает (прокси/сеть) -- сразу пробую играть');
                if (_copy)
                {
                    m.seekLoose = !!_copy.loose;
                    m.netWait.diskTries = (m.netWait.diskTries || 0) + 1;
                    if (!m.netWait.diskTold)
                    {
                        m.netWait.diskTold = 1;
                        console.log ('[' + (d()) + '] [music] сети нет, но у меня ' + _copy.what +
                            ' -- играю С ДИСКА, YouTube для этого не нужен (очередь не стоит, место в треке то же)');
                    }
                }
                m.netWait.nextAt = Date.now () + NET_WAIT_MAX_MS;
                Promise.resolve (playNext (g)).catch (() => {});
            }
        }
        catch (e) { console.error ('[music] watchdog сети: ' + oneLine ((e && e.message) || e)); }
    },
    NET_PING_STEP_MS
);
if (musicNetTick.unref) musicNetTick.unref ();

let $exiting = false;
async function saveAllMusic ()
{
    const ids = Object.keys ($music).filter
    (
        g => $music[g] && ($music[g].current || $music[g].tracks.length || $music[g].connection)
    );
    await Promise.race
    ([
        Promise.all (ids.map (g => saveMusicState (g).catch (() => {}))),
        new Promise (r => setTimeout (r, 1500)),
    ]);
}
for (let sig of ['SIGINT', 'SIGTERM'])
    process.on (sig, () =>
    {
        if ($exiting) return;
        $exiting = true;
        console.log ('[' + (d()) + '] [music] сохраняю очередь перед выходом...');
        saveAllMusic ()
            .then (() => ($conDrain ? $conDrain (400) : null))
            .then (drained =>
            {
                if ($conHalt && drained === false) $conHalt ();
            })
            .catch (() => {})
            .finally (() => { consoleRestoreCodePage (); $cliDone (0); });
    });

const MUSIC_STREAM_RETRIES = 3;

function trackToJson (t)
{
    return { url: t.url, title: t.title, duration: t.duration || 0, author: t.author || '',
             isLive: !!t.isLive, seek: t.seek || 0,
             byId: t.byId || null, byName: t.byName || '',
             addAt: Number (t.addAt) || 0,
             addIn: t.addIn || null };
}

function byIdOf (t) { return (t && t.byId) ? String (t.byId) : ''; }
function byNameOf (t) { return (t && t.byName) ? String (t.byName) : 'без автора'; }
function isBy (t, id) { return !!id && byIdOf (t) === String (id); }

function authorBlockInsertAt (tracks, byId)
{
    if (!byId) return tracks.length;
    for (let i = tracks.length - 1; i >= 0; i--)
        if (tracks[i] && isBy (tracks[i], byId)) return i + 1;
    return tracks.length;
}

function qKey (t) { return byIdOf (t); }

function qRunLen (list, i, key)
{
    let n = 0;
    while (i + n < list.length && qKey (list[i + n]) === key) n++;
    return n;
}

function qRunHead (list, key)
{
    for (let i = 0; i < list.length; i++)
        if (qKey (list[i]) === key) return i;
    return list.length;
}

function qWouldSplit (list, idx, key, leftKey)
{
    const left = (idx > 0) ? qKey (list[idx - 1]) : (leftKey === undefined ? null : leftKey);
    const right = (idx < list.length) ? qKey (list[idx]) : null;
    if (left === null || right === null) return false;
    if (left !== right) return false;
    return left !== key;
}

function queuePacks (m)
{
    const list = [], seen = new Map ();
    const add = (t, i, isPlaying) =>
    {
        if (!t) return;
        const k = qKey (t);
        let p = seen.get (k);
        if (!p)
        {
            p = { key: k, name: byNameOf (t), n: 0, first: -1, playing: false };
            seen.set (k, p);
            list.push (p);
        }
        if (isPlaying) { p.playing = true; return; }
        if (p.first < 0) p.first = i;
        p.n++;
    };
    if (m.current) add (m.current, -1, true);
    for (let i = 0; i < m.tracks.length; i++) add (m.tracks[i], i, false);
    return list;
}

function queuePacksText (m, max = 8)
{
    const packs = queuePacks (m);
    if (packs.length < 2) return '';
    const parts = packs.slice (0, max).map ((p, i) => (i + 1) + ') ' + (p.key ? u (p.key) : 'без автора') + ' -- ' +
        (p.n ? p.n + (p.playing ? ' ▶' : '') : 'играет'));
    return QSMALL + '📚 Пачки (двинуть -- «👤 Автор» в меню, админы/модеры): ' + parts.join (', ') +
        (packs.length > max ? ', ...и ещё ' + (packs.length - max) : '');
}

function qPackStaffText ()
{
    return '🚫 **Двигать и убирать пачки могут только админы и модеры.**\n' +
        '_Такое действие задевает чужие треки, и им легко испортить слушателям порядок. ' +
        'Своё DJ распоряжается сам: трек -- кнопками «🗂 Трек: подвинуть или убрать…» под `/queue` ' +
        '(вниз -- свободно, вверх -- только на своё же место), а всю свою пачку можно убрать кнопкой «🧹 Очистить»._';
}

function qWhoText (key) { return key ? u (key) : 'треки без автора'; }

function qGluePlaying (m)
{
    if (!m || !m.current || m.tracks.length < 2) return false;
    const key = qKey (m.current);
    const run = m.tracks.filter (t => qKey (t) === key);
    if (!run.length || qRunLen (m.tracks, 0, key) === run.length) return false;
    m.tracks = run.concat (m.tracks.filter (t => qKey (t) !== key));
    console.log ('[' + (d()) + '] [music] склеил пачку играющего трека (' + qWhoText (key) +
        ', ' + run.length + ' шт.): её треки стояли вразброс');
    return true;
}

function qSplitText (key, extra)
{
    return '🚫 **Пачку разрывать нельзя.** В этом месте подряд идут треки одного автора (' +
        qWhoText (key) + ') -- трек ' + (extra ? extra + ' ' : '') + 'встанет ровно между ними.\n' +
        '_Поставь его на границу пачек (перед всей пачкой или сразу после неё)._';
}

function byLabel (t)
{
    return byIdOf (t) ? ' · ' + u (byIdOf (t)) : ' · 👤 ' + byNameOf (t);
}

function playedMsOf (m)
{
    return (m.playedMs || 0) + (m.playingSince ? Date.now () - m.playingSince : 0);
}

async function saveMusicState (guildId)
{
    try
    {
        const m = $music[guildId];
        if (!m || !guildId) return;
        if (!m.current && !m.tracks.length)
        {
            await db (guildId, 'musicState', 'queue', null);
            return;
        }
        const channelId = m.connection ? m.connection.joinConfig.channelId : (m.savedChannelId || null);
        const playing = !!m.current;
        const waiting = m.current || m.seekTrack || null;
        let elapsed = 0;
        if (m.current) elapsed = Math.round (playedMsOf (m) / 1000);
        else if (m.seekTrack) elapsed = Math.max (0, Math.round (m.seekSec || 0));
        const rest = (waiting && !playing) ? m.tracks.filter (t => t !== waiting) : m.tracks;
        const curIdx = (waiting && !playing) ? Math.max (0, m.tracks.indexOf (waiting)) : 0;
        await db (guildId, 'musicState', 'queue',
        {
            at: Date.now (),
            channelId: channelId,
            textChannelId: m.textChannelId || null,
            current: waiting ? trackToJson (waiting) : null,
            curIdx: curIdx,
            elapsed: elapsed,
            tracks: rest.map (trackToJson),
            left: !!m.leftByUser,
            qMsg: (QUEUE_LIVE_MS && Array.isArray (m.qMsgs) && m.qMsgs.length)
                ? m.qMsgs.slice (0, QUEUE_LIVE_MAX).map (w => ({ ch: w.ch, id: w.id, page: w.page,
                    actorId: w.ctx && w.ctx.actorId, actorName: w.ctx && w.ctx.actorName,
                    staff: !!(w.ctx && w.ctx.staff) })) : null,
            noSec: Array.isArray (m.seekNoSections) ? m.seekNoSections.slice (-20) : [],
        });
    }
    catch (e) { console.error ('[music] не смог сохранить очередь: ' + oneLine (e.message)); }
}

async function clearMusicState (guildId)
{
    await db (guildId, 'musicState', 'queue', null)
        .catch (e => console.error ('[music] не смог стереть очередь: ' + oneLine (e.message)));
}

const HISTORY_MSG_LIMIT = 1800;
const HISTORY_PAGE_BLOCKS = 5;
const HISTORY_PACK_TITLES = 5;
const HISTORY_TITLE_CLIP = 70;
const HISTORY_TITLES_STORE = 100;
const HISTORY_TITLES_PAGE = 20;
const HISTORY_EXPAND_CLIP = 60;
function historyTrim (list)
{
    const out = (Array.isArray (list) ? list : []).slice ();
    if (out.length > MUSIC_HISTORY_LEN) out.length = MUSIC_HISTORY_LEN;
    if (MUSIC_HISTORY_TRACKS)
    {
        let total = 0;
        for (let i = 0; i < out.length; i++)
        {
            total += historyTracksOf (out[i]);
            if (total > MUSIC_HISTORY_TRACKS && i > 0) { out.length = i; break; }
        }
    }
    return out;
}
function historyTracksOf (e) { return Math.max (1, Number (e && e.n) || 1); }
function historyTotalTracks (list)
{
    return (Array.isArray (list) ? list : []).reduce ((s, e) => s + historyTracksOf (e), 0);
}

async function historyLoad (guildId)
{
    const m = musicOf (guildId);
    if (Array.isArray (m.history)) return m.history;
    m.history = [];
    m.historyFromDb = false;
    if (!MUSIC_HISTORY_LEN) return m.history;
    try
    {
        const rec = await db (guildId, 'musicState', 'history');
        const list = rec && Array.isArray (rec.list) ? rec.list : [];
        m.history = historyTrim (list.filter (e => e && typeof e === 'object' && Number (e.at)));
        m.historyFromDb = !!rec;
    }
    catch (e) { console.error ('[music] не смог прочитать историю добавлений: ' + oneLine ((e && e.message) || e)); }
    return m.history;
}

async function historySeedFromQueue (guildId)
{
    if (!MUSIC_HISTORY_LEN) return 0;
    const m = $music[guildId];
    if (!m) return 0;
    await historyLoad (guildId);
    if (m.historyFromDb || m.history.length) return 0;
    const byKey = new Map ();
    const seen = new Set ();
    for (const t of [...m.tracks, m.current, m.seekTrack])
    {
        if (!t || seen.has (t)) continue;
        seen.add (t);
        const at = Number (t.addAt) || 0;
        if (!at) continue;
        const key = byIdOf (t) + '@' + at;
        let b = byKey.get (key);
        if (!b) { b = { at: at, byId: byIdOf (t), byName: byNameOf (t), inCh: t.addIn ? String (t.addIn) : '',
                         n: 0, live: 0, titles: [], urls: [], ids: [], q: '' }; byKey.set (key, b); }
        b.n++;
        if (t.isLive) b.live++;
        if (b.titles.length < HISTORY_TITLES_STORE) b.titles.push (t.title || t.url || '');
        if (b.ids.length < 500) b.ids.push (ytKey (t.url));
        if (b.urls.length < 3 && /^https?:/i.test (String (t.url || ''))) b.urls.push (String (t.url).slice (0, 200));
    }
    const list = historyTrim ([...byKey.values ()].sort ((a, b) => b.at - a.at));
    if (!list.length) return 0;
    m.history = list;
    await historySave (guildId);
    console.log ('[' + (d()) + '] [music] история добавлений: перенёс в неё ' + list.length + ' ' +
        plural (list.length, 'пачку', 'пачки', 'пачек') + ' из очереди (строка «Последние добавления» переехала в /history)');
    return list.length;
}

async function historySave (guildId)
{
    const m = $music[guildId];
    if (!m || !Array.isArray (m.history)) return;
    try { await db (guildId, 'musicState', 'history', { at: Date.now (), list: historyTrim (m.history) }); }
    catch (e) { console.error ('[music] не смог сохранить историю добавлений: ' + oneLine ((e && e.message) || e)); }
}

function repeatListOf (guildId)
{
    const m = $music[guildId];
    if (!m) return [];
    if (!Array.isArray (m.repeat)) m.repeat = [];
    return m.repeat;
}
function repeatOn (guildId, userId)
{
    const id = String (userId || '');
    if (!id) return false;
    return repeatListOf (guildId).some (e => String (e && e.id) === id);
}
function repeatMark (m, t)
{
    const g = m && m.guildId;
    const id = byIdOf (t);
    return (g && id && repeatOn (g, id)) ? ' 🔁' : '';
}
function repeatTracksOf (guildId, userId)
{
    const m = $music[guildId];
    if (!m) return 0;
    const id = String (userId || '');
    return (m.tracks || []).filter (t => t && String (t.byId || '') === id).length;
}
async function repeatLoad (guildId)
{
    const m = musicOf (guildId);
    if (Array.isArray (m.repeat)) return m.repeat;
    m.repeat = [];
    try
    {
        const rec = await db (guildId, 'musicState', 'repeat');
        const list = rec && Array.isArray (rec.list) ? rec.list : [];
        m.repeat = list
            .filter (e => e && /^\d{17,20}$/.test (String (e.id || '')))
            .slice (0, 100)
            .map (e => ({ id: String (e.id), name: String (e.name || '').slice (0, 80), at: Number (e.at) || 0 }));
    }
    catch (e) { console.error ('[music] не смог прочитать режим повтора: ' + oneLine ((e && e.message) || e)); }
    return m.repeat;
}
async function repeatSave (guildId)
{
    const m = $music[guildId];
    if (!m || !Array.isArray (m.repeat)) return;
    try { await db (guildId, 'musicState', 'repeat', { at: Date.now (), list: m.repeat.slice (0, 100) }); }
    catch (e) { console.error ('[music] не смог сохранить режим повтора: ' + oneLine ((e && e.message) || e)); }
}
async function repeatSet (guildId, userId, userName, on)
{
    const id = String (userId || '');
    if (!/^\d{17,20}$/.test (id)) return { ok: false, text: '🤔 Не понял, для кого включать повтор.' };
    await repeatLoad (guildId);
    const list = repeatListOf (guildId);
    const at = list.findIndex (e => String (e.id) === id);
    if (on && at < 0)
        list.push ({ id: id, name: String (userName || '').slice (0, 80), at: Date.now () });
    else if (!on && at >= 0)
        list.splice (at, 1);
    else if (!on)
        return { ok: true, changed: false, on: false, text: '' };
    else
        return { ok: true, changed: false, on: true, text: '' };
    await repeatSave (guildId);
    return { ok: true, changed: true, on: !!on };
}

function repeatListText (guildId)
{
    const m = musicOf (guildId);
    const list = repeatListOf (guildId);
    if (!list.length)
        return '🔁 Режим повтора ни для кого не включён.\n' +
            '_Включают админы и модеры: `/repeat` (себе) или `/repeat user:@кто`. Тогда треки ' +
            'этого автора после проигрывания остаются в очереди и играют дальше по кругу._';
    const lines = ['🔁 **Режим повтора: ' + list.length + '** ' +
        plural (list.length, 'автор', 'автора', 'авторов') + '\n'];
    for (const e of list)
    {
        const inQ = repeatTracksOf (guildId, e.id);
        const playing = (m.current && String (m.current.byId || '') === String (e.id)) ? 1 : 0;
        lines.push ('• ' + u (e.id) + (e.name ? ' (`' + e.name + '`)' : '') + ' -- ' +
            (inQ ? inQ + ' ' + plural (inQ, 'трек', 'трека', 'треков') + ' в очереди' : 'в очереди треков нет') +
            (playing ? ' + играет прямо сейчас' : '') +
            (e.at ? ' · включён ' + d (e.at, true) : ''));
    }
    lines.push ('\n_Треки этих авторов не удаляются после проигрывания: доиграв, трек встаёт в конец ' +
        'очереди и играет снова. Выключить: `/repeat user:@кто` (или `/repeat` себе)._');
    return lines.join ('\n');
}

async function historyAdd (guildId, entry)
{
    if (!MUSIC_HISTORY_LEN) return;
    const m = musicOf (guildId);
    await historyLoad (guildId);
    m.history.unshift
    ({
        at: Number (entry.at) || Date.now (),
        byId: entry.byId ? String (entry.byId) : '',
        byName: String (entry.byName || '').slice (0, 80),
        inCh: entry.inCh ? String (entry.inCh) : '',
        n: Math.max (1, Number (entry.n) || 1),
        live: Math.max (0, Number (entry.live) || 0),
        q: String (entry.q || '').replace (/\s+/g, ' ').trim ().slice (0, 120),
        titles: (entry.titles || []).slice (0, HISTORY_TITLES_STORE).map (t => String (t || '').slice (0, 90)),
        urls: (entry.urls || []).filter (u => /^https?:/i.test (String (u || '')))
            .slice (0, 3).map (u => String (u).slice (0, 200)),
        ids: (entry.ids || []).slice (0, 500).map (s => String (s || '')).filter (Boolean),
    });
    m.history = historyTrim (m.history);
    await historySave (guildId);
}

function ytKey (url)
{
    const s = String (url || '');
    let m = s.match (/[?&]v=([\w-]{6,20})/);            if (m) return m[1];
    m = s.match (/youtu\.be\/([\w-]{6,20})/);           if (m) return m[1];
    m = s.match (/\/live\/([\w-]{6,20})/);              if (m) return m[1];
    m = s.match (/\/shorts\/([\w-]{6,20})/);            if (m) return m[1];
    m = s.match (/^([\w-]{6,20})$/);                    if (m) return m[1];
    return s.slice (0, 60);
}

function historyBlocksOf (list)
{
    const blocks = [];
    for (const e of (Array.isArray (list) ? list : []))
    {
        const key = String (e.q || (Array.isArray (e.urls) ? e.urls[0] : '') || '').trim ();
        const last = blocks[blocks.length - 1];
        if (last && key && last.key === key) { last.times++; last.to = Number (e.at) || 0; continue; }
        blocks.push ({ key: key, at: Number (e.at) || 0, times: 1, e: e });
    }
    return blocks;
}
function historyPagesOf (list)
{
    return Math.max (1, Math.ceil (historyBlocksOf (list).length / HISTORY_PAGE_BLOCKS));
}

function historyText (guildId, page = 1)
{
    const m = musicOf (guildId);
    const list = Array.isArray (m.history) ? m.history : [];
    const two = n => String (n).padStart (2, '0');
    const stamp = t => { const x = new Date (t); return two (x.getDate ()) + '.' + two (x.getMonth () + 1) +
        ' ' + two (x.getHours ()) + ':' + two (x.getMinutes ()); };
    if (!MUSIC_HISTORY_LEN)
        return '🕘 История добавлений сейчас выключена -- веду только очередь.\n_' +
            'Включить её может владелец бота._';
    if (!list.length)
        return '🕘 Истории добавлений пока нет -- её начнут писать новые `/play`.\n_' +
            'Помню последние ' + MUSIC_HISTORY_LEN + ' ' + plural (MUSIC_HISTORY_LEN, 'пачку', 'пачки', 'пачек') +
            '; очередь -- отдельно: `/queue`._';
    const blocks = historyBlocksOf (list);
    const pages = Math.max (1, Math.ceil (blocks.length / HISTORY_PAGE_BLOCKS));
    const cur = Math.min (Math.max (1, Math.floor (Number (page) || 1)), pages);
    const slice = blocks.slice ((cur - 1) * HISTORY_PAGE_BLOCKS, cur * HISTORY_PAGE_BLOCKS);
    const sum = historyTotalTracks (list);
    const head = '🕘 **История добавлений** -- ' + list.length + ' ' +
        plural (list.length, 'пачка', 'пачки', 'пачек') + ', ' + sum + ' ' +
        plural (sum, 'трек', 'трека', 'треков') +
        (pages > 1 ? ' -- страница ' + cur + ' из ' + pages : '') + ':\n' + QSEP;
    const withX = slice.some (b => b.times > 1);
    const tail = '\n' + QSEP + '\n_Строка -- одна пачка: время, ссылка и первые треки списком.' +
        (withX ? ' «×N» -- столько раз подряд ставили одну и ту же ссылку.' : '') +
        ' Весь состав -- кнопкой «📜 Все треки»._' +
        (pages > 1 ? '\n_Дальше -- кнопками листания под сообщением._' : '');
    const budget = HISTORY_MSG_LIMIT - head.length - 2 - tail.length;
    const linkLine = b => '`' + stamp (b.at) + '`' + (b.times > 1 ? ' ×' + b.times : '') + ' ' +
        (b.key ? '`' + b.key.slice (0, 90) + '`' : (historyTitlesOf (b.e)[0] || 'без названия'));
    const titleLine = (n, t) => n + '. ' + (String (t).length > HISTORY_TITLE_CLIP
        ? String (t).slice (0, HISTORY_TITLE_CLIP - 1).trimEnd () + '…' : String (t));
    const previewOf = (b, per) =>
    {
        if (!(per > 0)) return [];
        const t = historyTitlesOf (b.e);
        const out = t.slice (0, per).map ((x, i) => titleLine (i + 1, x));
        if (t.length > out.length) out.push ('…и ещё ' + (t.length - out.length));
        return out;
    };
    const rowsOf = per =>
    {
        const out = [];
        let len = 0;
        for (const b of slice)
        {
            const part = [linkLine (b)].concat (previewOf (b, per)).join ('\n');
            if (len + part.length + 2 > budget) break;
            out.push (part);
            len += part.length + 2;
        }
        return out;
    };
    let rows = null;
    for (let per = HISTORY_PACK_TITLES; per >= 0; per--)
    {
        const r = rowsOf (per);
        if (!rows || r.length > rows.length) rows = r;
        if (r.length >= slice.length) break;
    }
    const text = head + '\n' + rows.join ('\n\n') + tail;
    return text.length <= HISTORY_MSG_LIMIT ? text : fitMsgText (text, HISTORY_MSG_LIMIT);
}

function historyComponents (guildId, page = 1)
{
    const m = musicOf (guildId);
    const list = Array.isArray (m.history) ? m.history : [];
    const pages = historyPagesOf (list);
    const cur = Math.min (Math.max (1, Math.floor (Number (page) || 1)), pages);
    const rows = [];
    if (pages > 1)
        rows.push (new ActionRowBuilder ().addComponents (
            new ButtonBuilder ().setCustomId ('q:hg:first:1').setLabel ('⏮ В начало')
                .setStyle (ButtonStyle.Secondary).setDisabled (cur <= 1),
            new ButtonBuilder ().setCustomId ('q:hg:prev:' + Math.max (1, cur - 1)).setLabel ('◀ Влево')
                .setStyle (ButtonStyle.Secondary).setDisabled (cur <= 1),
            new ButtonBuilder ().setCustomId ('q:hg:next:' + Math.min (pages, cur + 1)).setLabel ('Вправо ▶')
                .setStyle (ButtonStyle.Secondary).setDisabled (cur >= pages),
            new ButtonBuilder ().setCustomId ('q:hg:last:' + pages).setLabel ('В конец ⏭')
                .setStyle (ButtonStyle.Secondary).setDisabled (cur >= pages)
        ));
    if (list.some (e => historyTitlesOf (e).length > 3))
        rows.push (new ActionRowBuilder ().addComponents (
            new ButtonBuilder ().setCustomId ('q:hi').setLabel ('📜 Все треки')
                .setStyle (ButtonStyle.Secondary)
        ));
    return rows;
}

function historyPairsOf (e)
{
    const t = Array.isArray (e && e.titles) ? e.titles : [];
    const ids = Array.isArray (e && e.ids) ? e.ids : [];
    const out = [];
    for (let i = 0; i < t.length; i++)
    {
        const title = String (t[i] || '').trim ();
        if (!title) continue;
        out.push ({ title: title, id: String (ids[i] || '').trim () });
    }
    return out;
}
function historyTitlesOf (e)
{
    return historyPairsOf (e).map (p => p.title);
}
function historyLinkOf (id)
{
    return /^[\w-]{6,20}$/.test (String (id || '')) ? 'https://youtu.be/' + id : '';
}
const HISTORY_LINK_PAGE = 15;
function historyPageSize (e)
{
    return (Array.isArray (e && e.ids) && e.ids.some (historyLinkOf)) ? HISTORY_LINK_PAGE : HISTORY_TITLES_PAGE;
}
function historyStamp (t)
{
    const two = n => String (n).padStart (2, '0');
    const x = new Date (Number (t) || 0);
    return two (x.getDate ()) + '.' + two (x.getMonth () + 1) + ' ' + two (x.getHours ()) + ':' + two (x.getMinutes ());
}
function historySizeOf (e)
{
    return Math.max (Number (e && e.n) || 0, historyTitlesOf (e).length);
}

const HISTORY_PICK_COUNT = 25;
function historyPickRows (list)
{
    const opts = [], used = new Set ();
    for (const e of (Array.isArray (list) ? list : []))
    {
        if (opts.length >= HISTORY_PICK_COUNT) break;
        const at = String (Number (e && e.at) || 0);
        if (at === '0' || used.has (at)) continue;
        used.add (at);
        const n = historySizeOf (e);
        const opt =
        {
            label: (historyStamp (e.at) + ' · ' + (e.byName || 'без автора') + ' · ' + n + ' ' +
                plural (n, 'трек', 'трека', 'треков')).slice (0, 100),
            value: at,
        };
        if (e.q) opt.description = clipped ('запуск: ' + String (e.q), 90);
        opts.push (opt);
    }
    if (!opts.length) return null;
    const sel = new StringSelectMenuBuilder ()
        .setCustomId ('q:hsel').setPlaceholder ('📜 Какую пачку раскрыть?');
    sel.addOptions (opts);
    return [new ActionRowBuilder ().addComponents (sel),
            new ActionRowBuilder ().addComponents
            (new ButtonBuilder ().setCustomId ('q:hclose').setLabel ('✖ Закрыть').setStyle (ButtonStyle.Secondary))];
}
function clipped (s, n = 90)
{
    const t = String (s || '');
    return t.length > n ? t.slice (0, n - 1) + '…' : t;
}

function historyExpandRows (e, off, n)
{
    const size = historyPageSize (e);
    const pages = Math.max (1, Math.ceil (n / size));
    const p = Math.min (Math.max (0, Math.floor ((Number (off) || 0) / size) || 0), pages - 1);
    const first = p * size;
    const btns = [];
    if (pages > 1)
    {
        btns.push (new ButtonBuilder ()
            .setCustomId ('q:hp:' + (Number (e.at) || 0) + ':' + (first - size))
            .setLabel ('◀ Раньше').setStyle (ButtonStyle.Secondary).setDisabled (p <= 0));
        btns.push (new ButtonBuilder ()
            .setCustomId ('q:hp:' + (Number (e.at) || 0) + ':' + (first + size))
            .setLabel ('Позже ▶').setStyle (ButtonStyle.Secondary).setDisabled (p >= pages - 1));
    }
    if (e && e.q)
        btns.push (new ButtonBuilder ().setCustomId ('q:hre:' + (Number (e.at) || 0))
            .setLabel ('▶ Поставить заново').setStyle (ButtonStyle.Primary));
    btns.push (new ButtonBuilder ().setCustomId ('q:hclose').setLabel ('✖ Закрыть').setStyle (ButtonStyle.Secondary));
    return [new ActionRowBuilder ().addComponents (...btns)];
}

function historyOneRow (part)
{
    const opts = [], seen = new Set ();
    for (const p of (Array.isArray (part) ? part : []))
    {
        const id = String ((p && p.id) || '');
        if (!id || seen.has (id) || !historyLinkOf (id)) continue;
        seen.add (id);
        opts.push ({ label: clipped ('⤓ ' + (p.title || id), 100), value: id });
    }
    if (!opts.length) return null;
    const sel = new StringSelectMenuBuilder ()
        .setCustomId ('q:hget')
        .setPlaceholder ('⤓ Взять в очередь ОДИН трек из этой страницы…');
    sel.addOptions (opts);
    return new ActionRowBuilder ().addComponents (sel);
}

function historyExpandView (e, off)
{
    const pairs = historyPairsOf (e);
    const titles = pairs.map (p => p.title);
    const total = historySizeOf (e);
    const head = '📜 **Состав пачки** -- `' + historyStamp (e.at) + '` ' + (e.byName || 'без автора') + ': ' +
        total + ' ' + plural (total, 'трек', 'трека', 'треков') +
        ((e.live && e.n > 1) ? ' (' + e.live + ' 🔴 ' + plural (e.live, 'эфир', 'эфира', 'эфиров') + ')' : '');
    if (!titles.length)
        return { text: head + '\n_' + 'Состав не сохранён -- запись старая: тогда сохранялись'
            + ' только первые три названия (в /history они видны).' +
            (e.q ? ' Зато я помню, что вводили в /play -- кнопка ниже вернёт пачку в очередь.' : '') + '_',
            rows: e.q ? historyExpandRows (e, 0, 0) : [] };
    const size = historyPageSize (e);
    const pages = Math.max (1, Math.ceil (titles.length / size));
    const p = Math.min (Math.max (0, Math.floor ((Number (off) || 0) / size) || 0), pages - 1);
    const first = p * size;
    const lines = [];
    for (let i = first; i < titles.length && lines.length < size; i++)
    {
        const link = historyLinkOf (pairs[i] && pairs[i].id);
        lines.push (String (i + 1).padStart (2, ' ') + '. ' + clipped (titles[i], HISTORY_EXPAND_CLIP) +
            (link ? ' — ' + link : ''));
    }
    const notes = [];
    if (titles.length < total)
        notes.push ('Сохранено ' + titles.length + ' названий из ' + total +
            ' -- пачка из ' + (titles.length <= 3 ? 'старой записи' : 'более чем ' +
            HISTORY_TITLES_STORE + ' треков'));
    if (e.q) notes.push ('запуск: `' + clipped (e.q, 60) + '` -- кнопкой «▶ Поставить заново» эта пачка вернётся в очередь целиком');
    else notes.push ('поставить заново не смогу: в записи нет того, что вводили в /play (запись старая или пачка перенесена из очереди)');
    const rows = historyExpandRows (e, off, titles.length);
    const oneRow = historyOneRow (pairs.slice (first, first + size));
    if (oneRow)
    {
        rows.push (oneRow);
        notes.push ('из состава можно вернуть в очередь ОДИН трек -- меню ниже (адрес берётся из записи); «▶ Поставить заново» вернёт всю пачку');
    }
    const text = head + (pages > 1 ? ' · стр. ' + (p + 1) + '/' + pages + ' (всего показано ' +
            titles.length + ')' : '') + '\n' + QSEP + '\n' +
        '```\n' + lines.join ('\n') + '\n```' +
        (notes.length ? '\n' + notes.map (s => '_' + s + '_').join ('\n') : '');
    return { text: text, rows: rows, titles: titles.length };
}

async function historyReAdd (guildId, at, userId, byName, inCh)
{
    const m = musicOf (guildId);
    await historyLoad (guildId);
    const e = historyFind (m.history, at);
    if (!e)
        return { ok: false, text: '🕘 Этой пачки в истории уже нет -- она ушла по лимиту. Вызови `/history` заново.' };
    const q = String (e.q || '').trim ();
    if (!q)
        return { ok: false, text: '🕘 В записи этой пачки нет того, что вводили в `/play` '
            + '(запись старая или пачка перенесена из очереди) -- добавь её заново ссылкой в `/play`.' };
    let tracks;
    try { tracks = isUrl (q) ? await playlistInfo (q) : [await trackInfo ('ytsearch1:' + q)]; }
    catch (err)
    {
        return { ok: false, text: '❌ Не смог поставить заново (`' + clipped (q, 60) + '`): `' + ytDlpErr (err, 150) + '`' };
    }
    if (!tracks.length)
        return { ok: false, text: '❌ Пустой результат -- похоже, этой пачки больше нет.' };
    const addedAt = Date.now ();
    for (const t of tracks)
    {
        t.byId = String (userId);
        t.byName = String (byName || '');
        t.addAt = addedAt;
        t.addIn = inCh || null;
    }
    qGluePlaying (m);
    const insAt = authorBlockInsertAt (m.tracks, userId);
    m.tracks.splice (insAt, 0, ...tracks);
    scheduleVoiceStatus (guildId);
    schedulePresence ();
    scheduleDeadScan (guildId);
    if (!m.current) startPreload (guildId);
    saveMusicState (guildId);
    historyAdd (guildId,
    {
        at: addedAt, byId: userId, byName: byName, inCh: inCh, n: tracks.length,
        live: tracks.filter (t => t.isLive).length,
        titles: tracks.map (t => t.title || t.url || ''),
        q: q, urls: tracks.map (t => t.url || ''), ids: tracks.map (t => ytKey (t.url)),
    }).catch (err => console.error ('[music] история добавлений: ' + oneLine ((err && err.message) || err)));
    if (m.connection && !m.current) playNext (guildId);
    const live = tracks.filter (t => t.isLive).length;
    return { ok: true, text: '▶ **Поставил пачку заново -- в очередь:** ' + tracks.length + ' ' +
        plural (tracks.length, 'трек', 'трека', 'треков') +
        (live ? ' (' + live + ' 🔴 ' + plural (live, 'эфир', 'эфира', 'эфиров') + ')' : '') +
        '\n' + QSMALL + 'место в очереди: №' + (insAt + 1) + '-' + (insAt + tracks.length) +
        ' (в конце твоего блока, как обычный `/play`); всего в очереди: ' + m.tracks.length +
        '\n' + QSMALL + 'источник: `' + clipped (q, 80) + '`\n' +
        QSMALL + '_В очередь их поставил ты: бот едет к автору играющего трека, иначе он уехал бы к тому, кого в канале нет._' };
}

async function historyReAddOne (guildId, keyId, userId, byName, inCh)
{
    const m = musicOf (guildId);
    const url = historyLinkOf (keyId);
    if (!url)
        return { ok: false, text: '🕘 У этого трека в записи нет адреса -- поставить его можно только заново (ссылкой в `/play`).' };
    let t;
    try { t = await trackInfo (url); }
    catch (err)
    {
        return { ok: false, text: '❌ Не смог поставить трек из пачки (`' + url + '`): `' + ytDlpErr (err, 150) + '`' };
    }
    if (!t)
        return { ok: false, text: '❌ Пустой результат -- похоже, этого трека больше нет.' };
    const addedAt = Date.now ();
    t.byId = String (userId);
    t.byName = String (byName || '');
    t.addAt = addedAt;
    t.addIn = inCh || null;
    qGluePlaying (m);
    const insAt = authorBlockInsertAt (m.tracks, userId);
    m.tracks.splice (insAt, 0, t);
    scheduleVoiceStatus (guildId);
    schedulePresence ();
    scheduleDeadScan (guildId);
    if (!m.current) startPreload (guildId);
    saveMusicState (guildId);
    historyAdd (guildId,
    {
        at: addedAt, byId: userId, byName: byName, inCh: inCh, n: 1,
        live: t.isLive ? 1 : 0,
        titles: [t.title || url], q: url, urls: [t.url || ''], ids: [ytKey (t.url)],
    }).catch (err => console.error ('[music] история добавлений: ' + oneLine ((err && err.message) || err)));
    if (m.connection && !m.current) playNext (guildId);
    return { ok: true, text: '⤓ **Взял из пачки -- в очередь:** ' + (t.title || url) +
        (t.isLive ? ' 🔴 (эфир)' : '') +
        '\n' + QSMALL + 'место в очереди: №' + (insAt + 1) + ' (в конце твоего блока, как обычный `/play`)' +
        '\n' + QSMALL + '_Остальные треки пачки не тронуты: можно взять ещё по одному или вернуть всё кнопкой «▶ Поставить заново»._' };
}

function historyFind (list, at)
{
    const want = String (Number (at) || 0);
    for (const e of (Array.isArray (list) ? list : [])) if (String (Number (e && e.at) || 0) === want) return e;
    return null;
}

async function writeVoiceState (guildId, channelId, left)
{
    try
    {
        if (!channelId) { await db (guildId, 'musicState', 'voice', null); return; }
        await db (guildId, 'musicState', 'voice',
            { at: Date.now (), channelId: channelId, left: !!left });
    }
    catch (e) { console.error ('[music] не смог сохранить, где сижу: ' + oneLine (e.message)); }
}

async function saveVoiceState (guildId)
{
    const m = $music[guildId];
    const chId = (m && m.connection && m.connection.joinConfig)
        ? m.connection.joinConfig.channelId : null;
    await writeVoiceState (guildId, chId, !!(m && m.leftByUser));
}

async function readVoiceState (guildId)
{
    try
    {
        const v = await db (guildId, 'musicState', 'voice');
        return (v && typeof v === 'object' && v.channelId) ? v : null;
    }
    catch (e) { return null; }
}

function restCount (m)
{
    return Math.max (0, m.tracks.length - (m.seekTrack ? 1 : 0));
}

function queuePreview (m, max = 5)
{
    const total = m.tracks.length;
    const list = m.tracks.slice (0, max).map ((t, i) => (i + 1) + '. ' + (t.title || 'трек') + byLabel (t)).join ('\n');
    return '**Очередь (' + total + '):**\n' + list + (total > max ? '\n*...и ещё ' + (total - max) + ' -- /queue*' : '');
}

function queueLeft (m)
{
    let sec = 0, unknown = 0, live = 0;
    for (const t of m.tracks)
    {
        if (t.isLive) live++;
        else if (t.duration > 0) sec += t.duration;
        else unknown++;
    }
    let curLeft = 0;
    if (m.current && !m.current.isLive && m.current.duration > 0)
    {
        curLeft = Math.max (0, m.current.duration - Math.floor (playedMsOf (m) / 1000));
        sec += curLeft;
    }
    return { sec, curLeft, unknown, live };
}

const QUEUE_PAGE_DEFAULT = 15;
const QUEUE_PAGE_MAX = 25;
function queuePageSize (m)
{
    const n = Number ((SERVERS[(m && m.guildId) || ''] || {}).queue_page);
    if (!Number.isFinite (n) || n <= 0) return QUEUE_PAGE_DEFAULT;
    return Math.min (QUEUE_PAGE_MAX, Math.max (1, Math.floor (n)));
}
const QUEUE_MSG_LIMIT = 1980;
const QUEUE_GLUE = 150;
const QSEP = '────────────';
const QSMALL = '-# ';
const QUEUE_HINT_SHOW = false;
const QUEUE_HINT_SHORT = QSMALL + 'Действия -- кнопками ниже.';
const QUEUE_HINT_FULL =
    QSMALL + 'Перемотать внутри трека -- «◀ 30 с» / «30 с ▶» / «⏱ На таймкод…» или /seek;' +
    ' свой трек (у админов и модеров -- любой).' + '\n' +
    QSMALL + 'Подвинуть -- выбери трек в меню ниже (выше/ниже, в начало, в конец' +
    ' или «На позицию…»), либо командой /move номер to номер.' + '\n' +
    QSMALL + 'Прыгнуть по очереди -- /jump или кнопка «⤴ Другой трек» (список треков):' +
    ' DJ -- по своим, админы и модеры -- любым.' +
    ' Срочный переход (прерванный трек вернётся в очередь, с того же места) либо «Обрезать до трека»' +
    ' (всё до него убрать -- DJ только если всё убираемое его).' + '\n' +
    QSMALL + 'Чистить -- /clear (остаться) или /stop (уйти): спросят подтверждение.' + '\n' +
    QSMALL + 'DJ распоряжается только своими треками: вниз -- свободно, вверх -- только' +
    ' на своё же место. Пачками (всеми треками автора) -- только админы и модеры.';

function queueHintText ()
{
    return QUEUE_HINT_SHOW ? QUEUE_HINT_FULL : '';
}

function queueAuthorsText (m)
{
    const map = new Map ();
    let noAuthor = 0;
    const add = t =>
    {
        if (!t) return;
        const key = t.byId ? String (t.byId) : '';
        if (!key) { noAuthor++; return; }
        let o = map.get (key);
        if (!o) { o = { name: t.byName || u (key), n: 0, sec: 0, live: 0, rep: repeatOn (m.guildId, key) }; map.set (key, o); }
        o.n++;
        if (t.isLive) o.live++;
        else if (t.duration > 0) o.sec += t.duration;
    };
    add (m.current);
    for (const t of m.tracks) add (t);
    if (!map.size && !noAuthor) return '';
    const list = [...map.values ()].sort ((a, b) => b.n - a.n || String (a.name).localeCompare (String (b.name)));
    const top = list.slice (0, 6).map (o => o.name + ' — ' + o.n + ' ' +
        plural (o.n, 'трек', 'трека', 'треков') +
        (o.sec ? ' (~' + fmtAgo (o.sec * 1000) + ')' : '') +
        (o.live ? ' + ' + o.live + ' 🔴' : '') +
        (o.rep ? ' 🔁' : ''));
    return QSMALL + '👥 По авторам: ' + (top.length ? top.join (', ') : 'только треки без автора') +
        (list.length > 6 ? ' и ещё ' + (list.length - 6) + ' ' + plural (list.length - 6, 'автор', 'автора', 'авторов') : '') +
        (noAuthor ? (top.length ? ', ' : '') + 'без автора: ' + noAuthor : '');
}

function queueListBudget (m)
{
    const chrome = queueHeadText (m).length + queueWaitText (m).length +
        queueAuthorsText (m).length + queueCheckText (m).length +
        queuePacksText (m).length +
        netWaitText (m).length + netRouteText (m.guildId, OWNER_HOSTER).length +
        QUEUE_GLUE + queueHintText ().length;
    return Math.max (200, QUEUE_MSG_LIMIT - chrome);
}

function queueLines (slice, start, titleClip, m)
{
    const lines = [];
    const seekOf = t =>
    {
        let at = Number (t && t.seek) || 0;
        if (m && m.seekTrack === t && (Number (m.seekSec) || 0) > at) at = Number (m.seekSec) || 0;
        return Math.max (0, Math.round (at));
    };
    for (let i = 0; i < slice.length; i++)
    {
        const t = slice[i];
        const byId = byIdOf (t);
        const by = byNameOf (t);
        const label = (byId ? ' · ' + u (byId)
            : (by ? ' · 👤 ' + clipText (by, 24) : '')) + repeatMark (m, t);
        const at = seekOf (t);
        const timeTxt = (at >= 1 && t.duration > 0)
            ? fmtDur (Math.min (at, t.duration)) + '/' + fmtDur (t.duration)
            : fmtDur (t.duration, t.isLive);
        lines.push ('`' + (start + i) + '` · ' + (t.warn ? '⚠ ' : '') + '**' +
            clipText (t.title || 'трек', titleClip) + '** `' + timeTxt + '`' + label);
    }
    return lines;
}

function queuePage (m, start)
{
    const total = m.tracks.length;
    const budget = queueListBudget (m);
    const size = queuePageSize (m);
    start = Math.min (Math.max (1, Math.round (start) || 1), Math.max (1, total));
    const slice = m.tracks.slice (start - 1, start - 1 + size);
    let lines = null;
    for (const clip of [120, 80, 60, 45, 30, 25, 20])
    {
        lines = queueLines (slice, start, clip, m);
        if (lines.join ('\n').length <= budget) break;
    }
    while (lines.length > 1 && lines.join ('\n').length > budget) lines.pop ();
    return { start, total, count: lines.length, list: lines.join ('\n'), size: size };
}

function queuePageOf (m, n)
{
    let start = 1;
    for (let guard = 0; guard < 2000; guard++)
    {
        const p = queuePage (m, start);
        if (!p.count) return 1;
        if (n <= p.start + p.count - 1) return p.start;
        start = p.start + p.count;
    }
    return 1;
}

function queueLastStart (m)
{
    let start = 1;
    for (let guard = 0; guard < 2000; guard++)
    {
        const p = queuePage (m, start);
        if (!p.count) return 1;
        const next = p.start + p.count;
        if (next > p.total) return p.start;
        start = next;
    }
    return 1;
}

function queueComponents (page, m, moveSel = 0, opts = {})
{
    const { start, total, count } = page;
    const actorId = opts.actorId || '';
    const staff = !!opts.staff;
    const mine = t => staff || isBy (t, actorId);
    const step = page.size || count || 1;
    const rows = [];
    const refreshBtn = at => new ButtonBuilder ()
        .setCustomId ('q:rf:' + at).setLabel ('🔄 Обновить').setStyle (ButtonStyle.Secondary);
    if (total > 0)
    {
        const atEnd = (start + count) > total;
        rows.push
        (
            new ActionRowBuilder ().addComponents
            (
                new ButtonBuilder ()
                    .setCustomId ('q:p:first:1').setLabel ('⏮ В начало')
                    .setStyle (ButtonStyle.Secondary).setDisabled (start <= 1),
                new ButtonBuilder ()
                    .setCustomId ('q:p:prev:' + Math.max (1, start - step)).setLabel ('◀ Влево')
                    .setStyle (ButtonStyle.Secondary).setDisabled (start <= 1),
                refreshBtn (start),
                new ButtonBuilder ()
                    .setCustomId ('q:n:next:' + (start + count)).setLabel ('Вправо ▶')
                    .setStyle (ButtonStyle.Secondary).setDisabled (atEnd),
                new ButtonBuilder ()
                    .setCustomId ('q:n:last:' + queueLastStart (m)).setLabel ('В конец ⏭')
                    .setStyle (ButtonStyle.Secondary).setDisabled (atEnd)
            )
        );
    }
    else
    {
        rows.push (new ActionRowBuilder ().addComponents (refreshBtn (1)));
    }
    const liveNoSeek = !m.current || m.current.isLive;
    rows.push
    (
        new ActionRowBuilder ().addComponents
        (
            new ButtonBuilder ()
                .setCustomId ('q:s:m').setLabel ('◀ 30 с').setStyle (ButtonStyle.Secondary)
                .setDisabled (liveNoSeek),
            new ButtonBuilder ()
                .setCustomId ('q:s:p').setLabel ('30 с ▶').setStyle (ButtonStyle.Secondary)
                .setDisabled (liveNoSeek),
            new ButtonBuilder ()
                .setCustomId ('q:sk:' + start).setLabel ('⏱ На таймкод…').setStyle (ButtonStyle.Secondary)
                .setDisabled (liveNoSeek),
            new ButtonBuilder ()
                .setCustomId ('q:skip').setLabel ('⏭ Пропустить').setStyle (ButtonStyle.Secondary)
                .setDisabled (!m.current),
            new ButtonBuilder ()
                .setCustomId ('q:jmp').setLabel ('⤴ Другой трек').setStyle (ButtonStyle.Secondary)
                .setDisabled (!total)
        )
    );
    rows.push
    (
        new ActionRowBuilder ().addComponents
        (
            new ButtonBuilder ()
                .setCustomId ('q:join').setLabel ('▶ Войти').setStyle (ButtonStyle.Secondary),
            new ButtonBuilder ()
                .setCustomId ('q:leave').setLabel ('⏏ Выйти').setStyle (ButtonStyle.Secondary),
            new ButtonBuilder ()
                .setCustomId ('q:flt').setLabel ('🧽 Фильтр…').setStyle (ButtonStyle.Danger)
                .setDisabled (!total && !m.current),
            new ButtonBuilder ()
                .setCustomId ('q:clear').setLabel ('🧹 Очистить').setStyle (ButtonStyle.Danger)
                .setDisabled (!total && !m.current),
            new ButtonBuilder ()
                .setCustomId ('q:stop').setLabel ('🧹⏏ Очистка/Выход').setStyle (ButtonStyle.Danger)
                .setDisabled (!total && !m.current && !m.connection)
        )
    );
    if (count && !moveSel)
    {
        const opts = [];
        for (let i = 0; i < count; i++)
        {
            const n = start + i;
            const t = m.tracks[n - 1];
            if (!t || !mine (t)) continue;
            opts.push ({ label: ('№' + n + ' · ' + (t.title || 'трек')).slice (0, 100),
                         value: String (n), default: n === moveSel });
        }
        if (opts.length)
        {
            const tr = new StringSelectMenuBuilder ()
                .setCustomId ('q:tr:' + start)
                .setPlaceholder (moveSel ? ('№' + moveSel + ' выбран -- или выбери другой')
                                         : (staff ? '🗂 Трек: подвинуть или убрать…' : '🗂 Свой трек: подвинуть или убрать…'));
            tr.addOptions (opts);
            rows.push (new ActionRowBuilder ().addComponents (tr));
        }
    }
    if (!moveSel && staff)
    {
        const authorOpts = queueAuthorList (m, actorId, true).map (o =>
        ({
            label: ('👤 ' + o.name).slice (0, 100),
            description: o.n + ' ' + plural (o.n, 'трек', 'трека', 'треков') +
                (o.id === String (actorId) ? ' (твои)' : ''),
            value: (o.id || '0'),
        }));
        if (authorOpts.length)
        {
            const da = new StringSelectMenuBuilder ()
                .setCustomId ('q:da')
                .setPlaceholder ('👤 Автор: подвинуть или убрать…');
            da.addOptions (authorOpts.slice (0, 25));
            rows.push (new ActionRowBuilder ().addComponents (da));
        }
    }
    if (moveSel >= 1 && moveSel <= total)
    {
        rows.length = 0;
        rows.push
        (
            new ActionRowBuilder ().addComponents
            (
                new ButtonBuilder ()
                    .setCustomId ('q:rx:' + moveSel + ':' + start).setLabel ('🗑 Убрать')
                    .setStyle (ButtonStyle.Danger),
                new ButtonBuilder ()
                    .setCustomId ('q:mt:' + moveSel).setLabel ('⏫ В начало')
                    .setStyle (ButtonStyle.Primary).setDisabled (moveSel <= 1),
                new ButtonBuilder ()
                    .setCustomId ('q:mb:' + moveSel).setLabel ('⏬ В конец')
                    .setStyle (ButtonStyle.Primary).setDisabled (moveSel >= total),
                new ButtonBuilder ()
                    .setCustomId ('q:mp:' + moveSel).setLabel ('#️⃣ На позицию…')
                    .setStyle (ButtonStyle.Secondary),
                new ButtonBuilder ()
                    .setCustomId ('q:mz:' + moveSel).setLabel ('▶ Играющим')
                    .setStyle (ButtonStyle.Success)
            )
        );
        rows.push
        (
            new ActionRowBuilder ().addComponents
            (
                new ButtonBuilder ()
                    .setCustomId ('q:mu:' + moveSel).setLabel ('⬆ Выше')
                    .setStyle (ButtonStyle.Primary).setDisabled (moveSel <= 1),
                new ButtonBuilder ()
                    .setCustomId ('q:md:' + moveSel).setLabel ('⬇ Ниже')
                    .setStyle (ButtonStyle.Primary).setDisabled (moveSel >= total),
                new ButtonBuilder ()
                    .setCustomId ('q:mx:' + start).setLabel ('✖ Вернуться')
                    .setStyle (ButtonStyle.Secondary)
            )
        );
    }
    return rows.slice (0, 5);
}

function queueSkip (guildId, who, opts = {})
{
    const m = musicOf (guildId);
    if (!m.current) return { ok: false, text: '🤷 Сейчас ничего не играет.' };
    if (!opts.staff && byIdOf (m.current) && !isBy (m.current, opts.actorId))
        return { ok: false, text: ownOnlyText ('Пропустить', m.current) };
    const skipped = m.current.title || 'трек';
    m.skipRequested = true;
    m.player.stop (true);
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'пропустил: ' + skipped);
    return { ok: true, text: '⏭ Пропущено: **' + skipped + '**' +
        (m.current ? ' -- играю **' + (m.current.title || 'трек') + '**' : '') };
}

function queueWipe (guildId)
{
    const m = musicOf (guildId);
    const w =
    {
        n: m.tracks.length,
        playing: m.current ? (m.current.title || 'трек') : '',
        waiting: (!m.current && m.seekTrack) ? (m.seekTrack.title || 'трек') : '',
    };
    m.tracks = [];
    m.current = null;
    m.seekTrack = null;
    m.seekSec = 0;
    m.pending = false;
    m.pausedByNobody = false;
    m.playedToSomeone = false;
    m.playedMs = 0;
    m.playingSince = null;
    longDownloadPrune (m);
    dropPreload (m);
    m.player.stop (true);
    clearMusicState (guildId);
    routeUseClear (guildId);
    cacheDropUnused ();
    return w;
}

function queuePurge (guildId, keep)
{
    const m = musicOf (guildId);
    const goneQ = m.tracks.filter (t => !keep (t)).length;
    const playing = (m.current && !keep (m.current)) ? (m.current.title || 'трек') : '';
    const waiting = (!playing && m.seekTrack && !keep (m.seekTrack)) ? (m.seekTrack.title || 'трек') : '';
    if (!goneQ && !playing && !waiting) return null;
    m.tracks = m.tracks.filter (keep);
    if (waiting) { m.seekTrack = null; m.seekSec = 0; }
    if (playing)
    {
        m.current = null;
        m.playedMs = 0;
        m.playingSince = null;
        m.player.stop (true);
    }
    if (!m.tracks.length && !m.current && !m.seekTrack)
    {
        m.pending = false;
        clearMusicState (guildId);
        routeUseClear (guildId);
        cacheDropUnused ();
    }
    else saveMusicState (guildId);
    longDownloadPrune (m);
    dropPreload (m);
    startPreload (guildId);
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    return { goneQ: goneQ, playing: playing, waiting: waiting, left: m.tracks.length };
}

function ownOnlyText (action, track)
{
    return '🚫 ' + action + ' -- только свои записи: этот трек добавил ' +
        (byIdOf (track) ? byNameOf (track) : 'неизвестный автор (трек из старой базы)') + '.';
}

function queueClearPlan (m, actorId, scope)
{
    const all = (scope === 'all');
    const hit = t => !!t && (all || isBy (t, actorId));
    const n = m.tracks.filter (hit).length;
    const playing = (m.current && hit (m.current)) ? m.current : null;
    const waiting = (!m.current && m.seekTrack && hit (m.seekTrack)) ? m.seekTrack : null;
    return {
        all: all, n: n, playing: playing, waiting: waiting,
        left: m.tracks.length - n,
        any: !!(n || playing || waiting),
        ownN: m.tracks.filter (t => isBy (t, actorId)).length,
        ownPlaying: !!(m.current && isBy (m.current, actorId)),
        total: m.tracks.length,
    };
}

function queueClearAuthor (guildId, targetId, who)
{
    const target = String (targetId === undefined || targetId === null ? '' : targetId);
    const hit = t => !!t && byIdOf (t) === target;
    const m = musicOf (guildId);
    const canSee = m.tracks.some (hit) || hit (m.current) || hit (m.seekTrack);
    if (!canSee)
        return { ok: false, text: target
            ? '🈳 Нет ни треков от ' + u (target) + ', ни его играющего -- удалять нечего.'
            : '🈳 Треков без автора в очереди нет -- удалять нечего.' };
    const w = queuePurge (guildId, t => !hit (t));
    if (!w) return { ok: false, text: '🈳 Удалять нечего.' };
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'убрал из очереди треки ' +
        (target ? u (target) : 'без автора') + ' (' + w.goneQ + ')' +
        (w.playing ? ' -- и прервал его играющий трек' : (w.waiting ? ' -- и его ждущий трек' : '')));
    return {
        ok: true,
        text: '🧹 Убрал ' + w.goneQ + ' ' + plural (w.goneQ, 'трек', 'трека', 'треков') +
            (target ? ' от ' + u (target) : ' без автора') +
            ' (в очереди осталось ' + w.left + ').' +
            (w.playing ? ' **' + w.playing + '** прервал -- играю следующий.' : '') +
            (w.waiting ? ' Ждущий **' + w.waiting + '** тоже убран.' : ''),
    };
}

function queueClearConfirm (m, actorId, staff, opts = {})
{
    const leave = !!opts.leave;
    const own = queueClearPlan (m, actorId, 'own');
    const all = queueClearPlan (m, actorId, 'all');
    const amounts = plan =>
    {
        const p = [];
        if (plan.n) p.push (plan.n + ' ' + plural (plan.n, 'трек', 'трека', 'треков') + ' из очереди');
        if (plan.playing) p.push ('играющий **' + (plan.playing.title || 'трек') + '**');
        if (!plan.playing && plan.waiting) p.push ('ждущий **' + (plan.waiting.title || 'трек') + '**');
        return p.length ? p.join (' + ') : 'нечего';
    };
    const msgId = opts.msgId || '0';
    const cancel = new ButtonBuilder ()
        .setCustomId ('q:cq:x').setLabel ('✖ Отмена').setStyle (ButtonStyle.Secondary);
    if (!staff)
    {
        if (!own.any)
        {
            const empty = !m.tracks.length && !m.current && !m.seekTrack;
            const noAuth = m.tracks.filter (t => !byIdOf (t)).length;
            return {
                text: (empty ? '🈳 Очередь и так пуста -- чистить нечего.'
                             : '🈳 Своих треков в очереди нет -- убирать нечего.') +
                    (m.tracks.length ? '\nВ очереди ' + m.tracks.length + ' ' +
                        plural (m.tracks.length, 'чужой трек', 'чужих трека', 'чужих треков') +
                        ' -- ими распоряжаются админы и модеры' +
                        (noAuth ? '; у ' + noAuth + ' автор не записан (треки из старой базы) -- это тоже не моё' : '') + '.' : '') +
                    (leave && m.connection ? '\n_Вывести бота без чистки чужого -- `/leave` (очередь останется)._'
                                           : (leave ? '' : '\n_Выйти из канала можно командой `/leave`._')),
                rows: [new ActionRowBuilder ().addComponents (cancel)],
            };
        }
        const ownTotal = own.n + (own.playing ? 1 : 0) + (own.waiting ? 1 : 0);
        const rows = [new ActionRowBuilder ().addComponents
        (
            new ButtonBuilder ().setCustomId ('q:cq:own:' + msgId)
                .setLabel ('✅ Да, убрать: ' + plural (ownTotal, 'свой трек', 'своих трека', 'своих треков'))
                .setStyle (ButtonStyle.Danger),
            cancel
        )];
        return {
            text: (leave ? '⏹ Остановить музыку и убрать' : '🧹 Убрать') + ' **только свои** записи?\n' +
                '• уйдёт: ' + amounts (own) + '\n' +
                (own.left || (m.current && !own.playing)
                    ? 'Чужое останется: ' + (own.left ? own.left + ' ' + plural (own.left, 'трек', 'трека', 'треков') + ' в очереди' : 'играющий трек') +
                      (leave ? ' -- музыку не выключу и из канала не уйду.' : ' -- их не трогаю.')
                    : (leave ? 'Очередь станет пустой -- остановлю музыку и выйду из канала.'
                             : 'Очередь станет пустой -- будет тишина, из канала не уйду.')),
            rows: rows,
        };
    }
    const rows = [new ActionRowBuilder ().addComponents
    (
        new ButtonBuilder ().setCustomId ('q:cq:own:' + msgId).setLabel ('✅ Только мои')
            .setStyle (ButtonStyle.Secondary).setDisabled (!own.any),
        new ButtonBuilder ().setCustomId ('q:cq:all:' + msgId)
            .setLabel ('✅ Всю (' + (all.n + (all.playing ? 1 : 0)) + ')').setStyle (ButtonStyle.Danger),
        cancel
    )];
    return {
        text: (leave ? '⏹ **Стоп**: что убрать?' : '🧹 **Что убрать?**') + '\n' +
            '• **Только мои** -- ' + (own.any ? amounts (own) : 'нечего') + '\n' +
            '• **Вся очередь** -- ' + amounts (all) + '\n' +
            (leave ? '_Если после этого останутся чужие треки -- музыку не выключу и из канала не уйду._'
                   : '_Бот останется в канале -- уйти совсем: `⏹ Стоп` (или `/stop`)._'),
        rows: rows,
    };
}

function jumpGuard (m, n, cut, opts)
{
    const staff = !!(opts && opts.staff);
    const actorId = (opts && opts.actorId) ? String (opts.actorId) : '';
    if (staff) return null;
    const target = m.tracks[n - 1];
    if (!target || !isBy (target, actorId))
        return '🚫 **Прыгнуть можно только к своему треку** -- этот добавил ' +
            (byIdOf (target) ? u (byIdOf (target)) : 'не ты') + '.\n' +
            '_Свой трек подвинуть -- списком «🗂 Трек: подвинуть или убрать…» под `/queue`; ' +
            'чужие пропускают только админы и модеры._';
    if (cut)
    {
        const gone = m.tracks.slice (0, n - 1).concat (m.current ? [m.current] : []);
        const foe = gone.find (t => !isBy (t, actorId));
        if (foe)
            return '🚫 **Обрезать очередь может только админ/модер** -- перед №' + n +
                ' есть чужие треки (' + (byIdOf (foe) ? u (byIdOf (foe)) : 'без автора') + ').\n' +
                '_Обычному DJ остаётся «Срочный переход»: он ничего не теряет._';
    }
    if (!cut && m.current && !isBy (m.current, actorId))
        return '🚫 **Сейчас играет чужой трек** -- срочный переход его перебьёт, а это могут только админы и модеры.\n' +
            '_Дождись конца: свой трек встаёт играющим только тогда, когда в эфире уже твой._';
    return null;
}

function jumpMusic (guildId, n, cut, opts = {})
{
    const m = $music[guildId];
    if (!m || !m.tracks.length || !Number.isInteger (n) || n < 1 || n > m.tracks.length)
        return {
            ok: false,
            text: (m && m.tracks.length)
                ? '🤔 В очереди ' + m.tracks.length + ' треков -- номер от 1 до ' + m.tracks.length + '.'
                : '🈳 В очереди нет треков (играет только текущий).',
        };
    const denied = jumpGuard (m, n, cut, opts);
    if (denied) return { ok: false, text: denied };
    if (cut)
    {
        const gone = m.tracks.splice (0, n - 1);
        const wasCut = m.current;
        dropPreload (m);
        const targetCut = m.tracks[0];
        const cutTxt = (gone.length ? gone.length + ' ' + plural (gone.length, 'трек', 'трека', 'треков') + ' до него' : '') +
            (gone.length && wasCut ? ' и ' : '') + (wasCut ? 'прерванный **' + (wasCut.title || 'трек') + '**' : '');
        console.log ('[' + (d()) + '] [music] обрезал очередь до №' + n + ': ' + (targetCut.title || 'трек') +
            (cutTxt ? ' (убрано насовсем: ' + cutTxt + ')' : ''));
        if (wasCut) { m.skipRequested = true; m.player.stop (true); }
        else playNext (guildId);
        return {
            ok: true,
            text: '✂ Обрезал до №' + n + ': **' + (targetCut.title || 'трек') + '**' +
                (cutTxt ? '\n_Убрано насовсем: ' + cutTxt + '._' : ''),
        };
    }
    const res = queuePromote (guildId, n, (opts && opts.who) || '', opts);
    if (res.ok) res.text += '\n_Убрать всё до него насовсем -- вариант «Обрезать до трека»._';
    return res;
}

function jumpConfirm (n)
{
    const cancel = new ButtonBuilder ()
        .setCustomId ('q:jp:x').setLabel ('✖ Отмена').setStyle (ButtonStyle.Secondary);
    return {
        text: '⤴ **Перейти к №' + n + '?** Что сделать с тем, что стоит до него:\n' +
            '• **Срочный переход** -- цель играет сразу, а прерванный трек вернётся в очередь с того же места (в начало своей пачки -- пачки не разрываются).\n' +
            '• **Обрезать до трека** -- всё до цели (и прерванный) уйдёт **насовсем**.',
        rows: [new ActionRowBuilder ().addComponents
        (
            new ButtonBuilder ().setCustomId ('q:jp:u:' + n).setLabel ('⤴ Срочный переход').setStyle (ButtonStyle.Primary),
            new ButtonBuilder ().setCustomId ('q:jp:c:' + n).setLabel ('✂ Обрезать до трека').setStyle (ButtonStyle.Danger),
            cancel
        )],
    };
}

const JUMP_PICK = 25;

function jumpPickerText ()
{
    return '⤴ **Другой трек** -- выбери из списка (номера как в `/queue`):';
}

function jumpPickerRows (m, actorId, staff, from = 0)
{
    const nums = [];
    for (let i = 0; i < m.tracks.length; i++)
    {
        const t = m.tracks[i];
        if (!t) continue;
        if (!staff && !isBy (t, actorId)) continue;
        nums.push (i + 1);
    }
    if (!nums.length) return null;
    const pages = Math.max (1, Math.ceil (nums.length / JUMP_PICK));
    const p = Math.min (Math.max (0, Math.floor ((Number (from) || 0) / JUMP_PICK) || 0), pages - 1);
    const first = p * JUMP_PICK;
    const part = nums.slice (first, first + JUMP_PICK);
    const sel = new StringSelectMenuBuilder ()
        .setCustomId ('q:jsel')
        .setPlaceholder (pages > 1
            ? ('⤴ ' + (staff ? '' : 'Свои треки ') + (first + 1) + '–' + (first + part.length) + ' из ' + nums.length + '…')
            : (staff ? '⤴ Другой трек…' : '⤴ Другой трек (только свои)…'));
    sel.addOptions (part.map (n =>
        ({ label: ('№' + n + ' · ' + (m.tracks[n - 1].title || 'трек')).slice (0, 100), value: String (n) })));
    const row = new ActionRowBuilder ().addComponents (sel);
    const btns = [];
    if (pages > 1)
    {
        btns.push (new ButtonBuilder ()
            .setCustomId ('q:jpage:' + (first - JUMP_PICK)).setLabel ('◀ Раньше')
            .setStyle (ButtonStyle.Secondary).setDisabled (p <= 0));
        btns.push (new ButtonBuilder ()
            .setCustomId ('q:jpage:' + (first + JUMP_PICK)).setLabel ('Позже ▶')
            .setStyle (ButtonStyle.Secondary).setDisabled (p >= pages - 1));
    }
    btns.push (new ButtonBuilder ().setCustomId ('q:jclose').setLabel ('✖ Закрыть').setStyle (ButtonStyle.Secondary));
    return [row, new ActionRowBuilder ().addComponents (...btns)];
}

function queueClear (guildId, who, opts = {})
{
    const leave = !!opts.leave;
    const scope = (opts.scope === 'all') ? 'all' : 'own';
    const m = musicOf (guildId);
    const plan = queueClearPlan (m, opts.actorId, scope);
    if (!plan.any)
    {
        if (leave && m.connection && !m.tracks.length && !m.current && !m.seekTrack)
        {
            destroyMusic (guildId, {forget: true, who});
            console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'остановил бота: очередь была пуста, вышел из канала');
            return { ok: true, text: '⏹ Очередь и так пуста -- вышел из голосового канала.' };
        }
        return { ok: false, text: scope === 'all'
            ? '🈳 Очередь и так пуста -- чистить нечего.'
            : '🈳 Своих треков в очереди нет -- убирать нечего.' +
              (m.tracks.length ? ' Там ' + m.tracks.length + ' ' +
                  plural (m.tracks.length, 'чужой трек', 'чужих трека', 'чужих треков') +
                  ' -- ими распоряжаются админы и модеры.' : '') };
    }
    let w;
    if (scope === 'all')
    {
        const wi = queueWipe (guildId);
        w = { goneQ: wi.n, playing: wi.playing, waiting: wi.waiting, left: 0 };
    }
    else w = queuePurge (guildId, t => !isBy (t, opts.actorId));
    let left = false;
    if (leave && (scope === 'all' || (!m.tracks.length && !m.current && !m.seekTrack)))
    {
        destroyMusic (guildId, {forget: true, who});
        left = true;
    }
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    const head = scope === 'own'
        ? (w.goneQ ? 'убрал свои треки из очереди (' + w.goneQ + ')'
                   : 'убрал своё из очереди (своих треков в ней не было)')
        : ((leave ? 'остановил и убрал очередь (' : 'очистил очередь (') + w.goneQ + ')');
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + head +
        (w.playing ? ' и снял играющий трек' : (w.waiting ? ' и снял ждущий трек' : '')) +
        (w.left ? ', в очереди осталось ' + w.left : '') +
        (left ? ', вышел из канала' : ''));
    const bits = [];
    if (w.goneQ) bits.push (w.goneQ + ' ' + plural (w.goneQ, 'трек', 'трека', 'треков'));
    if (w.playing) bits.push ('играющий **' + w.playing + '**' +
        ((m.current || m.seekTrack || m.tracks.length) ? ' -- играю следующий' : ' -- тишина'));
    else if (w.waiting) bits.push ('ждущий **' + w.waiting + '**');
    return {
        ok: true,
        text: (scope === 'own' ? '🧹 Убрал свои' : (leave ? '⏹ Остановил и очистил' : '🧹 Очистил')) +
            (scope === 'own' && !w.goneQ ? ' (в очереди своих не было)' : '') +
            (bits.length ? ': ' + bits.join (' + ') + '.' : '.') +
            (w.left ? ' В очереди осталось ' + w.left + ' -- музыку не выключаю.' : '') +
            (left ? ' Вышел из канала.' : ''),
    };
}

const FILTER_TEXT_MAX = 60;
const FILTER_ASK_MS = 5 * 60 * 1000;
const FILTER_PREVIEW_N = 5;
let $filterToken = 0;

function filterTextOf (s)
{
    return String (s === undefined || s === null ? '' : s).replace (/\s+/g, ' ').trim ().slice (0, FILTER_TEXT_MAX);
}
function filterMatch (t, text)
{
    const q = String (text || '').toLowerCase ();
    if (!q || !t) return false;
    return String (t.title || '').toLowerCase ().includes (q);
}
function filterPlan (m, mode, text, scope, actorId)
{
    const keepMode = (mode === 'keep');
    const inScope = t => !!t && (scope === 'all' || isBy (t, actorId));
    const hit = t => inScope (t) && filterMatch (t, text);
    const keep = keepMode ? (t => !inScope (t) || filterMatch (t, text)) : (t => !hit (t));
    const dropped = m.tracks.filter (t => !keep (t));
    const gone = dropped.length;
    const playing = (m.current && !keep (m.current)) ? m.current : null;
    const waiting = (!playing && m.seekTrack && !keep (m.seekTrack)) ? m.seekTrack : null;
    return {
        keep: keep, mode: keepMode ? 'keep' : 'remove', scope: (scope === 'all') ? 'all' : 'mine',
        gone: gone, playing: playing, waiting: waiting,
        matchN: m.tracks.filter (hit).length,
        goneTitles: dropped.slice (0, FILTER_PREVIEW_N).map (t => t.title || 'трек'),
        left: m.tracks.length - gone, total: m.tracks.length,
        any: !!(gone || playing || waiting),
    };
}

function filterGoneLines (plan)
{
    const out = [];
    plan.goneTitles.forEach ((t, i) => out.push ('  ' + (i + 1) + '. ' + clipped (t, 70)));
    if (plan.gone > plan.goneTitles.length)
        out.push ('  …и ещё ' + (plan.gone - plan.goneTitles.length));
    return out;
}

function filterTitlesText (plan)
{
    const shown = plan.goneTitles.slice (0, 3).map (t => clipped (t, 40));
    return shown.join (' · ') + ((plan.gone > shown.length) ? ' · …' : '');
}

function filterNothingText (plan, text)
{
    if (plan.mode === 'keep')
        return (plan.scope === 'all')
            ? '_Убирать нечего: в очереди и так нет ничего, кроме треков с «' + text + '»._'
            : '_Убирать нечего: твоих треков в очереди нет (чужие не трогаю)._';
    return '_Убирать нечего: треков с «' + text + '» ' +
        (plan.scope === 'all' ? 'в очереди нет' : 'среди твоих нет') + ' -- очередь как есть._';
}

function queueFilterConfirm (m, mode, text, scope, actorId, msgId)
{
    const plan = filterPlan (m, mode, text, scope, actorId);
    const keepMode = (plan.mode === 'keep');
    const head = '🧽 **Фильтр очереди:** ' + (keepMode ? 'оставить ТОЛЬКО треки с «' : 'убрать треки с «') +
        text + '»' + (plan.scope === 'all' ? ' (во всех треках)' : ' (только твои)');
    if (!plan.any)
        return {
            text: head + '\n' + filterNothingText (plan, text),
            rows: [new ActionRowBuilder ().addComponents
            (
                new ButtonBuilder ().setCustomId ('q:fl:k').setLabel ('✖ Понятно').setStyle (ButtonStyle.Secondary)
            )],
        };
    const token = String (++$filterToken);
    m.filterAsk = { token: token, mode: plan.mode, text: text, scope: plan.scope,
                    actorId: String (actorId), at: Date.now (),
                    msgId: String (msgId || '0') };
    const total = plan.gone + (plan.playing ? 1 : 0) + (plan.waiting ? 1 : 0);
    const lines = [];
    if (keepMode)
        lines.push ('• найдено: ' + plan.matchN + ' ' + plural (plan.matchN, 'трек', 'трека', 'треков') +
            ' -- они и останутся');
    if (plan.gone)
        lines.push ('• уйдёт: ' + plan.gone + ' ' + plural (plan.gone, 'трек', 'трека', 'треков'));
    for (const l of filterGoneLines (plan)) lines.push (l);
    if (plan.playing)
        lines.push ('• играющий прервётся: **' + (plan.playing.title || 'трек') + '** -- сразу пойдёт следующий');
    else if (plan.waiting)
        lines.push ('• ждущий уйдёт: **' + (plan.waiting.title || 'трек') + '**');
    lines.push ('• останется в очереди: ' + plan.left);
    return {
        text: head + '\n' + lines.join ('\n') +
            '\n_Действие необратимое. Вернуть трек можно только заново ( `/play` или «📜 Все треки» в `/history` )._',
        rows: [new ActionRowBuilder ().addComponents
        (
            new ButtonBuilder ().setCustomId ('q:fl:c:' + token)
                .setLabel (('🗑 Да, убрать: ' + total + ' ' + plural (total, 'трек', 'трека', 'треков')).slice (0, 80))
                .setStyle (ButtonStyle.Danger),
            new ButtonBuilder ().setCustomId ('q:fl:x').setLabel ('✖ Отмена').setStyle (ButtonStyle.Secondary)
        )],
    };
}

function queueFilter (guildId, opts)
{
    const m = musicOf (guildId);
    const text = filterTextOf (opts.text);
    if (!text) return { ok: false, text: '🤔 Пустая подстрока -- искать нечего.' };
    const plan = filterPlan (m, opts.mode, text, opts.scope, opts.actorId);
    if (!plan.any)
        return { ok: false, text: '🈳 ' + filterNothingText (plan, text) };
    const w = queuePurge (guildId, plan.keep);
    if (!w) return { ok: false, text: '🈳 Убирать нечего -- очередь уже другая (может, её убрали с тех пор).' };
    console.log ('[' + (d()) + '] [music] ' + whoText (opts.who) +
        (plan.mode === 'keep' ? 'оставил только треки по «' + text + '»' : 'убрал треки по «' + text + '»') +
        ' (' + (plan.scope === 'all' ? 'вся очередь' : 'только его треки') + '): убрал ' + w.goneQ +
        (w.playing ? ' и снял играющий трек' : (w.waiting ? ' и снял ждущий трек' : '')) +
        ', осталось ' + w.left);
    const bits = [];
    if (w.goneQ)
        bits.push (w.goneQ + ' ' + plural (w.goneQ, 'трек', 'трека', 'треков') +
            (plan.goneTitles.length ? ' (' + filterTitlesText (plan) + ')' : ''));
    if (w.playing) bits.push ('играющий **' + w.playing + '**' + (w.left ? ' -- играю следующий' : ' -- тишина'));
    else if (w.waiting) bits.push ('ждущий **' + w.waiting + '**');
    return {
        ok: true,
        text: (plan.mode === 'keep' ? '🧽 Оставил только «' + text + '»' : '🧽 Убрал по «' + text + '»') +
            (bits.length ? ': ' + bits.join (' + ') + '.' : '.') +
            (w.left ? ' В очереди осталось ' + w.left + '.' : ' Очередь пуста.'),
    };
}

function filterModal (msgId)
{
    return new ModalBuilder ()
        .setCustomId ('q:flt:' + (String (msgId || '0').replace (/\D+/g, '') || '0'))
        .setTitle ('Фильтр очереди по названию')
        .addLabelComponents
        (
            new LabelBuilder ().setLabel ('Подстрока в названии трека')
                .setDescription ('Без учёта регистра')
                .setTextInputComponent (new TextInputBuilder ()
                    .setCustomId ('text').setStyle (TextInputStyle.Short)
                    .setRequired (true).setMaxLength (FILTER_TEXT_MAX)
                    .setPlaceholder ('например: KARA')),
            new LabelBuilder ().setLabel ('Что сделать с найденными')
                .setStringSelectMenuComponent (new StringSelectMenuBuilder ().setCustomId ('mode')
                    .setRequired (true).addOptions
                    (
                        { label: '🗑 Удалить найденные', value: 'remove', default: true },
                        { label: '✅ Оставить только найденные', value: 'keep' }
                    )),
            new LabelBuilder ().setLabel ('Где искать')
                .setStringSelectMenuComponent (new StringSelectMenuBuilder ().setCustomId ('scope')
                    .setRequired (true).addOptions
                    (
                        { label: '👥 Во всех треках', value: 'all', default: true },
                        { label: '🙋 Только в моих', value: 'mine' }
                    ))
        );
}

function queueAuthorList (m, actorId, staff)
{
    const map = new Map ();
    let noAuthor = 0;
    const add = t =>
    {
        if (!t) return;
        const id = byIdOf (t);
        if (!id) { noAuthor++; return; }
        let o = map.get (id);
        if (!o) { o = { id: id, name: byNameOf (t), n: 0 }; map.set (id, o); }
        o.n++;
    };
    add (m.current);
    for (const t of m.tracks) add (t);
    if (!staff) return [...map.values ()].filter (o => o.id === String (actorId));
    const list = [...map.values ()].sort ((a, b) => b.n - a.n || String (a.name).localeCompare (String (b.name)));
    if (noAuthor) list.push ({ id: '', name: 'без автора', n: noAuthor, none: true });
    return list;
}

function queueRemove (guildId, n, who, opts = {})
{
    const m = musicOf (guildId);
    if (!m.tracks.length) return { ok: false, text: '🈳 В очереди нет треков (играет только текущий).' };
    if (!Number.isInteger (n) || n < 1 || n > m.tracks.length)
        return { ok: false, text: '🤔 В очереди ' + m.tracks.length + ' ' +
            plural (m.tracks.length, 'трек', 'трека', 'треков') + ' -- номер от 1 до ' + m.tracks.length + '.' };
    if (!opts.staff && !isBy (m.tracks[n - 1], opts.actorId))
        return { ok: false, text: ownOnlyText ('Убрать трек из очереди', m.tracks[n - 1]) };
    const gone = m.tracks.splice (n - 1, 1)[0];
    dropPreload (m);
    startPreload (guildId);
    saveMusicState (guildId);
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'убрал из очереди №' + n + ': ' + (gone.title || 'трек'));
    return { ok: true, text: '🗑 Убрал №' + n + ': **' + (gone.title || 'трек') + '**' +
        (m.tracks.length ? ' (в очереди осталось ' + m.tracks.length + ')' : ' (очередь пуста)') };
}

function queueMove (guildId, n, to, who, opts = {})
{
    const m = musicOf (guildId);
    const total = m.tracks.length;
    if (to === 0) return queuePromote (guildId, n, who, opts);
    if (n === 0) return queueDemote (guildId, to, who, opts);
    if (!Number.isInteger (n) || !Number.isInteger (to) || n < 1 || to < 1 || n > total || to > total)
        return { ok: false, text: '🤔 В очереди ' + total + ' ' + plural (total, 'трек', 'трека', 'треков') +
            (total ? ' -- номера от 1 до ' + total : ' -- двигать нечего') +
            (m.current ? ', а №0 -- то, что играет сейчас' : '') + '.' };
    if (n === to) return { ok: false, text: '↔️ №' + n + ' уже на этом месте.' };
    if (total < 2)
        return { ok: false, text: '↔️ Для перестановки нужно хотя бы два трека в очереди' +
            (m.current ? ' (сейчас играет только **' + (m.current.title || 'трек') + '**).' : '.') };
    if (!opts.staff && !isBy (m.tracks[n - 1], opts.actorId))
        return { ok: false, text: ownOnlyText ('Переставить трек', m.tracks[n - 1]) };
    const moved = m.tracks[n - 1];
    const dry = m.tracks.slice ();
    dry.splice (n - 1, 1);
    let idx = to - 1;
    let slid = false;
    if (!opts.staff)
    {
        if (to < n && !isBy (m.tracks[to - 1], opts.actorId))
            return { ok: false, text: '🚫 **Вверх -- только на своё же место.**\n' +
                '_(№' + to + ' -- трек ' + (byNameOf (m.tracks[to - 1]) ? 'от **' + byNameOf (m.tracks[to - 1]) + '**' : 'без автора') +
                ': поднять свой трек мимо чужого нельзя -- чужие уезжали бы вниз от каждого нажатия, ' +
                'и слушателям остальных авторов своих песен было бы не дождаться.\n' +
                'Вниз двигать -- можно свободно (чужие от этого только ближе к эфиру), а с другим ' +
                'своим же треком можно и меняться местами._' };
        const myKey = qKey (moved);
        const room = idx > 0 ? qKey (dry[idx - 1]) : null;
        while (idx < dry.length && room !== null && qKey (dry[idx]) === room && room !== myKey)
        {
            idx++;
            slid = true;
        }
    }
    m.tracks = dry.slice (0, idx).concat ([moved], dry.slice (idx));
    dropPreload (m);
    startPreload (guildId);
    saveMusicState (guildId);
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'переставил в очереди №' + n + ' -> №' + to + ': ' + (moved.title || 'трек'));
    return {
        ok: true,
        to: idx + 1,
        text: '↔️ **' + (moved.title || 'трек') + '**: №' + n + ' -> №' + (idx + 1) +
            (m.current ? ' (сейчас играет **' + (m.current.title || 'трек') + '**)' : '') +
            (slid ? '\n_Внутрь чужой пачки не ставлю: встал сразу за ней._' : '') +
            '\n' + queuePreview (m),
    };
}

function queuePromote (guildId, n, who, opts = {})
{
    const m = musicOf (guildId);
    const total = m.tracks.length;
    if (!total || !Number.isInteger (n) || n < 1 || n > total)
        return { ok: false, text: total
            ? '🤔 В очереди ' + total + ' ' + plural (total, 'трек', 'трека', 'треков') + ' -- номер от 1 до ' + total + '.'
            : '🈳 В очереди нет треков -- ставить играющим нечего' +
              (m.current ? ' (играет **' + (m.current.title || 'трек') + '**).' : '.') };
    const denied = jumpGuard (m, n, false, opts);
    if (denied) return { ok: false, text: denied };
    const target = m.tracks[n - 1];
    const key = qKey (target);
    const was = m.current;
    const wasAt = was ? Math.max (0, Math.round (playedMsOf (m) / 1000)) : 0;
    const iT = m.tracks.indexOf (target);
    const without = m.tracks.slice (0, iT).concat (m.tracks.slice (iT + 1));
    const run = without.filter (t => qKey (t) === key);
    const rest = without.filter (t => qKey (t) !== key);
    const after = run.concat (rest);
    if (was)
    {
        was.seek = wasAt;
        after.splice (qRunHead (after, qKey (was)), 0, was);
    }
    m.tracks = [target].concat (after);
    dropPreload (m);
    const wasPos = was ? (after.indexOf (was) + 1) : 0;
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'поставил играющим №' + n + ': ' + (target.title || 'трек') +
        (run.length ? ' (пачка автора целиком: ' + (run.length + 1) + ' шт.)' : '') +
        (was ? ' (прерванный ' + (was.title || 'трек') + ' -- в очередь, №' + wasPos + ', с ' + fmtDur (wasAt) + ')' : '') +
        ' -- это №0 плейлиста');
    if (was) { m.skipRequested = true; if (m.player) m.player.stop (true); }
    else playNext (guildId);
    return {
        ok: true,
        to: 0,
        text: '▶ **Играю №' + n + ':** ' + (target.title || 'трек') + byLabel (target) +
            (run.length ? '\n_Пачка этого автора поехала наверх целиком (' + (run.length + 1) + ' ' +
                plural (run.length + 1, 'трек', 'трека', 'треков') + ') -- пачки не разрываются._' : '') +
            (was ? '\n_Прерванный **' + (was.title || 'трек') + '** встал в очередь, №' + wasPos +
                ', с ' + fmtDur (wasAt) + '._' : ''),
    };
}

function queueDemote (guildId, to, who, opts = {})
{
    const m = musicOf (guildId);
    const was = m.current;
    if (!was) return { ok: false, text: '🤷 Сейчас ничего не играет -- снимать с эфира некого.' };
    if (!opts.staff && byIdOf (was) && !isBy (was, opts.actorId))
        return { ok: false, text: ownOnlyText ('Снять с эфира', was) };
    if (!m.tracks.length)
        return { ok: false, text: '🤔 В очереди больше нет треков -- снимать некуда: очередь станет пустой.\n' +
            '_Остановить музыку и уйти -- `/stop`._' };
    const wasAt = Math.max (0, Math.round (playedMsOf (m) / 1000));
    const key = qKey (was);
    const newCur = m.tracks[0];
    const arr = m.tracks.slice (1);
    let idx = qRunHead (arr, key);
    if (Number.isInteger (to) && to >= 1 && to <= arr.length)
    {
        const j = to - 1;
        const leftKey = (j > 0) ? qKey (arr[j - 1]) : null;
        if (!opts.staff && qWouldSplit (arr, j, key, leftKey))
            return { ok: false, text: qSplitText (qKey (arr[j]), '**' + (was.title || 'трек') + '**') };
        idx = j;
    }
    was.seek = wasAt;
    arr.splice (idx, 0, was);
    m.tracks = [newCur].concat (arr);
    dropPreload (m);
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'снял с эфира и вернул в очередь №' +
        (idx + 1) + ': ' + (was.title || 'трек') + ' (с ' + fmtDur (wasAt) + ') -- играю: ' + (newCur.title || 'трек'));
    m.skipRequested = true;
    if (m.player) m.player.stop (true);
    return {
        ok: true,
        to: idx + 1,
        text: '⏏ **Снял с эфира:** ' + (was.title || 'трек') + ' -- вернул в очередь, №' + (idx + 1) +
            ', с ' + fmtDur (wasAt) + '; теперь играет **' + (newCur.title || 'трек') + '**' +
            '\n' + queuePreview (m),
    };
}

function queuePush (guildId, targetId, who)
{
    const m = musicOf (guildId);
    const total = m.tracks.length;
    const whoTxt = targetId ? u (targetId) : 'без автора';
    const whoWhat = targetId ? 'Треки ' + u (targetId) : 'Треки без автора';
    const same = t => t && String (t.byId || '') === String (targetId);
    if (!total)
        return { ok: false, text: '🈳 В очереди нет треков' +
            (m.current ? ' (играет только **' + (m.current.title || 'трек') + '**).' : ' -- двигать нечего.') };
    const mine = m.tracks.filter (same);
    if (!mine.length)
        return { ok: false, text: '🤔 В очереди нет ' + (targetId ? 'треков от ' + u (targetId) : 'треков без автора') + '.' +
            (m.current && same (m.current) ? ' Его трек и так играет прямо сейчас.' : '') +
            (m.tracks.some (t => !t.byId) && targetId
                ? '\n(у части треков автор не записан -- это старые записи)' : '') };
    const curSame = !!m.current && same (m.current);
    const curKey = m.current ? qKey (m.current) : null;
    const rest = m.tracks.filter (t => !same (t));
    let rest2 = rest;
    let glued = false;
    if (m.current)
    {
        const run = rest.filter (t => qKey (t) === curKey);
        if (run.length && qRunLen (rest, 0, curKey) !== run.length)
        {
            rest2 = run.concat (rest.filter (t => qKey (t) !== curKey));
            glued = true;
        }
    }
    const at = (m.current && !curSame) ? qRunLen (rest2, 0, curKey) : 0;
    const next = rest2.slice (0, at).concat (mine, rest2.slice (at));
    if (next.length === m.tracks.length && next.every ((t, i) => t === m.tracks[i]))
        return { ok: true, text: '✅ ' + whoWhat + ' и так наверху (' + mine.length + ' ' +
            plural (mine.length, 'трек', 'трека', 'треков') + ')' +
            (m.current ? ' -- сразу за играющим треком.' : '.') };
    m.tracks = next;
    dropPreload (m);
    startPreload (guildId);
    saveMusicState (guildId);
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    const titles = mine.slice (0, 3).map (t => '**' + (t.title || 'трек') + '**').join (', ');
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'подвинул наверх пачку ' +
        (curSame ? '<играет сейчас + сломанную пачку склеил> + ' : '') + mine.length + ' шт. (' + whoTxt + ')' +
        (at ? ' -- после пачки играющего трека' : '') + (glued ? ' (пачка играющего была разорвана -- склеил)' : ''));
    return {
        ok: true,
        text: '🔄 **Подвинул наверх** ' + mine.length + ' ' + plural (mine.length, 'трек', 'трека', 'треков') +
            ' (' + whoTxt + '):' + (titles ? ' ' + titles + (mine.length > 3 ? ' и ещё ' + (mine.length - 3) : '') : '') +
            (curSame ? '\n_Играющий трек остался на месте -- он №0, а эти встали сразу за ним._' : '') +
            (at ? '\n_Выше без номера не ставлю: играет трек ' + qWhoText (curKey) +
                ' -- встал бы посреди его пачки. Место выбирается номером пачки: `/push number:N` (только админы и модеры)._' : '') +
            (glued ? '\n_Заодно склеил пачку ' + qWhoText (curKey) + ': её треки были вразброс._' : '') +
            '\n' + queuePacksText (m) + '\n' + queuePreview (m),
    };
}

function queueMovePack (guildId, moveId, dest, who, opts = {})
{
    const m = musicOf (guildId);
    const key = String (moveId === undefined || moveId === null ? '' : moveId);
    const whoTxt = key ? u (key) : 'треки без автора';
    const same = t => !!t && qKey (t) === key;
    const mine = m.tracks.filter (same);
    if (!mine.length)
        return { ok: false, text: '🤔 В очереди нет треков от ' + whoTxt + '.' +
            (m.current && same (m.current) ? ' Его трек и так играет прямо сейчас -- нечего ему выбирать место.' : '') };
    const packs = queuePacks (m);
    const destNo = Number.isInteger (dest) ? dest : null;
    let target = null;
    if (destNo !== null)
    {
        if (destNo < 1 || destNo > packs.length)
            return { ok: false, text: '🤔 Пачек в плейлисте ' + packs.length + ' -- номер от 1 до ' + packs.length + '.\n' +
                queuePacksText (m) };
        target = packs[destNo - 1];
    }
    else
    {
        const dstKey = String (dest === undefined || dest === null ? '' : dest);
        target = packs.find (p => p.key === dstKey) || null;
    }
    if (!target)
        return { ok: false, text: '🤔 Этой пачки в плейлисте уже нет -- выбери место заново.\n' + queuePacksText (m) };
    const targetTxt = (destNo !== null ? '№' + destNo + ' ' : '') + '(' + qWhoText (target.key) + ')';
    if (target.key === key)
        return { ok: true, text: '✅ Пачка ' + whoTxt + ' и так стоит на этом месте (' + mine.length + ' ' +
            plural (mine.length, 'трек', 'трека', 'треков') + ').\n' + queuePacksText (m) };
    const air = !!m.current && qKey (m.current) === target.key;
    const rest = m.tracks.filter (t => !same (t));
    let at = 0;
    if (!air && target.first >= 0)
        for (let i = 0; i < target.first; i++) if (!same (m.tracks[i])) at++;
    const next = rest.slice (0, at).concat (mine, rest.slice (at));
    let was = null, wasAt = 0, wasBelow = 0;
    if (air)
    {
        was = m.current;
        wasAt = Math.max (0, Math.round (playedMsOf (m) / 1000));
        was.seek = wasAt;
        wasBelow = Math.min (mine.length, next.length);
        next.splice (wasBelow, 0, was);
    }
    if (!was && next.length === m.tracks.length && next.every ((t, i) => t === m.tracks[i]))
        return { ok: true, text: '✅ Пачка ' + whoTxt + ' и так стоит прямо перед пачкой ' + targetTxt + '.\n' +
            queuePacksText (m) };
    m.tracks = next;
    dropPreload (m);
    startPreload (guildId);
    saveMusicState (guildId);
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    if (was)
    {
        m.skipRequested = true;
        if (m.player) m.player.stop (true);
    }
    const headTxt = mine.slice (0, 3).map (t => '**' + (t.title || 'трек') + '**').join (', ') +
        (mine.length > 3 ? ' и ещё ' + (mine.length - 3) : '');
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'подвинул пачку ' + whoTxt + ' (' + mine.length +
        ' шт.) на место пачки ' + targetTxt +
        (air ? ' -- это эфир: играю ' + (mine[0].title || 'трек') + ', прерванный ' + (was.title || 'трек') +
            ' встал №' + (wasBelow + 1) + ' с ' + fmtDur (wasAt) : ' -- пачка целиком, эфир не трогал'));
    return {
        ok: true,
        text: '🔄 **Пачка ' + whoTxt + ' -- на месте пачки ' + targetTxt + ':** ' + mine.length + ' ' +
            plural (mine.length, 'трек', 'трека', 'треков') + ' собраны вместе (' + headTxt + ')' +
            (air
                ? '\n▶ **Это эфир:** играет первый трек этой пачки, а **' + (was.title || 'прерванный трек') +
                  '** встал под неё, с ' + fmtDur (wasAt) + ' -- вернётся в свою пачку.'
                : '\n_Пачка ' + qWhoText (target.key) + ' сдвинулась вниз целиком, играющий трек не трогал._') +
            '\n' + queuePacksText (m) + '\n' + queuePreview (m),
    };
}

const PACK_PICK = 25;

function packPickView (m, moveId, msgId, from = 0)
{
    const key = String (moveId === undefined || moveId === null ? '' : moveId);
    const packs = queuePacks (m);
    const opts = packs.map ((p, i) => ({ p: p, no: i + 1 })).filter (o => o.p.key !== key);
    const head = '🔄 **Подвинуть пачку ' + qWhoText (key) + ' (' + m.tracks.filter (t => qKey (t) === key).length +
        ' в очереди) -- выбери МЕСТО:**';
    if (!opts.length)
        return { text: head + '\n📚 Других пачек в плейлисте нет -- двигать некуда (все треки одного автора).', rows: [] };
    const pages = Math.max (1, Math.ceil (opts.length / PACK_PICK));
    const p = Math.min (Math.max (0, Math.floor ((Number (from) || 0) / PACK_PICK) || 0), pages - 1);
    const first = p * PACK_PICK;
    const part = opts.slice (first, first + PACK_PICK);
    const sel = new StringSelectMenuBuilder ()
        .setCustomId ('q:daps:' + (key || '0') + ':' + (msgId || '0'))
        .setPlaceholder (pages > 1
            ? ('🔄 Место: ' + (first + 1) + '–' + (first + part.length) + ' из ' + opts.length + '…')
            : '🔄 На чьё место встать…');
    sel.addOptions (part.map (o =>
    ({
        label: ('№' + o.no + ' · 👤 ' + (o.p.name || 'без автора')).slice (0, 100),
        description: (o.p.playing
            ? '▶ играет сейчас: начнётся сразу, их трек вернётся в очередь'
            : (o.p.n + ' ' + plural (o.p.n, 'трек', 'трека', 'треков') + ' -- встанешь прямо перед ними')).slice (0, 100),
        value: (o.p.key || '0'),
    })));
    const rows = [new ActionRowBuilder ().addComponents (sel)];
    const btns = [];
    if (pages > 1)
    {
        btns.push (new ButtonBuilder ()
            .setCustomId ('q:dapp:' + (key || '0') + ':' + (msgId || '0') + ':' + (first - PACK_PICK))
            .setLabel ('◀ Раньше').setStyle (ButtonStyle.Secondary).setDisabled (p <= 0));
        btns.push (new ButtonBuilder ()
            .setCustomId ('q:dapp:' + (key || '0') + ':' + (msgId || '0') + ':' + (first + PACK_PICK))
            .setLabel ('Позже ▶').setStyle (ButtonStyle.Secondary).setDisabled (p >= pages - 1));
    }
    btns.push (new ButtonBuilder ().setCustomId ('q:dacl').setLabel ('✖ Закрыть').setStyle (ButtonStyle.Secondary));
    rows.push (new ActionRowBuilder ().addComponents (...btns));
    return {
        text: head + '\n_Пачка встанет ВМЕСТО выбранной, а та сдвинется вниз целиком' +
            (pages > 1 ? ' (страница ' + (p + 1) + ' из ' + pages + ')' : '') + '._',
        rows: rows,
    };
}

const SEEK_MAX_INPUT = 6 * 3600;
function parseSeekTime (raw)
{
    const s = String (raw === undefined || raw === null ? '' : raw).trim ().replace (/\s+/g, '');
    if (!/^\d{1,2}(?::\d{1,2}){0,2}$/.test (s)) return null;
    const parts = s.split (':').map (p => parseInt (p, 10));
    if (parts.some (n => !Number.isFinite (n))) return null;
    let sec = 0;
    for (const p of parts) sec = sec * 60 + p;
    return sec > SEEK_MAX_INPUT ? null : sec;
}

function seekMusic (guildId, sec, who, opts = {})
{
    const m = musicOf (guildId);
    if (!m.current) return { ok: false, text: '🤷 Сейчас ничего не играет -- перематывать нечего.' };
    const t = m.current;
    const title = '**' + (t.title || 'трек') + '**';
    if (!opts.staff && byIdOf (t) && !isBy (t, opts.actorId))
        return { ok: false, text: ownOnlyText ('Перематывать', t) };
    if (t.isLive)
    {
        m.skipRequested = true;
        m.streamRetries = 0;
        m.playedMs = 0;
        m.playingSince = null;
        m.current = null;
        m.tracks.unshift (t);
        m.seekTrack = null;
        m.seekSec = 0;
        dropPreload (m);
        saveMusicState (guildId);
        try { m.player.stop (true); } catch {}
        console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'переходит к прямому эфиру: ' + (t.title || 'трек'));
        return { ok: true, text: '🔴 Это прямой эфир -- позиции у него нет. Перехожу к тому, что идёт сейчас: ' + title };
    }
    const dur = Number (t.duration) > 0 ? Number (t.duration) : 0;
    m.seekReturnSec = Math.max (0, Math.round (playedMsOf (m) / 1000));
    let to = Math.max (0, Math.round (sec));
    if (dur) to = Math.min (to, Math.max (0, dur - 5));
    m.skipRequested = true;
    m.streamRetries = 0;
    m.playedMs = to * 1000;
    m.playingSince = null;
    m.current = null;
    m.tracks.unshift (t);
    m.seekTrack = t;
    m.seekSec = to;
    dropPreload (m);
    saveMusicState (guildId);
    try { m.player.stop (true); } catch {}
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'перемотал трек на ' + fmtDur (to) + ': ' + (t.title || 'трек'));
    return {
        ok: true,
        text: '⏩ ' + title + ' -- продолжаю с `' + fmtDur (to) + '`' +
            (dur ? ' (из ' + fmtDur (dur) + ')' : '') +
            '\n_Если источник не умеет навигацию, продолжу с того же места, где играло, -- в логе это видно._',
    };
}

function queueSeekBy (guildId, delta, who, opts = {})
{
    const m = musicOf (guildId);
    if (!m.current)
        return { ok: false, text: '🤷 Сейчас ничего не играет -- перематывать нечего.' };
    if (!opts.staff && byIdOf (m.current) && !isBy (m.current, opts.actorId))
        return { ok: false, text: ownOnlyText ('Перематывать', m.current) };
    if (m.current.isLive)
        return { ok: false, text: '🔴 Это прямой эфир -- позиции у него нет (`/seek 0` -- перейти к живому краю).' };
    const at = Math.max (0, Math.round (playedMsOf (m) / 1000));
    const res = seekMusic (guildId, at + delta, who, opts);
    if (!res.ok) return res;
    return { ok: true, text: res.text + '\n_Место, где играло: `' + fmtDur (at) + '`._' };
}

function playWayShort (m, guildId)
{
    // чем именно сейчас играет трек: свои файлы против потока и его маршрута -- словами, без адресов
    const t = m && (m.current || m.seekTrack);
    if (!t) return '';
    if (t.isLive) return 'потоком (эфир)';
    if (MUSIC_CACHE && cacheFind (t)) return 'с диска (своя копия)';
    if (m.partFile) return 'со своей записи';
    const u = routeUseOf (guildId);
    if (u && u.kind === 'stream' && u.proxy) return 'потоком (прокси)';
    if (u && u.kind === 'stream') return 'потоком (напрямую)';
    return 'потоком';
}
function playWayText (m, guildId, viewerId)
{
    const t = m && (m.current || m.seekTrack);
    if (!t) return '';
    const owner = isBotOwner (viewerId);
    if (t.isLive)
        return '▶ Путь звука: прямой эфир, играю потоком' + (owner ? ' (у эфира нет ни копии, ни навигации)' : '');
    if (MUSIC_CACHE && cacheFind (t))
        return '▶ Путь звука: играю со своей копии на диске -- YouTube в проигрывании не участвует';
    if (m.partFile)
        return '▶ Путь звука: начал со своей записи на диске, дальше беру потоком';
    const u = routeUseOf (guildId);
    if (u && u.kind === 'stream' && u.proxy)
        return '▶ Путь звука: потоком от YouTube через прокси' + (owner ? '' : ' -- адрес видит только владелец');
    return '▶ Путь звука: потоком от YouTube' + ((u && u.kind === 'stream') ? ' напрямую (без прокси)' : '');
}

function queueHeadText (m)
{
    if (m.current)
    {
        const posSec = Math.max (0, Math.floor (playedMsOf (m) / 1000));
        const posTxt = s => (s > 0 ? fmtDur (s) : '0:00');
        const pos = m.current.isLive
            ? ' `🔴 в эфире ' + posTxt (posSec) + '`'
            : (m.current.duration > 0
                ? ' `' + posTxt (Math.min (posSec, m.current.duration)) + ' / ' + fmtDur (m.current.duration) + '`'
                : '');
        const way = playWayShort (m, m.guildId);
        return '🎵 **Сейчас (№0):** ' + (m.current.isLive ? '🔴 ' : '') + '**' + (m.current.title || 'трек') + '**' + pos +
            byLabel (m.current) + repeatMark (m, m.current) +
            (way ? ' · ▶ ' + way : '') +
            (m.pausedByNobody ? ' _(пауза: нет слушателей)_' : '');
    }
    if (m.pending && m.tracks.length)
        return '⏸ Музыка ждёт слушателя -- зайди в голосовой канал, и я начну с того же места' +
            (m.connection ? '' : ' (или позови `/join`)');
    return '🎵 **Сейчас:** —';
}

function queueWaitText (m)
{
    const q = queueLeft (m);
    let wait = QSMALL + '⏳ До конца очереди: ' + (q.sec ? fmtAgo (q.sec * 1000) : '0 сек');
    if (q.curLeft) wait += ' (включая ' + fmtDur (q.curLeft) + ' текущего)';
    if (q.live) wait += ' + ' + q.live + ' 🔴 ' + plural (q.live, 'эфир', 'эфира', 'эфиров') + ' (без конца)';
    if (q.unknown) wait += ' + ' + q.unknown + ' ' + plural (q.unknown, 'трек', 'трека', 'треков') + ' без длительности';
    return wait;
}

function queueCheckText (m)
{
    if (!MUSIC_QUEUE_CHECK || !QUEUE_CHECK_DEPTH) return '';
    const c = m.check || null;
    const warned = (m.tracks || []).filter (t => t && t.warn).length;
    const left = queueUncheckedLeft (m);
    const parts = [];
    if (c && c.checked) parts.push ('просмотрено ' + c.checked + ' (в ' + hhmm (c.at) + ')');
    if (warned) parts.push ('⚠ под вопросом: ' + warned + ', убирать не стал');
    if (c && c.dropped) parts.push ('убрано при воспроизведении: ' + c.dropped);
    const pending = Number (m.deadScanAt) || 0;
    const soon = (pending > Date.now () ? pending : (left ? Date.now () + DEAD_RESCAN_MS : 0));
    const inMin = soon ? Math.max (1, Math.round ((soon - Date.now ()) / 60000)) : 0;
    let when;
    if (!m.tracks.length) when = 'проверять нечего: очередь пуста';
    else if (left) when = 'ещё ' + left + ' ' + plural (left, 'трек', 'трека', 'треков') +
        (inMin ? ' -- проход примерно через ' + inMin + ' мин' : '');
    else when = 'всё проверено, новых пока нет';
    return QSMALL + '🔎 Проверка очереди заранее: ' +
        (parts.length ? parts.join (', ') + '; ' : 'ещё не проходила; ') + when;
}

function netWaitText (m)
{
    const w = m && m.netWait;
    if (!w) return '';
    const tries = Math.max (1, Number (w.tries) || 0);
    const left = Math.max (0, Math.ceil (((w.nextAt || 0) - Date.now ()) / 1000));
    return QSMALL + '🌐 ' + (w.up
        ? 'Сеть/прокси: маршрут отвечает, музыка ещё не пошла'
        : 'Сеть/прокси молчит: стучусь каждые ' + Math.round (NET_PING_STEP_MS / 1000) + ' с') +
        ' -- попыток: ' + tries +
        (left ? ', следующая настоящая попытка через ' + fmtAgo (left * 1000) : '') +
        '; очередь и место в треке держатся';
}

function netRouteText (guildId, viewerId)
{
    if (!isBotOwner (viewerId)) return '';
    const bits = [];
    const u = routeUseOf (guildId);
    const inUseBad = !!(u && u.proxy && proxyBrieflyBad (u.proxy));
    if (u)
    {
        bits.push (u.kind === 'disk'
            ? '🌐 Маршрут: не нужен -- этот трек играю с диска'
            : '🌐 Маршрут: ' + (u.proxy ? 'прокси ' + u.proxy : 'DIRECT (напрямую)') +
              (inUseBad ? ' (сейчас со сбоем)' : ''));
        const spare = MUSIC_PROXIES.filter (p => p !== u.proxy && !proxyBrieflyBad (p));
        if (spare.length) bits.push ('запасной: ' + spare[0]);
    }
    if (MUSIC_PROXIES.length && directProbeCache.ok === false && dnsCache.ok !== false)
        bits.push ('⚠ DIRECT не отвечает (' + (directProbeCache.why || 'нет ответа') +
            ') -- если прокси отвалится, музыка подождёт сеть');
    const bad = MUSIC_PROXIES.filter (p => proxyBrieflyBad (p) && !(u && String (u.proxy) === String (p)));
    if (bad.length)
        bits.push ('со сбоем: ' + bad.map (p => p + ' (ещё ' +
            fmtAgo (Math.max (0, (proxyBadUntil.get (String (p)) || 0) - Date.now ())) + ')').join (', '));
    return bits.length ? QSMALL + bits.join (' · ') : '';
}

function nowPlayingText (m, guildId, viewerId)
{
    const t = m.current || m.seekTrack || null;
    const paused = !!(m.player && m.player.state && m.player.state.status === AudioPlayerStatus.Paused);
    if (!t)
        return m.connection
            ? '🎧 В канале тишина -- играть нечего. Поставить трек: `/play`, позвать меня: `/join`.'
            : '🈳 Ничего не играет, и я не в канале.';
    const live = !!t.isLive;
    const dur = Number (t.duration) > 0 ? Number (t.duration) : 0;
    const at = Math.max (0, Math.round (playedMsOf (m) / 1000));
    const lines = [];
    lines.push ((paused ? '⏸ ' : (live ? '🔴 ' : '🎶 ')) + '**' + (t.title || 'трек') + '**' +
        (live ? ' -- прямой эфир' : (dur ? ' -- ' + fmtDur (dur) : '')));
    if (live)
        lines.push (QSMALL + 'позиции у эфира нет -- играю с живого края');
    else if (dur)
        lines.push (QSMALL + 'позиция ' + fmtDur (Math.min (at, dur)) + ' из ' + fmtDur (dur) +
            ' · до конца трека ' + fmtDur (Math.max (0, dur - at)));
    else
        lines.push (QSMALL + 'позиция ' + fmtDur (at) + ' (длительность неизвестна)');
    if (paused)
        lines.push (QSMALL + (m.pausedByNobody
            ? 'пауза: в канале нет живых слушателей -- зайди, и я продолжу'
            : 'пауза по просьбе человека: /resume продолжит'));
    lines.push (QSMALL + '👤 поставил: ' + byNameOf (t) + (t.addIn ? ' · в <#' + t.addIn + '>' : ''));
    const chId = (m.connection && m.connection.joinConfig) ? m.connection.joinConfig.channelId : null;
    const ch = chId ? client.channels.cache.get (chId) : null;
    lines.push (QSMALL + '🎧 ' + (ch ? 'пою в «' + ch.name + '»' : (chId ? 'пою в <#' + chId + '>' : 'в канале не сижу')) +
        ' · слушателей: ' + (chId ? humansInChannel (guildId, chId) : 0) +
        ' · в очереди: ' + m.tracks.length);
    const way = playWayText (m, guildId, viewerId);
    if (way) lines.push (QSMALL + way);
    const net = netWaitText (m);
    if (net) lines.push (net);
    const route = netRouteText (guildId, viewerId);
    if (route) lines.push (route);
    lines.push (queueWaitText (m));
    const next = (m.preload && m.preload.track) || m.tracks[0] || null;
    if (next) lines.push (QSMALL + '⏭ Дальше: ' + (next.title || 'трек'));
    return lines.join ('\n');
}

function queueView (m, start, moveSel = 0, opts = {})
{
    const page = queuePage (m, start);
    const total = page.total;
    const restNow = () => total - (page.start - 1 + page.count);
    const move = (moveSel >= 1 && moveSel <= total)
        ? QSMALL + '🗂 Выбран №' + moveSel + ': ' + (m.tracks[moveSel - 1].title || 'трек') +
          ' -- двигай его кнопками ниже; «✖ Вернуться» вернёт обычные кнопки очереди.'
        : '';
    const authors = queueAuthorsText (m);
    const packList = queuePacksText (m);
    const check = queueCheckText (m);
    const net = netWaitText (m);
    const route = netRouteText (m.guildId, opts.actorId);
    const wait = queueWaitText (m);
    const build = hint =>
    {
        const mid = [net, packList, move, hint].filter (Boolean).join ('\n');
        return queueHeadText (m) +
        (mid ? '\n' + QSEP + '\n' + mid + '\n' + QSEP : '\n' + QSEP) +
        '\n**Очередь (' + total + ')**' + (page.start > 1 ? ' · с №' + page.start : '') + ':\n' + page.list +
        (restNow () > 0 ? '\n*...и ещё ' + restNow () + '*' : '') +
        '\n' + QSEP + '\n' +
        [authors, wait, check, route].filter (Boolean).join ('\n');
    };
    let content;
    if (!total) content = queueHeadText (m);
    else
    {
        content = build (queueHintText ());
        let guard = 0;
        while (content.length > QUEUE_MSG_LIMIT && page.count > 1 && guard++ < 50)
        {
            page.count--;
            page.list = page.list.split ('\n').slice (0, page.count).join ('\n');
            content = build (queueHintText ());
        }
        if (content.length > QUEUE_MSG_LIMIT) content = build (QUEUE_HINT_SHORT);
    }
    if (content.length > QUEUE_MSG_LIMIT) content = fitMsgText (content, QUEUE_MSG_LIMIT);
    return { content: content, components: queueComponents (page, m, moveSel, opts) };
}

const QUEUE_LIVE_STEP = 5000;

function queueWatchOf (m, msgId)
{
    if (!m || !Array.isArray (m.qMsgs) || !msgId) return null;
    return m.qMsgs.find (w => w && String (w.id) === String (msgId)) || null;
}

function queueWatchForget (m, msgId)
{
    if (!m || !Array.isArray (m.qMsgs)) return;
    m.qMsgs = m.qMsgs.filter (w => !w || String (w.id) !== String (msgId));
}

function queueWatch (m, msg, ctx, page, text, move)
{
    if (!QUEUE_LIVE_MS || !m || !msg || !msg.id) return;
    if (!Array.isArray (m.qMsgs)) m.qMsgs = [];
    const old = queueWatchOf (m, msg.id);
    const rec = { ch: msg.channelId, id: msg.id, ctx: ctx, page: Math.max (1, Number (page) || 1),
                  text: String (text || ''), move: Math.max (0, Number (move) || 0), at: Date.now (),
                  first: old ? !!old.first : true };
    if (old) m.qMsgs[m.qMsgs.indexOf (old)] = rec;
    else m.qMsgs.push (rec);
    const _who = ctx && ctx.actorId ? String (ctx.actorId) : '';
    if (_who)
        m.qMsgs = m.qMsgs.filter (w => w === rec ||
            !(w && w.ctx && String (w.ctx.actorId || '') === _who));
    while (m.qMsgs.length > QUEUE_LIVE_MAX)
    {
        let oldest = 0;
        for (let i = 1; i < m.qMsgs.length; i++)
            if ((m.qMsgs[i].at || 0) < (m.qMsgs[oldest].at || 0)) oldest = i;
        m.qMsgs.splice (oldest, 1);
    }
}

function queueWatchRestore (saved)
{
    if (!QUEUE_LIVE_MS || !saved) return [];
    const list = Array.isArray (saved) ? saved : [saved];
    const out = [];
    for (const s of list)
    {
        if (!s || !s.ch || !s.id) continue;
        const _who = String (s.actorId || '');
        if (_who)
        {
            const _at = out.findIndex (w => String ((w.ctx && w.ctx.actorId) || '') === _who);
            if (_at >= 0) out.splice (_at, 1);
        }
        out.push ({ ch: String (s.ch), id: String (s.id), page: Math.max (1, Number (s.page) || 1),
                    ctx: { actorId: String (s.actorId || ''), actorName: String (s.actorName || ''),
                           staff: !!s.staff },
                    text: '', move: 0, at: Date.now () });
    }
    return out.slice (0, QUEUE_LIVE_MAX);
}

function queueWatchGone (e)
{
    const code = String ((e && e.code) || (e && e.rawError && e.rawError.code) || '');
    const text = String ((e && (e.message || e)) || '');
    if (/^(10003|10008|50001|50013|403|404)$/.test (code)) return true;
    return /Unknown Message|Missing Access|Missing Permissions|Forbidden|Cannot send messages/.test (text);
}

async function queueLiveOne (m, w)
{
    if (w.move) { w.at = Date.now (); return; }
    let view;
    try { view = queueView (m, w.page, 0, w.ctx); }
    catch (e) { queueWatchForget (m, w.id); return; }
    const empty = !m.current && !m.tracks.length && !m.seekTrack;
    const content = view.content;
    if (content === w.text)
    {
        if (empty) queueWatchForget (m, w.id);
        return;
    }
    try
    {
        const ch = client.channels.cache.get (w.ch) || await client.channels.fetch (w.ch).catch (() => null);
        if (!ch) { queueWatchForget (m, w.id); return; }
        const msg = await ch.messages.fetch (w.id);
        await msg.edit (fitPayload (Object.assign (
            view.components.length ? { content: content, components: view.components } : { content: content },
            { allowedMentions: { parse: [] } })));
        if (w.first) { w.first = false; console.log ('[' + (d()) + '] [music] сообщение /queue обновил сам (стр. ' + w.page + ')'); }
        w.text = content;
        w.err = false;
        if (empty) queueWatchForget (m, w.id);
    }
    catch (e)
    {
        if (queueWatchGone (e)) { queueWatchForget (m, w.id); return; }
        if (!w.err)
        {
            w.err = true;
            console.error ('[' + (d()) + '] [music] сам не смог обновить сообщение /queue (повторю на следующем проходе): ' +
                oneLine ((e && e.message) || e));
        }
    }
}

async function queueLiveTick (guildId)
{
    const m = $music[guildId];
    if (!m || !Array.isArray (m.qMsgs) || !m.qMsgs.length) return;
    for (const w of m.qMsgs.slice ())
        await queueLiveOne (m, w);
}

async function queueMsgRedraw (guildId, delayMs = 0)
{
    const m = $music[guildId];
    if (!m || !Array.isArray (m.qMsgs) || !m.qMsgs.length) return;
    if (delayMs > 0) await new Promise (r => setTimeout (r, delayMs));
    for (const w of m.qMsgs.slice ())
    {
        try
        {
            const view = queueView (m, Math.max (1, Number (w.page) || 1), 0, w.ctx);
            const ch = client.channels.cache.get (w.ch) || await client.channels.fetch (w.ch).catch (() => null);
            if (!ch) continue;
            const msg = await ch.messages.fetch (w.id);
            await msg.edit (fitPayload (Object.assign (
                view.components.length ? { content: view.content, components: view.components } : { content: view.content },
                { allowedMentions: { parse: [] } })));
            w.text = view.content;
            w.at = Date.now ();
            w.err = false;
        }
        catch (e) {  }
    }
}

if (QUEUE_LIVE_MS)
    setInterval (() =>
    {
        const now = Date.now ();
        for (const g of Object.keys ($music))
        {
            const m = $music[g];
            if (!m || !Array.isArray (m.qMsgs) || !m.qMsgs.length) continue;
            if (!m.qMsgs.some (w => w && (now - (w.at || 0)) >= QUEUE_LIVE_MS)) continue;
            for (const w of m.qMsgs) w.at = now;
            queueLiveTick (g).catch (() => {});
        }
    }, QUEUE_LIVE_STEP).unref ();

async function resumeMusic (server)
{
    try
    {
        const guild = client.guilds.cache.get (server);
        if (!guild) return;
        const m = musicOf (server);
        const voice = await readVoiceState (server);
        let vch = null;
        if (voice && voice.channelId && !voice.left)
        {
            vch = guild.channels.cache.get (voice.channelId) ||
                await guild.channels.fetch (voice.channelId).catch (() => null);
            if (vch && (typeof vch.isVoiceBased !== 'function' || !vch.isVoiceBased ())) vch = null;
            if (!vch) writeVoiceState (server, null, false);
        }
        if (vch)
        {
            joinVoice (server, vch, guild, 'вернулся туда, где сидел до перезапуска');
            const _h = await humansInChannelChecked (server, vch.id);
            if (m.connection)
                console.log ('[' + (d()) + '] [music] возвращаюсь в «' + vch.name +
                    '» -- бот сидел там до перезапуска' +
                    (_h ? '' : ' (живых слушателей нет)'));
        }
        await repeatLoad (server);
        if (m.repeat.length)
            console.log ('[' + (d()) + '] [music] режим повтора с прошлого запуска: ' +
                m.repeat.length + ' ' + plural (m.repeat.length, 'автор', 'автора', 'авторов') +
                ' -- их треки остаются в очереди после проигрывания (/repeat-list)');
        await historyLoad (server);
        if (Array.isArray (m.history) && m.history.length)
            console.log ('[' + (d()) + '] [music] история добавлений: ' + m.history.length + ' ' +
                plural (m.history.length, 'пачка', 'пачки', 'пачек') + ' с прошлого запуска -- /history');
        let saved = await db (server, 'musicState', 'queue');
        if (!saved) return;
        const tracks = (saved.tracks || []).filter (t => t && t.url).map (jsonToTrack);
        const current = saved.current ? jsonToTrack (saved.current) : null;
        if (!current && !tracks.length) return;
        m.savedChannelId = vch ? vch.id : (saved.channelId || null);
        m.textChannelId = saved.textChannelId || m.textChannelId;
        m.qMsgs = queueWatchRestore (saved.qMsg);
        m.seekNoSections = Array.isArray (saved.noSec) ? saved.noSec.filter (s => typeof s === 'string').slice (-20) : [];
        const at = Math.min (Math.max (0, Math.round (saved.curIdx || 0)), tracks.length);
        m.tracks = current ? [...tracks.slice (0, at), current, ...tracks.slice (at)] : tracks;
        await historySeedFromQueue (server);
        m.seekTrack = current;
        m.seekSec = Math.max (0, Math.round (saved.elapsed || 0));
        m.leftByUser = vch ? false : !!saved.left;
        m.pending = true;
        const _noAuth = (current && !current.byId ? 1 : 0) + tracks.filter (t => !t.byId).length;
        if (_noAuth)
            console.log ('[' + (d()) + '] [music] в очереди ' + _noAuth + ' ' +
                plural (_noAuth, 'трек', 'трека', 'треков') + ' без автора (добавлены до v2.31): обычный DJ их не уберёт и не подвинет -- только админы и модеры.\n' +
                '     Проставить автора сразу всем:  node . fixauthors <его id> [имя]   (сначала можно — --dry)');
        let ch = m.savedChannelId
            ? (guild.channels.cache.get (m.savedChannelId) ||
               await guild.channels.fetch (m.savedChannelId).catch (() => null))
            : null;
        if (ch && (typeof ch.isVoiceBased !== 'function' || !ch.isVoiceBased ())) ch = null;
        if (!ch) m.savedChannelId = null;
        const where = (current ? (current.title || 'трек') +
            (current.isLive ? ' (эфир)' : (m.seekSec ? ' (с ' + fmtDur (m.seekSec) + ')' : '')) :
            'очередь без текущего') +
            (tracks.length ? ' + ещё ' + tracks.length + ' в очереди' : '');
        if (m.leftByUser)
        {
            console.log ('[' + (d()) + '] [music] очередь с прошлого раза на месте (выходили по /leave) -- ' + where + '; продолжу по /join');
            return;
        }
        if (!ch || !await humansInChannelChecked (server, ch.id))
        {
            const found = pickAuthorChannel (server, ch ? ch.id : null);
            if (found)
            {
                console.log ('[' + (d()) + '] [music] ' +
                    (ch ? 'в «' + ch.name + '» слушателей нет' : 'канала из прошлого запуска нет') +
                    ' -- иду туда, где слушает автор трека (' +
                    (found.track.byName || u (found.track.byId)) + '): «' + found.ch.name + '» (' + where + ')');
                m.savedChannelId = found.ch.id;
                startRestored (server, found.ch, guild);
                return;
            }
            if (!ch)
            {
                console.log ('[' + (d()) + '] [music] канала из прошлого запуска нет и автора трека нет ' +
                    'в голосовом -- жду захода человека или /join: ' + where);
                return;
            }
            console.log ('[' + (d()) + '] [music] зашёл в «' + ch.name + '» и МОЛЧУ: живых слушателей нет, ' +
                'играть не для кого -- очередь и место помню (' + where + '); начну, как только кто-то войдёт ' +
                '(или /join, когда надо)');
            scheduleVoiceStatus (server, true);
            schedulePresence (true);
            saveMusicState (server);
            return;
        }
        startRestored (server, ch, guild);
    }
    catch (e) { console.error ('[music] не смог возобновить очередь: ' + oneLine (e.message)); }
}

function startRestored (server, ch, guild)
{
    const m = musicOf (server);
    const current = m.seekTrack || null;
    const seek = m.seekSec || 0;
    const rest = restCount (m);
    const where = (current ? (current.title || 'трек') +
        (current.isLive ? ' (эфир)' : (seek ? ' (с ' + fmtDur (seek) + ')' : '')) : 'очередь без текущего') +
        (rest ? ' + ещё ' + rest + ' в очереди' : '');
    if (!joinVoice (server, ch, guild) || !m.connection) return;
    m.savedChannelId = ch.id;
    voiceOutageFinish (server, true);                    // счёт обрывов: вернулся сам
    if (!humansInChannel (server, ch.id))
    {
        m.pending = true;
        m.leftByUser = false;
        console.log ('[' + (d()) + '] [music] в «' + ch.name + '» никого -- играть не для кого: ' +
            'стою и жду слушателя (помню: ' + where + '), начну с того же места');
        if (m.netDownToldAt)
        {
            m.netDownToldAt = 0;
            musicNotice (server, outageUpText (current, seek, true));
        }
        scheduleVoiceStatus (server, true);
        schedulePresence (true);
        saveMusicState (server);
        return;
    }
    m.pending = false;
    m.leftByUser = false;
    console.log ('[' + (d()) + '] [music] возобновляю очередь в «' + ch.name + '»: ' + where);
    schedulePresence (true);
    playNext (server);
    scheduleDeadScan (server);
}

// Обрыв связи и возвращение бот говорит в тот же текстовый канал, откуда его позвали (не чаще раза в минуту --
// при частых обрывах канал не засыпается). Это не данные бота: в базу такие записи не идут.
function netNoticeOnce (m, key, gapMs = 60000)
{
    if (!m) return false;
    m.netTold = m.netTold || {};
    const t = m.netTold[key] || 0;
    if (t && (Date.now () - t) < gapMs) return false;
    m.netTold[key] = Date.now ();
    return true;
}
function outageDownText (track, sec)
{
    const _s = Math.max (0, Math.round (Number (sec) || 0));
    const what = track ? '**' + (track.title || 'трек') + '**' +
        ((_s >= 1 && !track.isLive) ? ' (' + fmtDur (_s) + ')' : '') : '';
    return '📡 Связь пропала' + (what ? ': ' + what + ' остановился' : '') +
        '. Очередь и место помню -- вернусь и продолжу с этой же секунды, как только связь оживёт.';
}
function outageUpText (track, sec, waiting, copy = false)
{
    const _s = Math.max (0, Math.round (Number (sec) || 0));
    const what = track ? '**' + (track.title || 'трек') + '**' : 'очередь';
    const at = (_s >= 1 && (!track || !track.isLive)) ? ' с ' + fmtDur (_s) : '';
    if (waiting)
        return '🔄 Связь вернулась -- я снова в канале, но слушателей нет: продолжу ' + what + at +
            ', как только кто-нибудь зайдёт.';
    if (copy)
        return '🔄 Я снова в канале -- играю ' + what +
            (at ? ' с того же места (' + fmtDur (_s) + ')' : '') +
            ' из своей копии: YouTube для этого не понадобился.';
    return '🔄 Связь вернулась -- снова играю ' + what +
        (at ? ' с того же места (' + fmtDur (_s) + ')' : '') + '.';
}
function outageDown (guildId, track, sec)
{
    const m = $music[guildId];
    if (!m) return false;
    if (!netNoticeOnce (m, 'down')) return false;
    m.netDownToldAt = Date.now ();
    musicNotice (guildId, outageDownText (track, sec));
    return true;
}

// Счёт обрывов: когда связь пропала, сколько музыка ждала, вернулась ли сама и с какой попытки.
// Хранится отдельно от очереди (netState/voice в базе): это не данные бота, а наблюдение за связью --
// его читает `node . net`. Записи не теряются: последние 20 случаев лежат списком, а счётчики -- нарастающим итогом.
const VOICE_LOG_MAX = 20;
let voiceLog = null, voiceLogLoading = null, voiceLogTimer = null;
async function voiceLogLoad ()
{
    if (voiceLog) return voiceLog;
    if (voiceLogLoading) return voiceLogLoading;
    voiceLogLoading = (async () =>
    {
        let val = null;
        try { const srv = dbServerList ()[0]; if (srv) val = await db (srv, 'netState', 'voice'); }
        catch (e) { }
        const base = { n: 0, back: 0, kicked: 0, waitMs: 0, tries: 0, net: 0, netBack: 0, netWaitMs: 0, netFromCopy: 0, list: [] };
        voiceLog = (val && typeof val === 'object') ? Object.assign (base, val) : base;
        if (!Array.isArray (voiceLog.list)) voiceLog.list = [];
        voiceLogLoading = null;
        return voiceLog;
    }) ();
    return voiceLogLoading;
}
function voiceLogSave ()
{
    if (voiceLogTimer) return;
    voiceLogTimer = setTimeout (async () =>
    {
        voiceLogTimer = null;
        try
        {
            const srv = dbServerList ()[0];
            if (srv && voiceLog) await db (srv, 'netState', 'voice', voiceLog);
        }
        catch (e) { }
    }, 2000);
    try { voiceLogTimer.unref (); } catch (e) { }
}
async function voiceLogNote (rec)
{
    try
    {
        const log = await voiceLogLoad ();
        log.list.unshift (rec);
        if (log.list.length > VOICE_LOG_MAX) log.list.length = VOICE_LOG_MAX;
        if (rec.kind === 'net')
        {
            log.net++;
            if (rec.back) log.netBack++;
            if (rec.copy) log.netFromCopy++;
            log.netWaitMs += Math.max (0, rec.waitMs || 0);
        }
        else
        {
            log.n++;
            if (rec.kicked) log.kicked++;
            else if (rec.back) log.back++;
            log.waitMs += Math.max (0, rec.waitMs || 0);
            log.tries += Math.max (0, rec.tries || 0);
        }
        voiceLogSave ();
    }
    catch (e) { }
}
function voiceOutageStart (guildId, why)
{
    const m = $music[guildId];
    if (!m) return;
    if (m.voiceOut) voiceOutageFinish (guildId, false, 'связь пропала снова, так и не вернувшись');
    m.voiceOut = { at: Date.now (), tries: 0, why: String (why || 'связь пропала') };
}
function voiceOutageAttempt (guildId)
{
    const m = $music[guildId];
    if (m && m.voiceOut) m.voiceOut.tries = (m.voiceOut.tries || 0) + 1;
}
function voiceOutageFinish (guildId, back, why)
{
    const m = $music[guildId];
    if (!m || !m.voiceOut) return;
    const o = m.voiceOut;
    m.voiceOut = null;
    const waitMs = Date.now () - (o.at || Date.now ());
    voiceLogNote ({ kind: 'voice', at: o.at, waitMs: waitMs, tries: o.tries || 0, back: !!back, why: why || o.why || '' });
    if (back)
        console.log ('[' + (d()) + '] [music] счёт обрывов: вернулся сам через ' + fmtAgo (waitMs) +
            ' (' + (o.tries || 0) + ' ' + plural (o.tries || 0, 'попытка', 'попытки', 'попыток') + ') -- записал в счёт обрывов');
}
function voiceOutageKicked (guildId)
{
    voiceLogNote ({ kind: 'voice', at: Date.now (), waitMs: 0, tries: 0, back: false, kicked: true,
        why: 'выкинули из канала (сам не возвращаюсь)' });
}
function netOutageStart (guildId)
{
    const m = $music[guildId];
    if (!m || m.netOut) return;
    m.netOut = { at: Date.now (), tries: 1 };
}
function netOutageAttempt (guildId, tries)
{
    const m = $music[guildId];
    if (m && m.netOut) m.netOut.tries = Math.max (m.netOut.tries || 0, Number (tries) || 0);
}
function netOutageFinish (guildId, copy)
{
    const m = $music[guildId];
    if (!m || !m.netOut) return;
    const o = m.netOut;
    m.netOut = null;
    const waitMs = Date.now () - (o.at || Date.now ());
    voiceLogNote ({ kind: 'net', at: o.at, waitMs: waitMs, tries: o.tries || 0, back: true, copy: !!copy });
    console.log ('[' + (d()) + '] [music] счёт обрывов: музыка стояла ' + fmtAgo (waitMs) +
        ' (' + (o.tries || 0) + ' ' + plural (o.tries || 0, 'попытка', 'попытки', 'попыток') + ') -- поднялась сама' +
        (copy ? ' из своей копии' : '') + '; записал в счёт обрывов');
}
function netVoiceLines (voice)
{
    // строки для `node . net`: обрывы голоса и вставшая из-за сети музыка
    const out = [];
    const v = (voice && typeof voice === 'object') ? voice : null;
    if (!v || (!v.n && !v.net))
        return ['записей пока нет -- либо всё было ровно, либо бот не работал с этой версией'];
    if (v.n)
    {
        const attempted = Math.max (0, v.n - (v.kicked || 0));
        out.push ('обрывы голоса: ' + v.n + ', вернулся сам ' + (v.back || 0) +
            (v.kicked ? ', выкидываний ' + v.kicked + ' (это не обрыв: сам не возвращаюсь)' : '') +
            ', ждал в сумме ' + fmtAgo (v.waitMs || 0) +
            ((attempted && v.tries) ? ', попыток на возврат в среднем ' +
                (Math.round ((v.tries / attempted) * 10) / 10) : ''));
    }
    if (v.net)
        out.push ('музыка вставала из-за сети: ' + v.net + ', поднялась сама ' + (v.netBack || 0) +
            (v.netFromCopy ? ' (из них с диска ' + v.netFromCopy + ')' : '') +
            ', ждала в сумме ' + fmtAgo (v.netWaitMs || 0));
    const list = (v.list || []).slice (0, 5);
    for (const e of list)
    {
        let when = '--';
        try { when = new Date (e.at).toLocaleString ('ru-RU'); } catch (x) { }
        if (e.kind === 'net')
            out.push ('  ' + when + ' -- сеть: стояла ' + fmtAgo (e.waitMs || 0) +
                (e.tries ? ' (' + e.tries + ' ' + plural (e.tries, 'попытка', 'попытки', 'попыток') + ')' : '') +
                ', поднялась сама' + (e.copy ? ' из своей копии' : ''));
        else
            out.push ('  ' + when + ' -- голос: ' + (e.kicked ? 'выкинули, сам не возвращался'
                : ((e.back ? 'вернулся сам за ' + fmtAgo (e.waitMs || 0) :
                    'НЕ вернулся (' + (e.why || 'причина не записана') + ')') +
                    (e.tries ? ', попыток ' + e.tries : ''))));
    }
    if (v.list && v.list.length > list.length)
        out.push ('  ...и ещё ' + (v.list.length - list.length) + ' в записях');
    return out;
}

// Настоящая проверка голоса. Два пути: (1) бот уже в канале и библиотека измерила udp-пинг -- значит
// пакеты реально ходили к медиа-адресу и вернулись, ничего прерывать не надо; (2) пинга нет -- выхожу,
// вхожу заново (это и есть проверка медиа-адреса) и возвращаю музыку на то же место.
let voiceRealBusy = false;
async function voiceChannelFor (id, fetchIt)      // канал для проверки голоса: из кеша или из Discord
{
    if (!id) return null;
    if (!fetchIt) return client.channels.cache.get (id) || null;
    try { return (await client.channels.fetch (id)) || null; }
    catch (e) { return null; }
}
function voicePingNow (m)
{
    const c = m && m.connection;
    if (!c || !c.state || c.state.status !== VoiceConnectionStatus.Ready) return null;
    try
    {
        const p = c.ping;
        if (!p) return null;
        return { ws: (typeof p.ws === 'number' ? p.ws : null), udp: (typeof p.udp === 'number' ? p.udp : null) };
    }
    catch (e) { return null; }
}
async function voiceRealCheck (guildId)           // кнопка владельца: проверить голос по-настоящему
{
    const m = musicOf (guildId);
    const t0 = Date.now ();
    const ping = voicePingNow (m);
    const wasChId = String ((m.connection && m.connection.joinConfig && m.connection.joinConfig.channelId) || m.savedChannelId || '');
    if (ping && typeof ping.udp === 'number')
    {
        const ch0 = await voiceChannelFor (wasChId, false);
        return { ok: true, how: 'ping', ms: Date.now () - t0, chName: ch0 ? ch0.name : '', ping: ping };
    }
    if (!/^\d{17,20}$/.test (wasChId))
        return { ok: false, how: 'nochannel', ms: Date.now () - t0, why: 'не знаю канал: бот туда ещё не заходил' };
    const ch = await voiceChannelFor (wasChId, true);
    const guild = (ch && ch.guild) ? ch.guild : null;
    if (!guild)
        return { ok: false, how: 'nochannel', ms: Date.now () - t0, why: 'канал не нашёлся или он не на сервере' };
    const wasIn = !!m.connection;
    const wasPlaying = !!m.current || !!m.seekTrack;
    const wasWhere = wasPlaying ? Math.max (0, Math.round (playedMsOf (m) / 1000)) : 0;
    if (wasIn)                                        // выхожу: место в треке и очередь сохраняются (как при обрыве связи)
    {
        try { destroyMusic (guildId); } catch (e) { }
    }
    let conn = null, ok = false, why = '';
    try
    {
        conn = joinVoiceChannel ({ channelId: ch.id, guildId: guildId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: false });
        await entersState (conn, VoiceConnectionStatus.Ready, VOICE_CHECK_MS);
        ok = true;
    }
    catch (e) { why = oneLine ((e && e.message) || e); }
    const p2 = voicePingNow ({ connection: conn });
    try { if (conn) conn.destroy (); } catch (e) { }
    if (wasIn)                                        // возвращаю музыку тем же путём, что после обрыва связи
    {
        try { startRestored (guildId, ch, guild); } catch (e) { }
    }
    const r = { ok: ok, how: 'join', ms: Date.now () - t0, chName: ch.name, why: why, ping: p2, wasIn: wasIn, wasPlaying: wasPlaying, where: wasWhere };
    console.log ('[' + (d()) + '] [music] настоящая проверка голоса: канал «' + ch.name + '» ' +
        (ok ? 'поднялся за ' + (r.ms / 1000).toFixed (1) + ' с (медиа-адрес ответил)' : 'не поднялся за ' + (VOICE_CHECK_MS / 1000) + ' с (' + why + ')') +
        (wasIn ? (wasPlaying ? '; вернул музыку на ' + fmtDur (wasWhere) : '; слушателей и музыки не было') : '; бот в канале не сидел -- только замерил'));
    return r;
}
function voiceRealText (r, chName)
{
    const sec = (r.ms / 1000).toFixed (1);
    if (r.how === 'ping')
        return '🔊 **Голос по-настоящему: работает.**\n' +
            '_Пакеты к медиа-адресу ' + (r.chName ? 'канала «' + r.chName + '» ' : '') + 'ходят и возвращаются: пинг голоса ' +
            (r.ping && typeof r.ping.udp === 'number' ? r.ping.udp + ' мс' : 'измерен') +
            (r.ping && typeof r.ping.ws === 'number' ? ' (управляющий ' + r.ping.ws + ' мс)' : '') +
            '. Это самая настоящая проверка, и музыку прерывать не пришлось._';
    if (r.how === 'nochannel')
        return '🔊 Не могу проверить: ' + r.why +
            '.\n_Заведи бота в канал (`/join`) или укажи канал в консоли: `node . voice <id канала>`._';
    if (r.ok)
        return '🔊 **Голос по-настоящему: работает.**\n' +
            '_Канал «' + r.chName + '» поднялся за ' + sec + ' с -- медиа-адрес ответил._\n' +
            (r.wasIn
                ? (r.wasPlaying ? '_Музыка вернулась в канал и продолжает с того же места (' + fmtDur (r.where) + ')._' : '_Вернулся в канал сам._')
                : '_В канале я не сижу -- это был только замер, музыка не тронута._');
    return '🔊 **Голос по-настоящему: НЕ работает.**\n' +
        '_Канал «' + r.chName + '» не поднялся за ' + (VOICE_CHECK_MS / 1000) + ' с' + (r.why ? ' (' + r.why + ')' : '') + '._\n' +
        'Пока это не наладится, музыка играть не сможет: голос -- это единственное, без чего её не слышно.\n' +
        'Что смотреть: обход DPI и прокси (в `/health` выше), затем проверить голос отдельно, при выключенном боте: `node . voice` (он делает тот же замер, но дольше и подробнее).' +
        (r.wasIn ? '\n_Музыка вернулась в канал и ждёт._' : '');
}

async function netHealthText (m, guildId, viewerId)      // ответ на /health: как живёт связь и чем идёт звук
{
    const owner = isBotOwner (viewerId);
    const lines = ['🩺 **Связь и музыка** -- что бот помнит и что видит сейчас'];
    for (const l of await netVoiceLines (await voiceLogLoad ()))
        lines.push (/^  /.test (l) ? l : '• ' + l);
    if (m)
    {
        const way = playWayShort (m, guildId);
        lines.push ('🎵 Сейчас: ' + (m.current ? '«' + (m.current.title || 'трек') + '»' : 'ничего не играет') +
            (way ? ' -- играю ' + way : ''));
        if (m.netWait)
            lines.push ('⏳ Жду сеть (попытка ' + (m.netWait.tries || 1) + '): ' + (m.netWait.lastWhy || 'нет ответа') +
                ' -- очередь и место в треке целы');
        else if (m.pending)
            lines.push ('⏸ На паузе: в канале нет слушателей -- продолжу, когда кто-нибудь зайдёт');
        const vp = voicePingNow (m);
        const vch = (m.connection && m.connection.joinConfig) ? m.connection.joinConfig.channelId : '';
        if (m.connection)
            lines.push ('🔊 Голос: ' + (m.connection.state && m.connection.state.status === VoiceConnectionStatus.Ready ? 'связь держится' : 'связь не держится') +
                (vch ? ' (канал «' + (((await voiceChannelFor (vch, false)) || {}).name || vch) + '»)' : '') +
                (vp && typeof vp.udp === 'number' ? '; к медиа-адресу пакеты ходят (пинг ' + vp.udp + ' мс)' :
                    '; медиа-адрес сейчас не измерю -- ничего ещё не звучало') +
                (owner ? ' -- кнопка ниже проверит его по-настоящему' : ''));
    }
    const rs = await routeStatus ();
    lines.push ('🛣 Пути к YouTube: ' + [
        'прямой путь: ' + (rs.dp.ok ? 'работает' : 'не проходит'),
        'обход DPI (zapret): ' + (rs.dpi === true ? 'запущен' : (rs.dpi === false ? 'не запущен' : 'не видно')) +
            ' (служба zapret: ' + svcWords (rs.svc) + ', драйвер WinDivert: ' + (rs.drv.exists ? 'установлен' : 'не видно') + ')',
        'прокси: ' + (MUSIC_PROXIES.length
            ? (rs.alive.length ? 'отвечает' + (owner ? ' (' + rs.alive.join (', ') + ')' : '') : 'задан, но молчит')
            : 'не задан'),
        'свой маршрут по адресам: ' + (rs.dohPort ? 'включён' + (rs.bookN ? ', в книге ' + rs.bookN + ' имён' : '') : 'выключен'),
    ].join ('; '));
    const keep = await dpiKeeperState ();
    lines.push ('👁 Сторож обхода (хранитель): ' + keeperWords (keep) +
        (keep.proc ? ' -- значит обход чинится сам, каждые пару минут.'
            : keep.task ? ' -- поднимется сам при входе в систему; если обход встанет, замечу и напишу.'
            : ' -- если обход встанет, я это замечу и напишу, но чинить придётся вручную: в `tools\\obhod.cmd` пункт 6 ставит сторожа, пункт 7 -- он же в автозапуске.'));
    lines.push (rs.advice.replace (/^-- /, ''));
    const fix = !!(owner && rs.noPath && rs.dpi !== true && MUSIC_DPI_HEAL);
    if (!rs.noPath && rs.dpi === true && !keep.proc && !keep.task)
        lines.push ((owner ? '👁 Обход никто не сторожит: он работает' : '👁 Обход работает, но его никто не сторожит') +
            ' -- если он встанет, я это замечу и напишу, а чинить придётся вручную (`tools\\obhod.cmd`, пункт 6).');
    const canStart = !!(fix && fsMod.existsSync (DPI_CHOSEN));
    if (fix)
        lines.push ('🛠 Поднять обход я попробую сам: движок и хранителя из планировщика -- без прав; если не хватит прав -- напишу, каких именно.' +
            (canStart ? '\n_Сохранённая стратегия есть: её вернёт кнопка «Поднять обход» -- один запрос прав и пара секунд._' : ''));
    return { text: lines.join ('\n'), fix: fix, canStart: canStart, owner: owner };
}
async function dpiStartFromDiscord ()            // кнопка у владельца: поднять сохранённую стратегию
{
    if (dpiHealBusy) { await notifyHoster ('🛠 Сейчас занят обходом -- допишу, когда закончу.'); return; }
    dpiHealBusy = true;
    try
    {
        const r = await dpiStartRun ();
        const pids = await dpiEnginePids ();
        const dnsOk = await directUsable ();
        const dp = dnsOk ? await directProbe () : { ok: false, why: 'youtube.com локально не резолвится' };
        const disc = await dpiDiscordState ();
        const head = r.ok
            ? '✅ **Обход поднят** сохранённой стратегией: движок' + (pids.length ? ' работает (pid ' + pids.join (', ') + ')' : ' не видно') +
                ', ютуб ' + (dp.ok ? 'отвечает' : 'пока не отвечает') + ', api discord ' + (disc.api ? 'отвечает' : 'НЕ отвечает')
            : '🚨 **Поднять обход не вышло:** ' + r.why + '.';
        await notifyHoster (head + (r.ok ? '' : '\n_Подобрать заново: `node . obhod --pick` (или кнопка «Подобрать обход»)._') +
            '\n_Голос проверяется отдельно, когда бот выключен: node . obhod --pick --voice._');
    }
    finally { dpiHealBusy = false; }
}

function musicNotice (guildId, text)
{
    const m = $music[guildId];
    if (!m || !m.textChannelId || !text) return;
    const ch = client.channels.cache.get (m.textChannelId);
    if (!ch || typeof ch.send !== 'function') return;
    sendFit (ch, text).catch (() => {});
}

function trackNotice (guildId, track, text)
{
    const m = $music[guildId];
    if (!m || !text) return;
    const _id = track && track.addIn ? String (track.addIn) : '';
    const ch = _id ? client.channels.cache.get (_id) : null;
    if (ch && typeof ch.send === 'function') { sendFit (ch, text).catch (() => {}); return; }
    musicNotice (guildId, text);
}

const $deadChecked = new Map ();
const DEAD_UNKNOWN_RETRY = 30 * 60 * 1000;
const DEAD_RESCAN_MS = 3 * 60 * 1000;
const DEAD_PROBE_TIMEOUT = 8000;
const $deadScan = {};

function deadStateOf (url)
{
    const v = url ? $deadChecked.get (url) : null;
    if (!v) return null;
    if (v.state === 'unknown' && Date.now () - v.at > DEAD_UNKNOWN_RETRY) return null;
    return v.state;
}
function deadRemember (url, state)
{
    if (!url) return;
    if ($deadChecked.size > 5000) $deadChecked.clear ();
    $deadChecked.set (url, { state, at: Date.now () });
}

function proxyForAgent (proxyUrl)
{
    const s = String (proxyUrl || '').trim ();
    if (/^socks4:\/\//i.test (s)) return s.replace (/^socks4:\/\//i, 'socks4a://');
    if (/^socks5:\/\//i.test (s)) return s.replace (/^socks5:\/\//i, 'socks5h://');
    if (/^socks:\/\//i.test (s)) return s.replace (/^socks:\/\//i, 'socks5h://');
    return s;
}

function proxyAgentFor (addr)
{
    const s = String (addr || '').trim ();
    if (!s) return null;
    try
    {
        if (/^socks/i.test (s))
        {
            const M = require ('socks-proxy-agent');
            const A = M.SocksProxyAgent || M;
            return new A (proxyForAgent (s));
        }
        if (/^https?:\/\//i.test (s))
        {
            const M = require ('https-proxy-agent');
            const A = M.HttpsProxyAgent || M;
            return new A (s);
        }
    }
    catch { return null; }
    return null;
}

const YT_URL_RE = /^https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/(?:watch|shorts|live|embed)|^https?:\/\/youtu\.be\//i;
async function oembedProbe (url)
{
    if (!YT_URL_RE.test (String (url || ''))) return 'unknown';
    const proxyAddr = await proxyForFetch ();
    return new Promise (resolve =>
    {
        let httpsMod;
        try { httpsMod = require ('https'); } catch { return resolve ('neterr'); }
        const agent = proxyAddr ? proxyAgentFor (proxyAddr) : null;
        let done = false;
        const fin = v => { if (done) return; done = true; resolve (v); };
        let req;
        try
        {
            req = httpsMod.get ('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent (url),
                { agent, timeout: DEAD_PROBE_TIMEOUT },
                res =>
                {
                    res.resume ();
                    if (res.statusCode === 200) return fin ('ok');
                    if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 404) return fin ('gone');
                    fin ('unknown');
                });
        }
        catch { return fin ('neterr'); }
        req.on ('timeout', () => { try { req.destroy (); } catch {} fin ('neterr'); });
        req.on ('error', () => fin ('neterr'));
    });
}

let oembedFails = 0, oembedOkEver = 0, oembedHintTold = false;
function oembedNote (verdict)
{
    if (verdict === 'ok' || verdict === 'gone') { oembedOkEver++; oembedFails = 0; return; }
    if (verdict !== 'neterr') return;
    if (++oembedFails < 5 || oembedOkEver || oembedHintTold) return;
    oembedHintTold = true;
    console.error ('[' + (d()) + '] [music] проверка очереди: не могу достучаться до YouTube (DNS/сеть) -- ' +
        'мёртвые видео, как и раньше, узнаются только при подходе к эфиру. ' +
        'Проверь MUSIC.proxy (запрос идёт по адресу из конфига: socks5 -- с резолвом имени на стороне прокси, http -- как есть) ' +
        'или выключи MUSIC.queue_check вовсе');
}

async function deadProbe (url, strict = false)
{
    const oe = await oembedProbe (url);
    oembedNote (oe);
    if (oe === 'ok' && !strict) return 'alive';
    if (oe !== 'ok' && oe !== 'gone') return 'unknown';
    ytDlpQuiet++;
    try
    {
        await ytDlpRun (url, { simulate: true, quiet: true, noWarnings: true, noPlaylist: true });
        return 'alive';
    }
    catch (e) { return isGoneError (e) ? 'dead' : 'unknown'; }
    finally { ytDlpQuiet--; }
}

function deadWarnAdd (told, guildId, track)
{
    const m = $music[guildId];
    const want = track && track.addIn ? String (track.addIn) : '';
    const ch = want ? client.channels.cache.get (want) : null;
    const id = (ch && typeof ch.send === 'function') ? want
        : (m && m.textChannelId ? String (m.textChannelId) : '');
    if (!id) return;
    if (!told.has (id)) told.set (id, []);
    told.get (id).push (track.title || 'трек');
}
function deadWarnSend (told)
{
    for (const [id, titles] of told)
    {
        const ch = client.channels.cache.get (id);
        if (!ch || typeof ch.send !== 'function') continue;
        sendFit (ch, '⚠️ **Возможно, это видео недоступно:** ' +
            titles.slice (0, 8).map (t => '**' + oneLine (t, 60) + '**').join (', ') +
            (titles.length > 8 ? ' и ещё ' + (titles.length - 8) : '') +
            '. Проверка идёт заранее и через мой прокси -- бывает, что видео просто не ' +
            'отдаётся сейчас (регион, VPN). **Из очереди не убираю:** проверю, когда дойдёт ' +
            'очередь, и если не сыграет -- скажу причину и уберу. Ставить заново не надо.').catch (() => {});
    }
}

function scheduleDeadScan (guildId, delay = 8000)
{
    if (!MUSIC_QUEUE_CHECK || !QUEUE_CHECK_DEPTH) return;
    const m = $music[guildId];
    if (!m || m.deadScanTimer) return;
    m.deadScanAt = Date.now () + delay;
    m.deadScanTimer = setTimeout (() => { m.deadScanTimer = null; deadScan (guildId).catch (() => {}); }, delay);
    if (m.deadScanTimer && m.deadScanTimer.unref) m.deadScanTimer.unref ();
}

function deadCheckNote (guildId, fields)
{
    const m = $music[guildId];
    if (!m) return;
    const c = m.check || (m.check = { at: 0, checked: 0, dropped: 0 });
    for (const k in fields) c[k] = fields[k];
}
function deadDropNote (guildId)
{
    const m = $music[guildId];
    if (!m) return;
    const c = m.check || (m.check = { at: 0, checked: 0, dropped: 0 });
    c.dropped = (c.dropped || 0) + 1;
}

async function deadScan (guildId)
{
    if (!MUSIC_QUEUE_CHECK || !QUEUE_CHECK_DEPTH || $deadScan[guildId]) return;
    $deadScan[guildId] = true;
    const told = new Map ();
    let checked = 0, warned = 0;
    try
    {
        for (;;)
        {
            const m = $music[guildId];
            if (!m || !m.tracks || !m.tracks.length) break;
            if (checked >= QUEUE_CHECK_DEPTH) break;
            let target = null, targetAt = -1;
            for (let i = 0; i < m.tracks.length; i++)
            {
                const t = m.tracks[i];
                if (!t || t.isLive || t.gone) continue;
                const _u = t.url || t.streamUrl;
                if (!_u || deadStateOf (_u)) continue;
                target = t; targetAt = i; break;
            }
            if (!target) break;
            const url = target.url || target.streamUrl;
            const verdict = await deadProbe (url, targetAt < QUEUE_CHECK_STRICT);
            deadRemember (url, verdict);
            checked++;
            const now = $music[guildId];
            if (!now) break;
            if (verdict === 'dead')
            {
                const at = now.tracks.indexOf (target);
                if (at >= 0)
                {
                    target.warn = 'проверка заранее: видео не отдаётся (регион/прокси или удалено)';
                    target.warnAt = Date.now ();
                    warned++;
                    if (!target.warnTold)
                        console.error ('[' + (d()) + '] [music] проверка очереди: похоже, видео недоступно -- ' +
                            (target.title || 'трек') + ' -- оставляю в очереди, проверю при воспроизведении');
                    target.warnTold = true;
                }
                deadWarnAdd (told, guildId, target);
            }
            await new Promise (r => setTimeout (r, QUEUE_CHECK_GAP_MS));
        }
    }
    finally
    {
        $deadScan[guildId] = false;
        if (checked)
        {
            console.log ('[' + (d()) + '] [music] проверка очереди: проверено ' + checked + ' ' +
                plural (checked, 'трек', 'трека', 'треков') + ' -- ' +
                (warned ? 'под вопросом: ' + warned + ' (из очереди не убрал)' : 'подозрительных нет'));
            deadCheckNote (guildId, { at: Date.now (), checked: checked });
        }
        deadWarnSend (told);
    }
}

setInterval (() =>
{
    for (const id of Object.keys ($music)) scheduleDeadScan (id, 1000);
}, DEAD_RESCAN_MS).unref ();

function queueUncheckedLeft (m)
{
    if (!m || !m.tracks) return 0;
    let left = 0;
    for (const t of m.tracks)
    {
        if (!t || t.isLive) continue;
        const u = t.url || t.streamUrl;
        if (!u || deadStateOf (u)) continue;
        left++;
    }
    return left;
}

function skipAbsentAuthors (guildId, curChId)
{
    const m = $music[guildId];
    if (!m || !m.connection) return false;
    if (!MUSIC_SKIP_ABSENT) return false;
    const cand = [];
    if (m.current) cand.push (m.current);
    for (const t of (m.tracks || [])) cand.push (t);
    if (cand.length < 2) return false;
    let at = -1, ch = null;
    for (let i = 0; i < cand.length && i < 500; i++)
    {
        const aCh = authorVoiceId (guildId, cand[i]);
        if (!aCh || aCh === curChId) continue;
        const c = client.channels.cache.get (aCh);
        if (c) { at = i; ch = c; break; }
    }
    if (at <= 0 || !ch) return false;
    const guildMove = client.guilds.cache.get (guildId);
    if (!guildMove) return false;
    const withCur = !!m.current;
    const cut = withCur ? (at - 1) : at;
    const moved = cand.slice (0, at);
    const target = cand[at];
    const whoName = target.byName || u (target.byId);
    try
    {
        joinVoice (guildId, ch, guildMove, 'авторов пропущенных треков нет в голосовом -- ' +
            whoName + ' слушает здесь');
    }
    catch (e)
    {
        console.error ('[music] пропуск отсутствующих авторов: переехать не вышло: ' + oneLine (e.message));
        return false;
    }
    m.tracks = m.tracks.slice (cut).concat (moved);
    m.current = null;
    m.seekTrack = null;
    m.seekSec = 0;
    m.playedMs = 0;
    m.playingSince = null;
    m.pending = false;
    m.pausedByNobody = false;
    dropPreload (m);
    m.savedChannelId = ch.id;
    saveMusicState (guildId);
    try { m.player.stop (true); } catch {}
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    const names = moved.slice (0, 3).map (t => t.title || 'трек').join (', ');
    console.log ('[' + (d()) + '] [music] ' + moved.length + ' ' + plural (moved.length, 'трек', 'трека', 'треков') +
        ' отсутствующих авторов (' + names + (moved.length > 3 ? ' и др.' : '') +
        ') -- переставил в конец очереди и перешёл в «' + ch.name + '»: ' + whoName + ' ждёт своё');
    musicNotice (guildId, '⏭ ' + moved.length + ' ' + plural (moved.length, 'трек', 'трека', 'треков') +
        ' от тех, кого нет в голосовом, -- ждать некому: поставил их в конец очереди и играю **' +
        (target.title || 'трек') + '** в «' + ch.name + '» (добавил ' + whoName + ').');
    return true;
}

function checkListeners (server, _noFollow = false)
{
    const m = $music[server];
    if (!m) return;
    if (m.connection)
    {
        const chId = m.connection.joinConfig.channelId;
        const people = humansInChannel (server, chId);
        const ch = client.channels.cache.get (chId);
        const where = ch ? '«' + ch.name + '»' : chId;
        const playing = m.player.state.status === AudioPlayerStatus.Playing;
        if (!people && m.current && playing && !m.pausedByNobody)
        {
            m.pausedByNobody = true;
            m.playedMs = playedMsOf (m);
            m.playingSince = null;
            try { m.player.pause (); } catch (e) {  }
            console.log ('[' + (d()) + '] [music] в ' + where + ' никого -- пауза (продолжу, когда вернётся слушатель)');
            saveMusicState (server);
            scheduleVoiceStatus (server, true);
            schedulePresence (true);
            if (!_noFollow) return checkListeners (server, false);
        }
        else if (people > 0 && m.pausedByNobody)
        {
            m.pausedByNobody = false;
            m.playingSince = Date.now ();
            try { m.player.unpause (); } catch (e) {  }
            console.log ('[' + (d()) + '] [music] слушатель вернулся в ' + where + ' -- продолжаю');
            saveMusicState (server);
            scheduleVoiceStatus (server, true);
            schedulePresence (true);
        }
        else if (!people && !playing && !_noFollow && (m.current || m.tracks.length))
        {
            if (skipAbsentAuthors (server, chId)) return checkListeners (server, true);
            const guildMove = client.guilds.cache.get (server);
            const found = pickAuthorChannel (server, chId);
            if (found && guildMove)
            {
                try
                {
                    joinVoice (server, found.ch, guildMove, 'в прошлой комнате никого, а автор трека ' +
                        (found.track.byName || u (found.track.byId)) + ' слушает здесь');
                    m.savedChannelId = found.ch.id;
                    if (m.player.state.status === AudioPlayerStatus.Paused && !m.pausedByNobody)
                    {
                        m.playingSince = Date.now ();
                        try { m.player.unpause (); } catch {  }
                        console.log ('[' + (d()) + '] [music] приехал туда, где есть слушатель -- снимаю паузу и продолжаю');
                        saveMusicState (server);
                        scheduleVoiceStatus (server, true);
                        schedulePresence (true);
                    }
                    return checkListeners (server, true);
                }
                catch (e)
                {
                    console.error ('[music] к автору трека не переехал: ' + oneLine (e.message));
                }
            }
        }
        if (people > 0 && m.pending && !m.current && (m.seekTrack || m.tracks.length))
        {
            const g = client.guilds.cache.get (server);
            const chHere = client.channels.cache.get (chId);
            if (g && chHere)
            {
                console.log ('[' + (d()) + '] [music] слушатель зашёл в ' + where + ' -- начинаю сохранённую очередь');
                startRestored (server, chHere, g);
            }
        }
        return;
    }
    if (!m.pending || m.leftByUser) return;
    const guild = client.guilds.cache.get (server);
    if (!guild) return;
    const ch = m.savedChannelId ? guild.channels.cache.get (m.savedChannelId) : null;
    if (ch && humansInChannel (server, ch.id)) return startRestored (server, ch, guild);
    if (_noFollow) return;
    const found = pickAuthorChannel (server, null);
    if (!found) return;
    console.log ('[' + (d()) + '] [music] канала из прошлого запуска нет -- иду туда, где слушает автор ' +
        'трека (' + (found.track.byName || u (found.track.byId)) + '): «' + found.ch.name + '»');
    m.savedChannelId = found.ch.id;
    startRestored (server, found.ch, guild);
}

function jsonToTrack (t)
{
    return { url: t.url, streamUrl: t.url, title: t.title || 'Без названия', duration: t.duration || 0,
             author: t.author || '', isLive: !!t.isLive, thumbnail: '', seek: t.seek || 0,
             byId: t.byId || null, byName: t.byName || '', addAt: Number (t.addAt) || 0,
             addIn: t.addIn || null };
}

const PRESENCE_MIN_GAP_MS = 5000;
let $presenceTimer = null;
let $presenceLast = 0;
let $presenceDone = null;

function presenceNow ()
{
    let playing = null, waiting = null;
    for (let g in $music)
    {
        const m = $music[g];
        if (!m.connection) continue;
        const chId = m.connection.joinConfig.channelId;
        const ch = client.channels.cache.get (chId);
        const where = ch ? '«' + ch.name + '»' : 'голосовом канале';
        const people = humansInChannel (g, chId);
        const tail = (m.tracks.length ? ' · в очереди ' + m.tracks.length : '') +
            (people ? ' · в канале ' + people : '');
        if (m.current)
        {
            const icon = m.pausedByNobody ? '😴 '
                : (m.player.state.status === AudioPlayerStatus.Paused ? '⏸ '
                    : (m.current.isLive ? '🔴 ' : '🎶 '));
            const suffix = ' — ' + where + tail;
            playing = icon + clipText (m.current.title || 'трек', 128 - icon.length - suffix.length) + suffix;
        }
        else if (!waiting)
            waiting = (m.pending ? '⏸ ' + where + ' — жду слушателя' : '🎧 ' + where) + tail;
    }
    if (playing) return { type: ActivityType.Listening, name: playing };
    if (waiting) return { type: ActivityType.Watching, name: waiting };
    return { type: ActivityType.Playing, name: '/help · /play · /join' };
}

function writePresence ()
{
    if (!client.user) return;
    const want = presenceNow ();
    want.name = String (want.name).slice (0, 128);
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
        $presenceDone = null;
    }
}

function schedulePresence (immediate = false)
{
    if ($presenceTimer) return;
    const wait = immediate ? Math.max (PRESENCE_MIN_GAP_MS - (Date.now () - $presenceLast), 0) : PRESENCE_MIN_GAP_MS;
    $presenceTimer = setTimeout (() => { $presenceTimer = null; writePresence (); }, wait);
}

function joinVoice (guildId, voiceChannel, guild, reason = '')
{
    const m = joinVoiceNow (guildId, voiceChannel, guild, reason);
    if (m && m.connection) saveVoiceState (guildId);
    return m;
}

function joinVoiceNow (guildId, voiceChannel, guild, reason = '')
{
    const m = musicOf (guildId);
    if (!voiceChannel) return m;
    m.justJoinedAt = Date.now ();
    if (!m.connection)
    {
        m.connection = joinVoiceChannel
        (
            {
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
            }
        );
        console.log ('[' + (d()) + '] [music] подключился к «' + voiceChannel.name + '»');
        m.since = Date.now ();
        m.leaving = false;
        m.pending = false;
        m.leftByUser = false;
        m.selfLeftAt = 0;
        m.savedChannelId = voiceChannel.id;
        if (!m.playerWired)
        {
            m.playerWired = true;
            m.player.on (AudioPlayerStatus.Idle, () =>
            {
                const _deadErr = (m.streamHandle && m.streamHandle.proc) ? m.streamHandle.proc.lastErr : null;
                killStream (m.streamHandle);
                m.streamHandle = null;
                const _partFile = m.partFile;
                m.partFile = null;
                if (m.leaving) return;
                const playing = m.current;
                const at = playing ? Math.round (playedMsOf (m) / 1000) : 0;
                const asked = !!m.skipRequested;
                m.skipRequested = false;
                let _dropped = false;
                if (playing && !asked && isGoneError (_deadErr))
                {
                    console.error ('[' + (d()) + '] [music] видео больше нет на YouTube (' + (playing.title || 'трек') +
                        ') -- убираю из очереди: ' + ytDlpErr (_deadErr, 120));
                    deadDropNote (guildId);
                    trackNotice (guildId, playing, '🗑 **' + (playing.title || 'Трек') + '** -- видео больше нет на YouTube, убираю из очереди.');
                    m.current = null;
                    m.playedMs = 0;
                    m.playingSince = null;
                    m.streamRetries = 0;
                    playNext (guildId);
                    return;
                }
                if (playing && !asked && streamEndedEarly (playing, at, m.startedAtSec))
                {
                    const attempt = (m.streamRetries || 0) + 1;
                    if (attempt <= MUSIC_STREAM_RETRIES)
                    {
                        const _fromPart = !!_partFile;
                        if (_fromPart) cacheSpendPart (_partFile);
                        const seekTo = earlyEndResumeFrom (at, m.startedFromSeek, _fromPart, m.startedAtSec);
                        const fromStart = seekTo === 0;
                        m.streamRetries = _fromPart ? 0 : attempt;
                        m.playedMs = seekTo * 1000;
                        m.playingSince = null;
                        m.current = null;
                        m.tracks.unshift (playing);
                        m.seekTrack = playing;
                        m.seekSec = seekTo;
                        if (_fromPart)
                            console.error ('[' + (d()) + '] [music] недокачанный файл кончился (' +
                                (at ? 'на ' + fmtDur (at) : 'в самом начале') + ') -- ' +
                                (seekTo ? 'продолжаю тот же трек потоком, с этой же секунды'
                                        : 'звука в нём не оказалось -- беру трек с начала'));
                        else
                        console.error ('[' + (d()) + '] [music] поток оборвался (' +
                            (at ? 'на ' + fmtDur (at) : 'в самом начале') + ') -- трек не бросаю: играю его ' +
                            (fromStart ? 'с начала (продолжение с места не вышло)' : 'с этой же секунды') +
                            ', попытка ' + attempt + '/' + MUSIC_STREAM_RETRIES);
                        saveMusicState (guildId);
                        playNext (guildId);
                        return;
                    }
                    if ((_deadErr && isRouteError (_deadErr)) &&
                        musicNetStall (guildId, playing, at, _deadErr))
                        return;
                    console.error ('[' + (d()) + '] [music] поток обрывается снова (' + attempt +
                        ' раз) -- пропускаю: ' + (playing.title || 'трек'));
                    _dropped = true;
                }
                if (playing && !asked && !_dropped && repeatOn (guildId, playing.byId))
                {
                    playing.seek = 0;
                    m.tracks.push (playing);
                    console.log ('[' + (d()) + '] [music] 🔁 повтор (' + byNameOf (playing) + '): ' +
                        (playing.title || 'трек') + ' доиграл и встал в конец очереди (№' + m.tracks.length + ')' +
                        ' -- режим повтора у этого автора, выключить: /repeat');
                    scheduleVoiceStatus (guildId);
                    schedulePresence ();
                    saveMusicState (guildId);
                    queueMsgRedraw (guildId, 300).catch (() => {});
                }
                m.current = null;
                m.playedMs = 0;
                m.playingSince = null;
                m.streamRetries = 0;
                playNext (guildId);
            });
            m.player.on ('error', e => console.error ('[music] ошибка плеера: ' + oneLine (e.message)));
        }
        m.connection.subscribe (m.player);
        m.connection.on (VoiceConnectionStatus.Disconnected, async (oldState, newState) =>
        {
            const closeCode = (newState && typeof newState.closeCode === 'number') ? newState.closeCode : 0;
            try
            {
                await entersState (m.connection, VoiceConnectionStatus.Signalling, 5_000);
            }
            catch
            {
                destroyMusic (guildId, { unexpected: true, kicked: closeCode === 4014 });
            }
        });
        scheduleVoiceStatus (guildId, true);
        schedulePresence (true);
        return m;
    }
    if (m.connection.joinConfig.channelId !== voiceChannel.id)
    {
        const oldChId = m.connection.joinConfig.channelId;
        m.connection.rejoin ({ channelId: voiceChannel.id });
        m.savedChannelId = voiceChannel.id;
        console.log ('[' + (d()) + '] [music] перешёл в «' + voiceChannel.name + '»' + (reason ? ' -- ' + reason : ''));
        clearVoiceStatus (oldChId);
        scheduleVoiceStatus (guildId, true);
        schedulePresence (true);
    }
    return m;
}

function connectTo (interaction)
{
    return joinVoice (interaction.guildId, interaction.member.voice.channel, interaction.guild);
}

async function joinMusicChannel (interaction)
{
    const guildId = interaction.guildId;
    const m = musicOf (guildId);
    const voiceChannel = interaction.member && interaction.member.voice ? interaction.member.voice.channel : null;
    if (!voiceChannel)
        return interaction.reply ({ content: '🔊 Сначала зайди в голосовой канал!', flags: MessageFlags.Ephemeral });
    const here = !!m.connection && m.connection.joinConfig.channelId === voiceChannel.id;
    const myChId = m.connection ? m.connection.joinConfig.channelId : null;
    let stoleNote = '';
    if (myChId && myChId !== voiceChannel.id && m.current && !m.leaving)
    {
        const whoCall = interaction.member ? uuu (interaction.member) : interaction.user.username;
        const mineCh0 = client.channels.cache.get (myChId);
        const mineName0 = mineCh0 ? '«' + mineCh0.name + '»' : 'другом канале';
        if (authorVoiceId (guildId, m.current) === myChId)
        {
            const title = m.current.title || 'трек';
            const authorName = m.current.byName || u (m.current.byId);
            console.log ('[' + (d()) + '] [music] (кто: ' + whoCall + ') /join отклонён: играю для автора трека ' +
                authorName + ' в ' + mineName0);
            return interaction.reply
            ({
                content: '🎧 Не перееду: я играю **' + title + '** в ' + mineName0 +
                    ' для автора трека (' + authorName + ').\n' +
                    'Увести можно, когда он уйдёт, или командами `/skip` / `/stop` ✌️',
                flags: MessageFlags.Ephemeral,
            });
        }
        if (humansInChannel (guildId, myChId) > 0)
        {
            stoleNote = '🎧 В ' + mineName0 + ' оставались слушатели -- теперь они без музыки';
            console.log ('[' + (d()) + '] [music] (кто: ' + whoCall + ') /join увёл бота из ' + mineName0 +
                ' (автора трека там нет, но слушатели оставались)');
        }
    }
    connectTo (interaction);
    m.textChannelId = interaction.channelId;
    scheduleDeadScan (guildId);
    let resume = '';
    if (!m.current && m.tracks.length)
    {
        const next = m.tracks[0];
        const at = (m.seekTrack === next && m.seekSec) ? (next.isLive ? '' : ' с ' + fmtDur (m.seekSec)) : '';
        playNext (guildId);
        resume = ' Продолжаю очередь: **' + (next.title || 'трек') + '**' + at +
            (m.tracks.length ? ' (далее ещё ' + m.tracks.length + ')' : '');
    }
    const fromButton = typeof interaction.isButton === 'function' && interaction.isButton ();
    return interaction.reply
    ({
        content: (here
            ? '🎧 Я уже тут: **' + voiceChannel.name + '**. Выйти -- `/leave`.'
            : '🎧 Зашёл в **' + voiceChannel.name + '** и остаюсь. Выйти -- `/leave`.') +
            (stoleNote ? '\n' + stoleNote : '') +
            resume,
        ...(fromButton ? { flags: MessageFlags.Ephemeral } : {}),
    });
}

function leaveMusicVoice (guildId, actorId, who)
{
    const m = musicOf (guildId);
    if (!m.connection)
    {
        const wasWaiting = !!m.netWait;
        if (wasWaiting)
        {
            m.netWait = null;
            m.leftByUser = true;
            saveMusicState (guildId);
        }
        return { ok: false, text: '🤷 Я и так не в голосовом канале.' +
            (wasWaiting ? ' Возвращаться после обрыва больше не буду: очередь и место помню -- продолжить можно `/join`.' : '') };
    }
    const mine = t => !!t && isBy (t, actorId);
    const mineNow = !!(m.current && mine (m.current));
    const mineQ = m.tracks.filter (mine).length;
    const othersLeft = m.tracks.some (t => !mine (t)) || (!!m.current && !mine (m.current));
    if ((!mineNow && !mineQ) || !othersLeft)
    {
        destroyMusic (guildId, { who });
        const rest = m.tracks.length;
        return {
            ok: true,
            text: '👋 Вышел из голосового канала.' +
                (rest
                    ? ' Очередь помню: ' + rest + ' ' + plural (rest, 'трек', 'трека', 'треков') +
                      (m.seekTrack ? ' (начиная с **' + (m.seekTrack.title || 'трек') + '**' +
                          (m.seekSec && !m.seekTrack.isLive ? ' с ' + fmtDur (m.seekSec) : '') + ')' : '') +
                      ' -- продолжу по «Вход» (`/join`).'
                    : ''),
        };
    }
    const pos = m.current ? Math.max (0, Math.round (playedMsOf (m) / 1000)) : 0;
    const moved = [], rest = [];
    for (const t of m.tracks) (mine (t) ? moved : rest).push (t);
    if (m.current && mine (m.current))
    {
        const t = m.current;
        if (pos > 0 && !t.isLive) t.seek = pos;
        moved.unshift (t);
    }
    if (m.seekTrack && mine (m.seekTrack))
    {
        if (!m.seekTrack.seek) m.seekTrack.seek = Math.max (0, Math.round (m.seekSec || 0));
        m.seekTrack = null;
        m.seekSec = 0;
    }
    m.tracks = rest.concat (moved);
    m.current = null;
    m.playedMs = 0;
    m.playingSince = null;
    m.pausedByNobody = false;
    dropPreload (m);
    saveMusicState (guildId);
    try { m.player.stop (true); } catch (e) {  }
    scheduleVoiceStatus (guildId, true);
    schedulePresence (true);
    const next = m.tracks[0];
    const posTxt = pos ? ' (продолжу с ' + fmtDur (pos) + ')' : '';
    console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'отложил свои треки (' + moved.length + ')' +
        (pos ? ' вместе с местом в треке ' + fmtDur (pos) : '') +
        ' -- они уехали в конец очереди' + (next ? '; играю дальше: ' + (next.title || 'трек') : ''));
    return {
        ok: true,
        text: '⏸ Отложил твои треки (' + moved.length + ' ' + plural (moved.length, 'трек', 'трека', 'треков') +
            ')' + posTxt + ' -- они в конце очереди, уберутся сами, когда доиграют.' +
            (next ? ' Играю дальше: **' + (next.title || 'трек') + '**' : '') +
            '\n_Это не выход бота: чтобы он ушёл из канала -- `⏹ Очистка/Выход` (или `/stop`),' +
            ' а вернуть свои треки наверх могут админы и модеры («🔄 Подвинуть» в меню автора)._',
    };
}

function destroyMusic (guildId, opts = {})
{
    const m = $music[guildId];
    if (!m) return;
    m.selfLeftAt = Date.now ();
    const chId = (m.connection && m.connection.joinConfig ? m.connection.joinConfig.channelId : null) ||
        m.savedChannelId || null;
    const ch = chId ? client.channels.cache.get (chId) : null;
    const at = Math.round (playedMsOf (m) / 1000);
    m.leaving = true;
    m.playedMs = at * 1000;
    m.playingSince = null;
    dropPreload (m);
    cancelLongDownload (m);
    cacheFillStop (m);
    killStream (m.streamHandle);
    m.streamHandle = null;
    try { m.player.stop (true); } catch {}
    try { m.connection.destroy (); } catch {}
    m.connection = null;
    m.netWait = null;
    routeUseClear (guildId);
    if (opts.forget)
    {
        m.tracks = [];
        m.current = null;
        m.seekTrack = null;
        m.seekSec = 0;
        m.playedMs = 0;
        m.pending = false;
        m.pausedByNobody = false;
        m.playedToSomeone = false;
        clearMusicState (guildId);
    }
    else
    {
        if (m.current)
        {
            m.tracks.unshift (m.current);
            m.seekTrack = m.current;
            m.seekSec = at;
        }
        m.current = null;
        m.pending = true;
        m.pausedByNobody = false;
        m.leftByUser = !opts.unexpected || !!opts.kicked;
        saveMusicState (guildId);
    }
    if (opts.unexpected && !opts.forget && !m.leftByUser)
    {
        m.netWait = { tries: 0, at: Date.now (), lastWhy: 'связь с голосовым каналом пропала', rejoinAt: 0, rejoinLogged: false };
        voiceOutageStart (guildId, 'связь с голосовым каналом пропала');   // счёт обрывов: начало
        if (!chId || humansInChannel (guildId, chId) > 0)
            outageDown (guildId, m.seekTrack, at);
        if (chId)
            console.log ('[' + (d()) + '] [music] вернусь в «' + (ch ? ch.name : chId) +
                '» сам, как только связь ответит и там будут слушатели (место в треке помню; передумать -- /leave)');
    }
    if (opts.unexpected && !opts.forget && m.leftByUser)
        voiceOutageKicked (guildId);                 // счёт обрывов: выкинули -- сам не возвращаюсь
    if (!opts.unexpected && m.voiceOut)
        voiceOutageFinish (guildId, false, 'бот вышел сам, так и не дождавшись связи');
    if (opts.unexpected && !opts.forget) writeVoiceState (guildId, chId, false);
    else writeVoiceState (guildId, null, false);
    clearVoiceStatus (chId);
    if ($voiceStatus[guildId] && $voiceStatus[guildId].timer)
        clearTimeout ($voiceStatus[guildId].timer);
    delete $voiceStatus[guildId];
    schedulePresence (true);
    if (chId)
        console.log ('[' + (d()) + '] [music] ' + whoText (opts.who) + 'вышел из «' + (ch ? ch.name : chId) + '»' +
            (opts.forget
                ? ' (очередь очищена)'
                : ' (очередь сохранена' + (opts.unexpected ? ', обрыв связи' : '') + ': ' +
                  (m.seekTrack ? (m.seekTrack.title || 'трек') + ' ждёт, ' : '') +
                  restCount (m) + ' далее)'));
}

function fmtDur (sec, isLive = false)
{
    if (isLive) return '🔴 LIVE';
    if (!sec || sec <= 0) return '--:--';
    let h = sec / 3600 | 0, m = sec % 3600 / 60 | 0, s = sec % 60 | 0;
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s);
}

function nowPlayingLine (t, paused = false)
{
    if (!t) return null;
    return (paused ? '⏸ ' : (t.isLive ? '🔴 ' : '🎶 ')) + (t.title || 'трек') +
        (t.isLive ? '' : ' — ' + fmtDur (t.duration));
}

function isUrl (s)
{
    return /^https?:\/\//i.test (s);
}

const musicCommands =
[
    new SlashCommandBuilder ()
        .setName ('help')
        .setDescription ('Инструкция: как пользоваться ботом'),
    new SlashCommandBuilder ()
        .setName ('play')
        .setDescription ('Добавить в очередь: ссылка (YouTube/плейлист/эфир) или поиск')
        .addStringOption (o =>
            o.setName ('запрос')
             .setDescription ('Ссылка или название трека')
             .setRequired (true)),
    new SlashCommandBuilder ()
        .setName ('join')
        .setDescription ('Зайти в твой голосовой канал и остаться там (даже без музыки)'),
    new SlashCommandBuilder ()
        .setName ('stop')
        .setDescription ('Остановить музыку и очистить очередь'),
    new SlashCommandBuilder ()
        .setName ('skip')
        .setDescription ('Пропустить текущий трек -- своего (у админов и модеров -- любого)'),
    new SlashCommandBuilder ()
        .setName ('remove')
        .setDescription ('Убрать трек из очереди по номеру')
        .addIntegerOption (o =>
            o.setName ('number')
             .setDescription ('Номер трека в очереди (см. /queue)')
             .setMinValue (1)
             .setRequired (true)),
    new SlashCommandBuilder ()
        .setName ('move')
        .setDescription ('Переставить трек в очереди (0 -- то, что играет; DJ -- вниз свободно, вверх -- на своё)')
        .addIntegerOption (o =>
            o.setName ('number')
             .setDescription ('Какой трек двигать (номер из /queue; 0 -- играющий)')
             .setMinValue (0)
             .setRequired (true))
        .addIntegerOption (o =>
            o.setName ('to')
             .setDescription ('На какое место поставить (номер из /queue; 0 -- играть сразу)')
             .setMinValue (0)
             .setRequired (true)),
    new SlashCommandBuilder ()
        .setName ('clear')
        .setDescription ('Очистить очередь и остановить музыку (выйти, но помнить -- /leave)')
        .addUserOption (o =>
            o.setName ('author')
             .setDescription ('Убрать ТОЛЬКО треки этого человека (без него -- вся очередь)')),
    new SlashCommandBuilder ()
        .setName ('push')
        .setDescription ('Двинуть пачку автора: без номера -- наверх, с номером -- вместо пачки №N (админы/модеры)')
        .addUserOption (o =>
            o.setName ('author')
             .setDescription ('Чью пачку двинуть (без него -- твою)'))
        .addIntegerOption (o =>
            o.setName ('number')
             .setDescription ('Встать вместо какой ПАЧКИ (номер из /queue: «📚 Пачки»)')
             .setMinValue (1)),
    new SlashCommandBuilder ()
        .setName ('jump')
        .setDescription ('Перейти сразу к треку (DJ -- по своим, админы/модеры -- любым)')
        .addIntegerOption (o =>
            o.setName ('number')
             .setDescription ('Номер трека в очереди (см. /queue)')
             .setMinValue (1)
             .setRequired (true))
        .addStringOption (o =>
            o.setName ('mode')
            .setDescription ('Что делать с тем, что стояло до него (без ответа -- спрошу кнопками)')
            .addChoices (
                { name: 'Срочный переход -- прерванный вернётся в очередь со своего места', value: 'urgent' },
                { name: 'Обрезать до трека -- всё до него убрать насовсем', value: 'cut' })),
    new SlashCommandBuilder ()
        .setName ('seek')
        .setDescription ('Перейти к другому месту в текущем треке -- своего (время: 1:30, 83 или 0:05)')
        .addStringOption (o =>
            o.setName ('time')
             .setDescription ('Куда перейти: 90, 1:30 или 1:02:03 (0 -- с начала)')
             .setRequired (true)),
    new SlashCommandBuilder ()
        .setName ('pause')
        .setDescription ('Пауза'),
    new SlashCommandBuilder ()
        .setName ('resume')
        .setDescription ('Продолжить воспроизведение'),
    new SlashCommandBuilder ()
        .setName ('bans')
        .setDescription ('Активные баны и таймауты: кто, до какого времени и за что (админы/модеры)'),
    new SlashCommandBuilder ()
        .setName ('unban')
        .setDescription ('Снять таймаут или бан с человека (админы/модеры)')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('С кого снять наказание')
             .setRequired (true))
        .addStringOption (o =>
            o.setName ('reason')
             .setDescription ('Причина снятия (уйдёт в журнал и в аудит Discord)')
             .setMaxLength (400)),
    new SlashCommandBuilder ()
        .setName ('announce')
        .setDescription ('Опубликовать объявление от имени бота (админы/модеры)')
        .addStringOption (o =>
            o.setName ('text')
             .setDescription ('Текст объявления')
             .setMaxLength (2000)
             .setRequired (true))
        .addAttachmentOption (o =>
            o.setName ('file')
             .setDescription ('Вложение к объявлению (картинка, файл)'))
        .addChannelOption (o =>
            o.setName ('channel')
             .setDescription ('Куда опубликовать (по умолчанию -- в этот канал)')),
    new SlashCommandBuilder ()
        .setName ('dm')
        .setDescription ('Отправить человеку личное сообщение от имени бота (только админы)')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('Кому')
             .setRequired (true))
        .addStringOption (o =>
            o.setName ('text')
             .setDescription ('Текст сообщения (можно без текста, если есть файл)')
             .setMaxLength (2000))
        .addAttachmentOption (o =>
            o.setName ('file')
             .setDescription ('Вложение (картинка, файл)')),
    new SlashCommandBuilder ()
        .setName ('welcome')
        .setDescription ('Проверить приветствие: бот пришлёт в ЛС то, что видят новички')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('Кому прислать проверку (без него -- себе; другому -- админ/модер)')),
    new SlashCommandBuilder ()
        .setName ('forget')
        .setDescription ('Удалить сохранённые данные о человеке: роли и история наказаний (staff)')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('Чьи данные удалить')
             .setRequired (true)),
    new ContextMenuCommandBuilder ()
        .setName ('Переслать в общий')
        .setType (ApplicationCommandType.Message),
    new SlashCommandBuilder ()
        .setName ('rolecheck')
        .setDescription ('Что бот помнит о человеке: роли, наказания и что вернёт при входе (staff)')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('Кого проверить (можно любого, не только участника сервера)')
             .setRequired (true)),
    new SlashCommandBuilder ()
        .setName ('mydata')
        .setDescription ('Что бот помнит лично о тебе (роли, наказания, очередь) и как это удалить')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('О ком посмотреть (только админ/модер; без него -- о себе)')),
    new SlashCommandBuilder ()
        .setName ('rekey')
        .setDescription ('Сменить ключ шифрования базы (только владелец бота)')
        .setDefaultMemberPermissions (PermissionsBitField.Flags.Administrator),
    new SlashCommandBuilder ()
        .setName ('queue')
        .setDescription ('Показать очередь треков')
        .addIntegerOption (o =>
            o.setName ('from')
             .setDescription ('С какого номера показать (сколько на странице -- ключ queue_page, по умолчанию 15)')
             .setMinValue (1)),
    new SlashCommandBuilder ()
        .setName ('nowplaying')
        .setDescription ('Что играет сейчас: трек, позиция, кто поставил и что дальше'),
    new SlashCommandBuilder ()
        .setName ('health')
        .setDescription ('Здорова ли связь: обрывы голоса и сети и каким путём сейчас идёт звук'),
    new SlashCommandBuilder ()
        .setName ('history')
        .setDescription ('История добавлений: кто, когда и что поставил (треки, эфиры, плейлисты)'),
    new SlashCommandBuilder ()
        .setName ('repeat')
        .setDescription ('Повтор треков автора: не убирать после проигрывания (админы/модеры)')
        .addUserOption (o =>
            o.setName ('user')
             .setDescription ('Чей повтор переключить (без него -- свой)')),
    new SlashCommandBuilder ()
        .setName ('repeat-list')
        .setDescription ('Кто сейчас в режиме повтора и сколько у него треков в очереди'),
    new SlashCommandBuilder ()
        .setName ('leave')
        .setDescription ('Отложить свои треки и играть чужое; из канала выхожу, если играть нечего'),
    new SlashCommandBuilder ()
        .setName ('filter')
        .setDescription ('Фильтр очереди по названию: убрать найденные или оставить только их')
        .addStringOption (o =>
            o.setName ('text')
             .setDescription ('Подстрока в названии трека (без учёта регистра)')
             .setMaxLength (FILTER_TEXT_MAX)
             .setRequired (true))
        .addStringOption (o =>
            o.setName ('mode')
             .setDescription ('Что сделать с найденными')
             .setRequired (true)
             .addChoices
             (
                 { name: '🗑 Удалить найденные', value: 'remove' },
                 { name: '✅ Оставить только найденные', value: 'keep' }
             ))
        .addStringOption (o =>
            o.setName ('scope')
             .setDescription ('Где искать (без этого -- во всей очереди)')
             .addChoices
             (
                 { name: '👥 Во всех треках', value: 'all' },
                 { name: '🙋 Только в моих', value: 'mine' }
             )),
].map (c => c.toJSON ());

async function registerMusicCommands ()
{
    const appId = (client.user && client.user.id) || APP_ID_FOR_REGISTER;
    if (!appId)
    {
        console.log ('[' + (d()) + '] [music] слэш-команды НЕ зарегистрированы: не нашёл id приложения -- ' +
            'ни в ключе ID, ни в TOKEN. Это Application ID из Developer Portal -- впиши его в config.json');
        return;
    }
    if (!CONFIG_APP_ID && TOKEN_APP_ID)
        console.log ('[' + (d()) + '] [music] ID в конфиге не задан -- беру из TOKEN: ' + TOKEN_APP_ID + ' (слэш-команды будут на месте)');
    else if (APP_ID_MISMATCH)
        console.log ('[' + (d()) + '] [music] ВНИМАНИЕ: ID в конфиге (' + CONFIG_APP_ID + ') не совпадает с токеном (' + TOKEN_APP_ID +
            ') -- регистрирую по токену, иначе Discord отвечает 404');
    const rest = new REST ({ version: '10' }).setToken (TOKEN);
    for (let server in SERVERS)
    {
        if (!SERVERS[server].allow) continue;
        try
        {
            await rest.put
            (
                Routes.applicationGuildCommands (appId, server),
                { body: musicCommands }
            );
            console.log ('[' + (d()) + '] [music] команды зарегистрированы (слэш + «Переслать в общий» на сообщении) @ ' + SERVERS[server].name);
        }
        catch (e)
        {
            const _code = Number ((e && (e.status || e.code)) || 0);
            console.error ('[music] ошибка регистрации команд @ ' + server + ': ' + e.message +
                (_code === 401 ? ' -- Discord не принял TOKEN (401): проверь его в Developer Portal' :
                    _code === 404 ? ' -- Discord не знает такое приложение (404): проверь ID приложения (или TOKEN -- они от одного приложения?)' :
                        _code === 403 ? ' -- у бота нет права ставить команды на этом сервере (403)' : ''));
        }
    }
}

const QUEUE_ACTIONS =
[
    [/^q:p:first:/, '⏮ В начало'],
    [/^q:p:prev:/, '◀ Влево'],
    [/^q:n:next:/, 'Вправо ▶'],
    [/^q:n:last:/, 'В конец ⏭'],
    [/^q:[pn]:/, 'листание очереди'],
    [/^q:rf:/, '🔄 Обновить'],
    [/^q:hg:first:/, '⏮ В начало (история)'],
    [/^q:hg:prev:/, '◀ Влево (история)'],
    [/^q:hg:next:/, 'Вправо ▶ (история)'],
    [/^q:hg:last:/, 'В конец ⏭ (история)'],
    [/^q:hi$/, '📜 Все треки'],
    [/^q:hsel$/, '📜 Какую пачку раскрыть?'],
    [/^q:hp:/, '📜 листание состава пачки'],
    [/^q:hre:/, '▶ Поставить заново'],
    [/^q:hget$/, '⤓ Взять в очередь один трек'],
    [/^q:hclose$/, '✖ Закрыть'],
    [/^q:s:m$/, '◀ 30 с'],
    [/^q:s:p$/, '30 с ▶'],
    [/^q:sk:/, '⏱ На таймкод…'],
    [/^q:skt:/, '⏱ На таймкод… (окно ввода)'],
    [/^q:skip$/, '⏭ Пропустить'],
    [/^q:jmp$/, '⤴ Другой трек'],
    [/^q:jp:x/, '⤴ Другой трек: отмена'],
    [/^q:jp:u:/, '⤴ Срочный переход'],
    [/^q:jp:c:/, '✂ Обрезать до трека'],
    [/^q:jsel$/, '⤴ выбор трека'],
    [/^q:jpage:/, '⤴ листание списка треков'],
    [/^q:jclose$/, '✖ Закрыть'],
    [/^q:join$/, '▶ Войти'],
    [/^q:leave$/, '⏏ Выйти'],
    [/^q:flt:/, '🧽 Фильтр… (окно ввода)'],
    [/^q:flt$/, '🧽 Фильтр…'],
    [/^q:fl:c:/, '🧽 Фильтр: убрать найденные'],
    [/^q:fl:x/, '🧽 Фильтр: отмена'],
    [/^q:fl:k/, '🧽 Фильтр: понятно'],
    [/^q:clear$/, '🧹 Очистить'],
    [/^q:stop$/, '🧹⏏ Очистка/Выход'],
    [/^q:cq:own/, '🧹 Очистить: только свои'],
    [/^q:cq:all/, '🧹 Очистить: всю очередь'],
    [/^q:cq:x/, '🧹 Очистить: отмена'],
    [/^q:da$/, '👤 Автор: подвинуть или убрать…'],
    [/^q:dau:/, '🔄 Подвинуть пачку (прежняя кнопка)'],
    [/^q:dap:/, '🔄 Подвинуть пачку'],
    [/^q:dapp:/, '🔄 Подвинуть: листание мест'],
    [/^q:daps:/, '🔄 Подвинуть: выбор места'],
    [/^q:dacl$/, '✖ Закрыть'],
    [/^q:dax:/, '🗑 Удалить автора'],
    [/^q:dx$/, '✖ Отмена'],
    [/^q:tr:/, '🗂 трек: подвинуть или убрать'],
    [/^q:rx:/, '🗑 Убрать'],
    [/^q:mt:/, '⏫ В начало'],
    [/^q:mb:/, '⏬ В конец'],
    [/^q:mp:/, '#️⃣ На позицию…'],
    [/^q:mpos:/, '#️⃣ На позицию… (окно ввода)'],
    [/^q:mz:/, '▶ Играющим'],
    [/^q:mu:/, '⬆ Выше'],
    [/^q:md:/, '⬇ Ниже'],
    [/^q:mx:/, '✖ Вернуться'],
    [/^q:mvh:/, '🚚 Перейти'],
    [/^q:mvn/, '✖ Остаться'],
    [/^q:mv/, 'меню: куда играть'],
];
function queueActionName (cid)
{
    const s = String (cid || '');
    for (const [re, name] of QUEUE_ACTIONS) if (re.test (s)) return name;
    return s;
}
function logQueueAction (interaction, who)
{
    const cid = interaction.customId || '';
    if (!/^q:/.test (cid)) return;
    console.log ('[' + (d()) + '] [btn] ' + whoText (who) + queueActionName (cid) +
        (interaction.channel && interaction.channel.name ? ' @ #' + interaction.channel.name : ''));
}

client.on ('interactionCreate', async (interaction) =>
{
    shieldOutgoing (interaction);
    if (typeof interaction.isModalSubmit === 'function' && interaction.isModalSubmit ())
    {
        const guildId = interaction.guildId;
        if (!(guildId in SERVERS)) return;
        logQueueAction (interaction, interaction.member ? uuu (interaction.member) : interaction.user.username);
        if (/^q:skt:(\d+)$/.test (interaction.customId || ''))
        {
            const page0 = parseInt (/^q:skt:(\d+)$/.exec (interaction.customId)[1], 10) || 1;
            if (!isDJ (interaction))
            {
                const role_dj = SERVERS[guildId].role_dj || '';
                return interaction.reply
                (
                    {
                        content: '🚫 Музыка только для ' + (role_dj ? '<@&' + role_dj + '>' : 'DJ'),
                        flags: MessageFlags.Ephemeral,
                    }
                );
            }
            const m0 = musicOf (guildId);
            const raw0 = String (interaction.fields.getTextInputValue ('time') || '').trim ();
            const who0 = interaction.member ? uuu (interaction.member) : interaction.user.username;
            const to0 = parseSeekTime (raw0);
            if (to0 === null)
                return interaction.reply
                (
                    {
                        content: '🤔 Не понял время: `' + raw0.slice (0, 20) + '`.\n' +
                            'Напиши, куда перемотать: `90` (секунды), `1:30` (минуты) или `1:02:03`.',
                        flags: MessageFlags.Ephemeral,
                    }
                );
            const res0 = seekMusic (guildId, to0, who0,
                { actorId: interaction.user.id, actorName: who0, staff: isStaffInteraction (interaction) });
            if (!res0.ok)
                return interaction.reply ({ content: res0.text, flags: MessageFlags.Ephemeral });
            const ctx0 = { actorId: interaction.user.id, actorName: who0, staff: isStaffInteraction (interaction) };
            setTimeout (() =>
            {
                const view0 = queueView (m0, page0, 0, ctx0);
                if (interaction.message && typeof interaction.message.edit === 'function')
                    interaction.message.edit (fitPayload ({ content: view0.content, components: view0.components, allowedMentions: { parse: [] } })).catch (() => {});
            }, 1500);
            return interaction.reply ({ content: res0.text, flags: MessageFlags.Ephemeral });
        }
        const mFlt = /^q:flt:(\d+)?$/.exec (interaction.customId || '');
        if (mFlt)
        {
            if (!isStaffInteraction (interaction))
                return interaction.reply ({ content: '🚫 Фильтр очереди -- только админы и модеры.', flags: MessageFlags.Ephemeral });
            const m0 = musicOf (guildId);
            const text0 = filterTextOf (interaction.fields.getTextInputValue ('text'));
            if (!text0)
                return interaction.reply ({ content: '🤔 Пустая подстрока -- искать нечего.', flags: MessageFlags.Ephemeral });
            const pickSel0 = (id) =>
            {
                try { return String ((interaction.fields.getStringSelectValues (id) || [])[0] || ''); }
                catch (e) { return ''; }
            };
            const mode0 = (pickSel0 ('mode') === 'keep') ? 'keep' : 'remove';
            const scope0 = (pickSel0 ('scope') === 'mine') ? 'mine' : 'all';
            const c0 = queueFilterConfirm (m0, mode0, text0, scope0, interaction.user.id, mFlt[1] || '0');
            return interaction.reply ({ content: c0.text, components: c0.rows, flags: MessageFlags.Ephemeral });
        }
        const mMpos = /^q:mpos:(\d+)$/.exec (interaction.customId || '');
        if (!mMpos) return;
        const m = musicOf (guildId);
        const n = parseInt (mMpos[1], 10) || 0;
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        const staff2 = isStaffInteraction (interaction);
        const to = parseInt (String (interaction.fields.getTextInputValue ('pos') || '').replace (/\D+/g, ''), 10);
        if (!Number.isInteger (to) || to < 0 || to > m.tracks.length)
            return interaction.reply ({ content: '🤔 В очереди ' + m.tracks.length + ' треков -- номер от 1 до ' +
                m.tracks.length + (m.current ? ', а `0` -- начать играть прямо сейчас (то, что играет, вернётся в очередь)' : '') + '.', flags: MessageFlags.Ephemeral });
        const res = queueMove (guildId, n, to, who, { staff: staff2, actorId: interaction.user.id });
        if (!res.ok)
            return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
        console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'поставил №' + n + ' на позицию №' + to + ' (окно ввода)');
        const view2 = queueView (m, queuePageOf (m, res.to), res.to,
            { actorId: interaction.user.id, actorName: who, staff: staff2 });
        if (interaction.message && typeof interaction.message.edit === 'function')
            await interaction.message.edit (fitPayload ({ content: view2.content, components: view2.components, allowedMentions: { parse: [] } })).catch (() => {});
        return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
    }
    if (interaction.isButton () || interaction.isStringSelectMenu ())
    {
        const cid = interaction.customId || '';
        const guildId = interaction.guildId;
        if (!(guildId in SERVERS)) return;
        if (/^h:voice:real$/.test (cid))
        {
            if (!isBotOwner (interaction.user.id))
                return interaction.reply ({ content: '🚫 По-настоящему проверять голос может только владелец бота.', flags: MessageFlags.Ephemeral });
            if (voiceRealBusy)
                return interaction.reply ({ content: '🔊 Уже проверяю -- допишу сюда, когда закончу.', flags: MessageFlags.Ephemeral });
            voiceRealBusy = true;
            await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
            try
            {
                const r = await voiceRealCheck (guildId);
                return interaction.editReply ({ content: voiceRealText (r) });
            }
            catch (e)
            {
                return interaction.editReply ({ content: '🔊 Проверка сорвалась: ' + oneLine ((e && e.message) || e) });
            }
            finally { voiceRealBusy = false; }
        }
        if (/^h:dpi:start$/.test (cid))
        {
            if (!isBotOwner (interaction.user.id))
                return interaction.reply ({ content: '🚫 Обходом может управлять только владелец бота.', flags: MessageFlags.Ephemeral });
            await interaction.reply ({ content: '▶ Поднимаю обход сохранённой стратегией.\n' +
                'Сейчас Windows спросит разрешение -- подтверди, иначе ничего не меняется. Напишу, когда проверю, что всё отвечает.' });
            dpiStartFromDiscord ().catch (() => { });
            return;
        }
        if (/^h:dpi:pick$/.test (cid))
        {
            if (!isBotOwner (interaction.user.id))
                return interaction.reply ({ content: '🚫 Подбирать обход может только владелец бота.', flags: MessageFlags.Ephemeral });
            const _list = await dpiToolRun (['-List'], 30000);
            const _n = (String (_list.out || '').match (/ :: /g) || []).length;
            await interaction.reply ({ content: '🛠 Подбираю обход' + (_n ? ': пресетов ' + _n + ', это примерно ' + Math.max (1, Math.round ((_n * 10 + 30) / 60)) + ' мин' : '') + '.\n' +
                'Сейчас Windows спросит разрешение -- подтверди, иначе ничего не меняется.\n' +
                'На время подбора обход останавливается: команды и музыка не работают, потом встанет лучшая стратегия. Напишу сюда и в журнал, когда закончу.' });
            dpiPickFromDiscord ().catch (() => { });
            return;
        }
        const m = musicOf (guildId);
        const mOwn = /^(?:q:rm|q:mv|q:mx):(\d+)$/.exec (cid);
        const page = mOwn ? (parseInt (mOwn[1], 10) || 1) : 1;
        const staff = isStaffInteraction (interaction);
        const ctx =
        {
            actorId: interaction.user.id,
            actorName: interaction.member ? uuu (interaction.member) : interaction.user.username,
            staff: staff,
        };
        logQueueAction (interaction, ctx.actorName);
        const replyView = async (at = page, moveSel = 0) =>
        {
            const view = queueView (m, at, moveSel, ctx);
            await interaction.update ({ content: view.content, components: view.components, allowedMentions: { parse: [] } });
            queueWatch (m, interaction.message, ctx, at, view.content, moveSel);
        };
        const mPage = /^q:(rf|[pn])(?::(?:first|prev|next|last))?:(\d+)$/.exec (cid);
        if (mPage)
        {
            const opener = interaction.message && interaction.message.interaction && interaction.message.interaction.user
                ? interaction.message.interaction.user.id
                : null;
            if (opener && opener !== interaction.user.id)
                return interaction.reply
                (
                    { content: '📜 Эту очередь открыл другой человек -- вызови `/queue` сам.', flags: MessageFlags.Ephemeral }
                );
            return replyView (parseInt (mPage[2], 10) || 1);
        }
        const mJp = /^q:jp:(x|u|c)(?::(\d+))?$/.exec (cid);
        if (mJp)
        {
            if (mJp[1] === 'x')
                return interaction.update ({ content: '✖ Прыжок отменён -- очередь на месте.', components: [] });
            const res = jumpMusic (guildId, parseInt (mJp[2], 10) || 0, mJp[1] === 'c',
                { actorId: interaction.user.id, staff: staff, who: ctx.actorName });
            if (res.ok) queueMsgRedraw (guildId, 1500).catch (() => {});
            return interaction.update ({ content: (res.ok ? '' : '⚠️ ') + res.text, components: [] });
        }
        const mHg = /^q:hg:(?:first|prev|next|last):(\d+)$/.exec (cid);
        if (mHg)
        {
            const opener = interaction.message && interaction.message.interaction && interaction.message.interaction.user
                ? interaction.message.interaction.user.id
                : null;
            if (opener && opener !== interaction.user.id)
                return interaction.reply
                (
                    { content: '🕘 Эту историю открыл другой человек -- вызови `/history` сам.', flags: MessageFlags.Ephemeral }
                );
            await historyLoad (guildId);
            const at = parseInt (mHg[1], 10) || 1;
            return interaction.update
            ({ content: historyText (guildId, at), components: historyComponents (guildId, at) });
        }
        if (cid === 'q:hi')
        {
            await historyLoad (guildId);
            const rows = historyPickRows (m.history);
            if (!rows)
                return interaction.reply
                ({ content: '🕘 Раскрывать нечего -- истории добавлений пока нет.', flags: MessageFlags.Ephemeral });
            return interaction.reply
            ({
                content: '📜 **Состав пачки** -- выбери, какую раскрыть (последние ' + m.history.length + '):',
                components: rows,
                flags: MessageFlags.Ephemeral,
            });
        }
        if (cid === 'q:hclose')
            return interaction.update ({ content: '✖ Закрыто.', components: [] });
        const mHsel = (cid === 'q:hsel') ? String ((interaction.values || [])[0] || '') : null;
        const mHp = mHsel === null ? /^q:hp:(\d+):(-?\d+)$/.exec (cid) : null;
        if (mHsel !== null || mHp)
        {
            await historyLoad (guildId);
            const at = mHsel !== null ? mHsel : mHp[1];
            const off = mHp ? (parseInt (mHp[2], 10) || 0) : 0;
            const e = historyFind (m.history, at);
            if (!e)
                return interaction.update
                ({ content: '🕘 Этой пачки в истории уже нет -- она ушла по лимиту. Вызови `/history` заново.', components: [] });
            const v = historyExpandView (e, off);
            return interaction.update ({ content: v.text, components: v.rows });
        }
        const isFilterCid = /^q:flt?(:|$)/.test (cid);
        const isPackCid = /^q:(?:da|dau|dap|dapp|daps|dacl|dax)(:|$)/.test (cid);
        if (!/^q:(skip|join|leave|clear|stop|da|dau|dap|dapp|daps|dacl|dax|dx|cq|rm|mv|mt|mb|mp|mu|md|mx|s|sk|tr|rx|jmp|jsel|jpage|jclose|hre|hget|fl|flt)(:|$)/.test (cid)) return;
        if (!isDJ (interaction) && !(staff && (isFilterCid || isPackCid)))
        {
            const role_dj = SERVERS[guildId].role_dj || '';
            return interaction.reply
            (
                {
                    content: '🚫 Музыка только для ' + (role_dj ? '<@&' + role_dj + '>' : 'DJ'),
                    flags: MessageFlags.Ephemeral,
                }
            );
        }
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        const mHre = /^q:hre:(\d+)$/.exec (cid);
        if (mHre)
        {
            await interaction.update ({ content: '⏳ Ставлю пачку заново (спрашиваю YouTube)...', components: [] });
            const res = await historyReAdd (guildId, mHre[1], interaction.user.id,
                interaction.user.username, interaction.channelId);
            console.log ('[' + (d()) + '] [music] (кто: ' + who + ') поставил пачку из /history заново: ' +
                (res.ok ? 'ок' : 'не вышло'));
            queueMsgRedraw (guildId, 300).catch (() => {});
            return interaction.editReply ({ content: (res.ok ? '' : '⚠️ ') + res.text });
        }
        if (cid === 'q:hget')
        {
            const idGet = String ((interaction.values || [])[0] || '');
            if (!historyLinkOf (idGet))
                return interaction.update ({ content: '🕘 Этот трек взять не из чего -- в записи нет его адреса.', components: [] });
            await interaction.update ({ content: '⏳ Беру трек из пачки (спрашиваю YouTube)...', components: [] });
            const one = await historyReAddOne (guildId, idGet, interaction.user.id,
                interaction.user.username, interaction.channelId);
            console.log ('[' + (d()) + '] [music] (кто: ' + who + ') взял из пачки /history один трек: ' +
                (one.ok ? 'ок' : 'не вышло'));
            queueMsgRedraw (guildId, 300).catch (() => {});
            return interaction.editReply ({ content: (one.ok ? '' : '⚠️ ') + one.text });
        }
        if (cid === 'q:jmp')
        {
            if (!m.tracks.length)
                return interaction.reply ({ content: '🈳 В очереди нет треков -- перепрыгивать некуда.', flags: MessageFlags.Ephemeral });
            const rows = jumpPickerRows (m, ctx.actorId, staff, 0);
            if (!rows)
                return interaction.reply
                ({
                    content: '🈳 Своих треков в очереди нет -- другой брать неоткуда.\n' +
                        '_Чужой трек они могут пропустить только админы и модеры._',
                    flags: MessageFlags.Ephemeral,
                });
            return interaction.reply
            ({
                content: jumpPickerText (),
                components: rows,
                flags: MessageFlags.Ephemeral,
            });
        }
        const mJpage = /^q:jpage:(-?\d+)$/.exec (cid);
        if (mJpage)
        {
            const rows = jumpPickerRows (m, ctx.actorId, staff, parseInt (mJpage[1], 10) || 0);
            if (!rows)
                return interaction.update ({ content: '🈳 В очереди больше нечего выбрать -- вызови `/queue` заново.', components: [] });
            return interaction.update ({ content: jumpPickerText (), components: rows });
        }
        if (cid === 'q:jclose')
            return interaction.update ({ content: '✖ Список закрыт -- очередь не тронута.', components: [] });
        if (cid === 'q:jsel')
        {
            const nSel = parseInt (String ((interaction.values || [])[0] || ''), 10) || 0;
            if (!(nSel >= 1 && nSel <= m.tracks.length))
                return interaction.update ({ content: '🤔 Такого трека в очереди уже нет -- вызови `/queue` заново.', components: [] });
            const c = jumpConfirm (nSel);
            return interaction.update ({ content: c.text, components: c.rows });
        }
        const mTopBot = /^q:m([tb]):(\d+)$/.exec (cid);
        if (mTopBot)
        {
            const n = parseInt (mTopBot[2], 10) || 0;
            const res = queueMove (guildId, n, mTopBot[1] === 't' ? 1 : m.tracks.length, who, ctx);
            if (!res.ok)
                return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
            const at = queuePageOf (m, res.to);
            await replyView (at, res.to);
            return interaction.followUp ({ content: res.text, flags: MessageFlags.Ephemeral });
        }
        const mPlay = /^q:mz:(\d+)$/.exec (cid);
        if (mPlay)
        {
            const res = queueMove (guildId, parseInt (mPlay[1], 10) || 0, 0, ctx.actorName, ctx);
            if (!res.ok)
                return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
            await replyView (1, 0);
            return interaction.followUp ({ content: res.text, flags: MessageFlags.Ephemeral });
        }
        const mTcodeAsk = /^q:sk:(\d+)$/.exec (cid);
        if (mTcodeAsk)
        {
            if (!m.current)
                return interaction.reply ({ content: '🤷 Сейчас ничего не играет -- перематывать нечего.', flags: MessageFlags.Ephemeral });
            if (m.current.isLive)
                return interaction.reply ({ content: '🔴 Это прямой эфир -- позиции у него нет (`/seek 0` -- перейти к живому краю).', flags: MessageFlags.Ephemeral });
            const at = Math.max (0, Math.round (playedMsOf (m) / 1000));
            const tcodeDur = Number (m.current.duration) > 0 ? Number (m.current.duration) : 0;
            const tcodeTitle = 'Перемотать: ' + clipText (String (m.current.title || 'трек'), 30);
            return interaction.showModal
            (
                new ModalBuilder ().setCustomId ('q:skt:' + mTcodeAsk[1])
                    .setTitle (tcodeTitle.slice (0, 45))
                    .addComponents
                    (
                        new ActionRowBuilder ().addComponents
                        (
                            new TextInputBuilder ()
                                .setCustomId ('time')
                                .setLabel ((tcodeDur ? 'Куда перемотать (из ' + fmtDur (tcodeDur) + ')'
                                                     : 'Куда перемотать (сейчас ' + fmtDur (at) + ')').slice (0, 45))
                                .setPlaceholder (('сейчас ' + fmtDur (at) + '; можно 90, 1:30 или 1:02:03').slice (0, 100))
                                .setStyle (TextInputStyle.Short)
                                .setRequired (true).setMaxLength (8)
                                .setValue (fmtDur (at))
                        )
                    )
            );
        }
        const mPosAsk = /^q:mp:(\d+)$/.exec (cid);
        if (mPosAsk)
            return interaction.showModal
            (
                new ModalBuilder ().setCustomId ('q:mpos:' + mPosAsk[1])
                    .setTitle ('Переставить трек №' + mPosAsk[1])
                    .addComponents
                    (
                        new ActionRowBuilder ().addComponents
                        (
                            new TextInputBuilder ()
                                .setCustomId ('pos')
                                .setLabel (('На какое место (' + (m.current ? '0-' : '1-') + m.tracks.length +
                                    (m.current ? ', 0 -- играющим' : '') + ')').slice (0, 45))
                                .setStyle (TextInputStyle.Short)
                                .setRequired (true).setMaxLength (4).setValue (mPosAsk[1])
                        )
                    )
            );
        const mStep = /^q:m([ud]):(\d+)$/.exec (cid);
        if (mStep)
        {
            const n = parseInt (mStep[2], 10) || 0;
            const res = queueMove (guildId, n, mStep[1] === 'u' ? n - 1 : n + 1, who, ctx);
            if (!res.ok)
                return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
            const at = queuePageOf (m, res.to);
            await replyView (at, res.to);
            return interaction.followUp ({ content: res.text, flags: MessageFlags.Ephemeral });
        }
        if (/^q:mx(:|$)/.test (cid)) return replyView (page, 0);
        if (/^q:mv(:|$)/.test (cid))
        {
            const sel = parseInt ((interaction.values || [])[0], 10) || 0;
            if (!sel)
                return interaction.reply ({ content: '🤔 Не понял, какой трек двигать.', flags: MessageFlags.Ephemeral });
            return replyView (page, sel);
        }
        const queueKeptPage = (srcId, fallback = page) =>
        {
            const w = queueWatchOf (m, srcId);
            if (w) return Math.max (1, Number (w.page) || 1);
            return Math.max (1, Number (fallback) || 1);
        };
        const refreshQueueMsg = async (srcId) =>
        {
            if (!srcId || srcId === '0') return queueMsgRedraw (guildId, 0).catch (() => {});
            if (!interaction.channel ||
                typeof interaction.channel.messages.fetch !== 'function') return;
            const src = await interaction.channel.messages.fetch (srcId).catch (() => null);
            if (src && src.editable)
            {
                const openerId = (src.interaction && src.interaction.user) ? src.interaction.user.id : ctx.actorId;
                const opener = (interaction.guild && interaction.guild.members)
                    ? interaction.guild.members.cache.get (openerId) : null;
                const oCtx = (openerId === ctx.actorId) ? ctx :
                {
                    actorId: openerId,
                    actorName: opener ? uuu (opener) : openerId,
                    staff: isStaffInteraction ({ guildId: interaction.guildId, member: opener }),
                };
                const at = queueKeptPage (srcId);
                const view = queueView (m, at, 0, oCtx);
                await src.edit (fitPayload ({ content: view.content, components: view.components, allowedMentions: { parse: [] } })).catch (() => {});
                const w2 = queueWatchOf (m, srcId);
                if (w2)
                {
                    w2.text = view.content;
                    w2.page = at;
                    w2.move = 0;
                    w2.at = Date.now ();
                    w2.err = false;
                }
                else queueWatch (m, src, oCtx, at, view.content, 0);
            }
        };
        const msgId = interaction.message ? interaction.message.id : '0';
        const mSeek = /^q:s:([mp])$/.exec (cid);
        if (mSeek)
        {
            const res = queueSeekBy (guildId, mSeek[1] === 'm' ? -30 : 30, who, ctx);
            if (res.ok) setTimeout (() => { refreshQueueMsg (msgId).catch (() => {}); }, 1500);
            return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
        }
        const mTr = /^q:tr:(\d+)$/.exec (cid);
        if (mTr)
        {
            const sel = parseInt ((interaction.values || [])[0], 10) || 0;
            if (!sel)
                return interaction.reply ({ content: '🤔 Не понял, какой трек выбран.', flags: MessageFlags.Ephemeral });
            return replyView (parseInt (mTr[1], 10) || 1, sel);
        }
        const mRx = /^q:rx:(\d+):(\d+)$/.exec (cid);
        if (mRx)
        {
            const res = queueRemove (guildId, parseInt (mRx[1], 10) || 0, who, ctx);
            if (!res.ok)
                return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
            await replyView (parseInt (mRx[2], 10) || 1);
            return interaction.followUp ({ content: res.text, flags: MessageFlags.Ephemeral });
        }
        if (/^q:mvn(:|$)/.test (cid))
            return interaction.update
            ({
                content: interaction.message.content.replace (/\n❔[^\n]*$/, '') + '\n✖ Остаюсь там, где играл.',
                components: [],
            });
        const mMvh = /^q:mvh:(\d+):(\d+)$/.exec (cid);
        if (mMvh)
        {
            if (interaction.user.id !== ctx.actorId)
                return interaction.reply ({ content: '🚫 Это предложение было не тебе — `/play` вызывал другой человек.', flags: MessageFlags.Ephemeral });
            const chId = mMvh[2];
            const ch = client.channels.cache.get (chId) || await client.channels.fetch (chId).catch (() => null);
            if (!ch)
                return interaction.reply ({ content: '🤔 Канала уже нет — никуда не переезжаю.', flags: MessageFlags.Ephemeral });
            const nowVoice = interaction.member && interaction.member.voice ? interaction.member.voice.channelId : null;
            if (nowVoice !== chId)
                return interaction.reply ({ content: '🤔 Ты уже не в «' + ch.name + '» — никуда не переезжаю.', flags: MessageFlags.Ephemeral });
            try { joinVoice (guildId, ch, interaction.guild, 'по просьбе ' + ctx.actorName); }
            catch (e)
            {
                console.error ('[music] переезд по просьбе не удался: ' + oneLine (e.message));
                return interaction.reply ({ content: '⚠️ Не смог переехать: ' + oneLine (e.message), flags: MessageFlags.Ephemeral });
            }
            m.savedChannelId = ch.id;
            console.log ('[' + (d()) + '] [music] ' + ctx.actorName + ': переехал в «' + ch.name + '» по просьбе (из /play)');
            return interaction.update
            ({
                content: interaction.message.content.replace (/\n❔[^\n]*$/, '') + '\n🚚 Переехал в «' + ch.name + '».',
                components: [],
            });
        }
        if (cid === 'q:join') return joinMusicChannel (interaction);
        if (cid === 'q:leave')
        {
            const res = leaveMusicVoice (guildId, ctx.actorId, who);
            await refreshQueueMsg (msgId);
            return interaction.reply ({ content: res.ok ? res.text : '⚠️ ' + res.text, flags: MessageFlags.Ephemeral });
        }
        const askClear = leave =>
        {
            const c = queueClearConfirm (m, ctx.actorId, staff, { leave: leave, msgId: msgId });
            return interaction.reply ({ content: c.text, components: c.rows, flags: MessageFlags.Ephemeral });
        };
        const mCq = /^q:cq:(own|all|x)(?::(\d*))?$/.exec (cid);
        if (mCq)
        {
            if (mCq[1] === 'x')
                return interaction.update ({ content: '✖ Отменено -- очередь на месте.', components: [] });
            if (mCq[1] === 'all' && !staff)
                return interaction.reply
                ({ content: '🚫 Всю очередь убирают админы и модеры -- обычный DJ распоряжается только своими записями.', flags: MessageFlags.Ephemeral });
            const res = queueClear (guildId, who, { scope: mCq[1], actorId: ctx.actorId });
            await refreshQueueMsg (mCq[2]);
            return interaction.update ({ content: res.ok ? res.text : '⚠️ ' + res.text, components: [] });
        }
        if (cid === 'q:flt')
        {
            if (!staff)
                return interaction.reply
                ({
                    content: '🚫 Фильтр очереди -- только админы и модеры.\n_Обычный DJ распоряжается своими записями: ' +
                        '«🗂 Трек: подвинуть или убрать…» под `/queue` и `/remove`._',
                    flags: MessageFlags.Ephemeral,
                });
            if (!m.tracks.length && !m.current)
                return interaction.reply ({ content: '🈳 Очередь пуста -- фильтровать нечего.', flags: MessageFlags.Ephemeral });
            return interaction.showModal (filterModal (msgId));
        }
        const mFl = /^q:fl:(c|x|k)(?::(\d+))?$/.exec (cid);
        if (mFl)
        {
            const ask = m.filterAsk;
            if (mFl[1] === 'k')
            {
                m.filterAsk = null;
                return interaction.update ({ content: '✖ Очередь не менялась -- фильтровать было нечего.', components: [] });
            }
            if (mFl[1] === 'x')
            {
                m.filterAsk = null;
                return interaction.update ({ content: '✖ Фильтр отменён -- очередь на месте.', components: [] });
            }
            const fresh = !!ask && (Date.now () - (Number (ask.at) || 0) < FILTER_ASK_MS) &&
                String (ask.actorId) === String (ctx.actorId) &&
                (!mFl[2] || String (ask.token) === String (mFl[2]));
            if (!fresh)
                return interaction.update
                ({
                    content: '⌛ Это подтверждение уже не действует (очередь с тех пор менялась, прошло больше 5 минут ' +
                        'или фильтр открыл другой человек).\nВызови `/filter` заново или нажми «🧽 Фильтр…» под `/queue`.',
                    components: [],
                });
            m.filterAsk = null;
            const res = queueFilter (guildId, { mode: ask.mode, text: ask.text, scope: ask.scope,
                actorId: ctx.actorId, who: who });
            await refreshQueueMsg (ask.msgId);
            return interaction.update ({ content: (res.ok ? '' : '⚠️ ') + res.text, components: [] });
        }
        if (cid === 'q:da')
        {
            if (!staff)
                return interaction.reply ({ content: qPackStaffText (), flags: MessageFlags.Ephemeral });
            const raw = String ((interaction.values || [])[0] === undefined ? '' : (interaction.values || [])[0]);
            const target = (raw === '0') ? '' : raw;
            const hit = t => !!t && byIdOf (t) === target;
            const found = queueAuthorList (m, ctx.actorId, true).find (o => o.id === target);
            const name = found ? found.name : (target ? u (target) : 'без автора');
            const n = m.tracks.filter (hit).length;
            const playing = hit (m.current) ? (m.current.title || 'трек') : '';
            const waiting = (!playing && hit (m.seekTrack)) ? (m.seekTrack.title || 'трек') : '';
            const all = n + (playing ? 1 : 0) + (waiting ? 1 : 0);
            if (!all)
                return interaction.reply
                ({
                    content: '🈳 У ' + (target ? '**' + name + '**' : 'треков без автора') + ' ничего в очереди нет.',
                    flags: MessageFlags.Ephemeral,
                });
            return interaction.reply
            ({
                content: '👤 **' + name + '** -- ' + all + ' ' + plural (all, 'трек', 'трека', 'треков') + ':\n' +
                    (n ? '• в очереди: ' + n + '\n' : '') +
                    (playing ? '• играющий: **' + playing + '**\n' : '') +
                    (waiting ? '• ждущий: **' + waiting + '**\n' : '') +
                    '_🔄 Подвинуть -- вся пачка ЦЕЛИКОМ встанет ВМЕСТО выбранной (место выберешь списком, ' +
                    'а если выбрать место того, кто играет, -- начнётся сразу). 🗑 Удалить -- уйдут совсем ' +
                    '(играющий прервётся)._',
                components:
                [
                    new ActionRowBuilder ().addComponents
                    (
                        new ButtonBuilder ()
                            .setCustomId ('q:dap:' + (target || '0') + ':' + msgId)
                            .setLabel ('🔄 Подвинуть (' + n + ')').setStyle (ButtonStyle.Primary).setDisabled (!n),
                        new ButtonBuilder ()
                            .setCustomId ('q:dax:' + (target || '0') + ':' + msgId)
                            .setLabel ('🗑 Удалить (' + all + ')').setStyle (ButtonStyle.Danger),
                        new ButtonBuilder ()
                            .setCustomId ('q:dx').setLabel ('✖ Отмена').setStyle (ButtonStyle.Secondary)
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }
        const mDau = /^q:(?:dau|dap):([^:]*):(\d*)$/.exec (cid);
        if (mDau)
        {
            if (!staff)
                return interaction.reply ({ content: qPackStaffText (), flags: MessageFlags.Ephemeral });
            const target = (mDau[1] === '0') ? '' : mDau[1];
            const v = packPickView (m, target, mDau[2] || '0', 0);
            return interaction.update ({ content: v.text, components: v.rows });
        }
        const mDapp = /^q:dapp:([^:]*):(\d*):(-?\d+)$/.exec (cid);
        if (mDapp)
        {
            if (!staff)
                return interaction.reply ({ content: qPackStaffText (), flags: MessageFlags.Ephemeral });
            const target = (mDapp[1] === '0') ? '' : mDapp[1];
            const v = packPickView (m, target, mDapp[2] || '0', parseInt (mDapp[3], 10) || 0);
            return interaction.update ({ content: v.text, components: v.rows });
        }
        if (cid === 'q:dacl') return interaction.update ({ content: '✖ Закрыто -- очередь на месте.', components: [] });
        const mDaps = /^q:daps:([^:]*):(\d*)$/.exec (cid);
        if (mDaps)
        {
            if (!staff)
                return interaction.reply ({ content: qPackStaffText (), flags: MessageFlags.Ephemeral });
            const target = (mDaps[1] === '0') ? '' : mDaps[1];
            const dest = String ((interaction.values || [])[0] === undefined ? '' : (interaction.values || [])[0]);
            const res = queueMovePack (guildId, target, (dest === '0') ? '' : dest, who,
                { staff: true, actorId: interaction.user.id });
            await refreshQueueMsg (mDaps[2]);
            return interaction.update ({ content: (res.ok ? '' : '⚠️ ') + res.text, components: [] });
        }
        const mDax = /^q:dax:([^:]*):(\d*)$/.exec (cid);
        if (mDax)
        {
            const target = (mDax[1] === '0') ? '' : mDax[1];
            if (!staff)
                return interaction.reply ({ content: qPackStaffText (), flags: MessageFlags.Ephemeral });
            const res = queueClearAuthor (guildId, target, who);
            await refreshQueueMsg (mDax[2]);
            return interaction.update ({ content: res.ok ? res.text : '⚠️ ' + res.text, components: [] });
        }
        if (cid === 'q:dx') return interaction.update ({ content: '✖ Отменено -- очередь на месте.', components: [] });
        if (cid === 'q:clear') return askClear (false);
        if (cid === 'q:stop') return askClear (true);
        let res;
        if (cid === 'q:skip') res = queueSkip (guildId, who, ctx);
        else res = queueRemove (guildId, parseInt ((interaction.values || [])[0], 10), who, ctx);
        await replyView (queueKeptPage (msgId, page));
        return interaction.followUp ({ content: res.text, flags: MessageFlags.Ephemeral });
    }
    if (typeof interaction.isMessageContextMenuCommand === 'function' && interaction.isMessageContextMenuCommand ())
    {
        if (!isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов и модеров.', flags: MessageFlags.Ephemeral });
        const server = interaction.guildId;
        const s = SERVERS[server];
        const to = s && s.pipe_channel_target;
        const msg = interaction.targetMessage;
        if (!to)
            return interaction.reply ({ content: '⚠️ У этого сервера в config.json не задан `pipe_channel_target` -- пересылать некуда.', flags: MessageFlags.Ephemeral });
        if (!msg)
            return interaction.reply ({ content: '⚠️ Не вижу сообщение -- попробуй ещё раз.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        const relay = await relayPipe (to, msg);
        if (relay.empty)
            return interaction.editReply ('🤔 В сообщении нет ни текста, ни вложений -- пересылать нечего.\n' +
                '_(если это была картинка -- значит Discord не отдал её вместе с сообщением)_');
        if (!relay.ok)
            return interaction.editReply (relay.notFound
                ? '⚠️ Канал <#' + to + '> недоступен -- не могу туда написать.'
                : '⚠️ Не смог переслать: `' + oneLine (relay.error, 150) + '`');
        const fromSource = s.pipe_channel_source && msg.channel && msg.channel.id === s.pipe_channel_source;
        if (fromSource)
            await msg.delete ().catch (e => console.error ('[' + (d()) + '] [pipe] не смог удалить оригинал: ' + e.message));
        console.log ('[' + (d()) + '] [pipe] (кто: ' + who + ') переслал сообщение ' +
            (msg.author ? msg.author.username : '?') + ' -> ' + (relay.channel.name ? '#' + relay.channel.name : to) +
            (relay.files ? ' + вложение' : '') + (relay.text ? ': ' + oneLine (relay.text, 120) : '') +
            (fromSource ? ' (оригинал удалён)' : ' (оригинал оставлен)'));
        return interaction.editReply ('📣 Переслал в <#' + to + '>.' + (fromSource
            ? ' Оригинал в этом канале удалён.'
            : ' Оригинал оставил на месте -- удали его сам, если не нужен.'));
    }
    if (!interaction.isChatInputCommand ()) return;
    const name = interaction.commandName;
    console.log
    (
        '[' + (d()) + '] [cmd] /' + name +
        ((interaction.options.data || []).length
            ? ' ' + interaction.options.data.map (o => o.name + '=' + String (o.value === undefined ? '' : o.value).slice (0, 120)).join (' ')
            : '') +
        ' -- ' + (interaction.member ? uuu (interaction.member) : (interaction.user ? interaction.user.username : '?')) +
        (interaction.channel && interaction.channel.name ? ' @ #' + interaction.channel.name : '')
    );
    if (name === 'help')
    {
        const groups = helpMessages (interaction.guildId);
        await interaction.reply ({ embeds: groups[0], flags: MessageFlags.Ephemeral });
        for (const embeds of groups.slice (1))
            await interaction.followUp ({ embeds, flags: MessageFlags.Ephemeral });
        return;
    }
    if (name === 'bans')
    {
        if (!isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов и модеров.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const o = await bansOverview (interaction.guildId);
        console.log ('[' + (d()) + '] [ban] /bans: активных ' + o.rows.length +
            ', банов ' + o.rows.filter (r => r.isBan).length);
        let report = bansReportText (o, 20);
        for (const max of [12, 8, 5, 3, 2, 1])
        {
            if (report.length <= MSG_TEXT_LIMIT) break;
            report = bansReportText (o, max);
        }
        return interaction.editReply ({ content: fitMsgText (report) });
    }
    if (name === 'unban')
    {
        if (!isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов и модеров.', flags: MessageFlags.Ephemeral });
        const server = interaction.guildId;
        const guild = client.guilds.cache.get (server);
        const target = interaction.options.getUser ('user', true);
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        const why = (interaction.options.getString ('reason') || '').trim ();
        const reason = ('Снято вручную (' + who + ')' + (why ? ': ' + why : '')).slice (0, 512);
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const until = await db (server, 'membersBanTimeout', target.id).catch (() => null);
        const hasRecord = (until !== null && until !== undefined);
        let hadBan = false, banErr = '';
        try { await guild.bans.fetch (target.id); hadBan = true; }
        catch (e) { if (!/Unknown Ban|10026/i.test (e.message)) banErr = oneLine (e.message); }
        if (!hadBan && !hasRecord && !banTimerFor (server, target.id))
            return interaction.editReply
            (
                'ℹ️ У **' + target.username + '** нет ни таймаута, ни бана -- снимать нечего.' +
                (banErr ? '\n_Бан не проверился: `' + banErr + '`._' : '')
            );
        if (hadBan)
        {
            try { await guild.members.unban (target.id, reason); }
            catch (e) { return interaction.editReply ('⚠️ Не смог снять бан с **' + target.username + '**: `' + oneLine (e.message) + '`'); }
        }
        banTimerClear (server, target.id);
        if (hasRecord)
            await db (server, 'membersBanTimeout', target.id, null).catch (() => {});
        banHistoryAdd (server, target.id, 'unban');
        const what = hadBan ? ('бан' + (hasRecord ? ' и таймаут' : ''))
                            : (hasRecord ? 'таймаут' : 'таймер разбана');
        const till = until ? ', срок был до `' + d (until, true) + '`' : '';
        console.log ('[' + (d()) + '] [ban] ' + who + ' снял наказание с ' + target.username +
            ' (' + what + till + (why ? ', причина: ' + oneLine (why, 120) : '') + ')');
        logTo (SERVERS[server].log_channel).send
        (
            {
                embeds:
                [
                    {
                        author:
                        {
                            name: uu (target),
                            icon_url: target.displayAvatarURL ({extension: 'png', forceStatic: false, size: 1024}),
                        },
                        color: 0x00FF00,
                        description: '**' + uu (target) + '** снято наказание: ' + what + till + ' 🕊️\n' +
                            'Снял: **' + who + '**' + (why ? '\nПричина: `' + clipText (oneLine (why, 300), 300) + '`' : ''),
                        footer:
                        {
                            text: SERVERS[server].name,
                        },
                        timestamp: dt(),
                    },
                ]
            }
        );
        return interaction.editReply
        (
            '✅ С **' + target.username + '** снято: ' + what + till + '.' +
            '\nВ журнале отмечено (кто и когда).'
        );
    }
    if (name === 'announce')
    {
        if (!isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов и модеров.', flags: MessageFlags.Ephemeral });
        const text = (interaction.options.getString ('text') || '').trim ();
        const file = interaction.options.getAttachment ('file');
        const target = interaction.options.getChannel ('channel') || interaction.channel;
        if (!text && !file)
            return interaction.reply ({ content: '🤔 Пустое объявление: нужен текст или вложение.', flags: MessageFlags.Ephemeral });
        if (text.length > MSG_TEXT_LIMIT)
            return interaction.reply ({ content: '❌ Текст объявления -- ' + text.length + ' символов, а Discord принимает до ' +
                MSG_TEXT_LIMIT + '. Сократи или разбей на части.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        try
        {
            const ch = client.channels.cache.get (target.id) || await client.channels.fetch (target.id);
            if (!ch || typeof ch.send !== 'function')
                return interaction.editReply ('⚠️ Канал <#' + target.id + '> недоступен -- не могу туда написать.');
            await ch.send
            ({
                content: text || undefined,
                files: file ? [{ attachment: file.url, name: file.name || 'файл' }] : [],
            });
            console.log ('[' + (d()) + '] [pipe] (кто: ' + who + ') объявление -> ' + (ch.name ? '#' + ch.name : target.id) +
                (file ? ' + вложение' : '') + (text ? ': ' + oneLine (text, 120) : ''));
            return interaction.editReply ('📣 Опубликовано ' + (target.id === interaction.channelId
                ? 'в этом канале'
                : 'в <#' + target.id + '>') + '.');
        }
        catch (e)
        {
            console.error ('[pipe] объявление не ушло: ' + oneLine (e.message));
            return interaction.editReply ('⚠️ Не смог опубликовать: `' + oneLine (e.message, 150) + '`');
        }
    }
    if (name === 'dm')
    {
        if (!isAdminInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов.', flags: MessageFlags.Ephemeral });
        const target = interaction.options.getUser ('user', true);
        const text = (interaction.options.getString ('text') || '').trim ();
        const file = interaction.options.getAttachment ('file');
        if (!text && !file)
            return interaction.reply ({ content: '🤔 Что отправить? Нужен текст или вложение.', flags: MessageFlags.Ephemeral });
        if (text.length > MSG_TEXT_LIMIT)
            return interaction.reply ({ content: '❌ Текст ЛС -- ' + text.length + ' символов, а Discord принимает до ' +
                MSG_TEXT_LIMIT + '. Сократи или разбей на части.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        try
        {
            const user = await client.users.fetch (target.id);
            if (!user || typeof user.send !== 'function')
                return interaction.editReply ('⚠️ Пользователь ' + u (target.id) + ' недоступен.');
            await user.send
            ({
                content: text || undefined,
                files: file ? [{ attachment: file.url, name: file.name || 'файл' }] : [],
            });
            console.log ('[' + (d()) + '] [dm] (кто: ' + who + ') ЛС -> ' + uu (target) +
                (file ? ' + вложение' : '') + (text ? ': ' + oneLine (text, 120) : ''));
            return interaction.editReply ('✉️ Отправил ЛС: ' + u (target.id));
        }
        catch (e)
        {
            console.error ('[dm] ЛС -> ' + uu (target) + ' не ушло: ' + oneLine (e.message));
            return interaction.editReply ('⚠️ ЛС не ушло: `' + oneLine (e.message, 150) + '`.\n' +
                '_(частая причина -- у него закрыта личка)_');
        }
    }
    if (name === 'rolecheck')
    {
        if (!isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов и модеров.', flags: MessageFlags.Ephemeral });
        const target = interaction.options.getUser ('user', true);
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const text = await rolecheckReport (interaction.guildId, target);
        console.log ('[' + (d()) + '] [roles] /rolecheck: ' + target.username + ' -- отчёт выдан');
        return interaction.editReply ({ content: clipText (text, 1900) });
    }
    if (name === 'welcome')
    {
        const target = interaction.options.getUser ('user') || interaction.user;
        if (target.id !== interaction.user.id && !isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Другому -- только админ или модер.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const user = await client.users.fetch (target.id).catch (() => null);
        if (!user || typeof user.send !== 'function')
            return interaction.editReply ('⚠️ Пользователь ' + u (target.id) + ' недоступен.');
        const res = await welcomeCheckSend (interaction.guildId, user,
            interaction.member ? uuu (interaction.member) : interaction.user.username);
        return interaction.editReply (res.ok
            ? ('✅ Приветствие отправлено в ЛС: ' + u (target.id))
            : ('⚠️ ' + res.why));
    }
    if (name === 'forget')
    {
        if (!isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 Команда только для админов и модеров.', flags: MessageFlags.Ephemeral });
        const target = interaction.options.getUser ('user', true);
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const server = interaction.guildId;
        const had = [];
        try
        {
            const roles = await db (server, 'memberRoles', target.id);
            if (roles)
            {
                await db (server, 'memberRoles', target.id, null);
                had.push ('роли (' + ((roles.roles || []).length) + ')');
            }
            const hist = await db (server, 'banHistory', target.id);
            if (hist)
            {
                await db (server, 'banHistory', target.id, null);
                had.push ('история наказаний (' + ((hist.events || []).length) + ' ' +
                    plural ((hist.events || []).length, 'событие', 'события', 'событий') + ')');
            }
            {
                const m = musicOf (server);
                const same = t => t && String (t.byId || '') === String (target.id);
                const goneQ = (m.tracks || []).filter (same).length;
                const playing = same (m.current) ? (m.current.title || 'трек') : '';
                const waiting = !playing && same (m.seekTrack) ? (m.seekTrack.title || 'трек') : '';
                if (goneQ || playing || waiting)
                {
                    m.tracks = m.tracks.filter (t => !same (t));
                    if (waiting) { m.seekTrack = null; m.seekSec = 0; }
                    if (playing)
                    {
                        m.current = null;
                        m.playedMs = 0;
                        m.playingSince = null;
                        m.player.stop (true);
                    }
                    dropPreload (m);
                    startPreload (server);
                    saveMusicState (server);
                    scheduleVoiceStatus (server, true);
                    schedulePresence (true);
                    had.push ('очередь музыки (' + goneQ + ' ' + plural (goneQ, 'трек', 'трека', 'треков') +
                        (playing ? ' + его играющий трек' : (waiting ? ' + его ждущий трек' : '')) + ')');
                }
            }
        }
        catch (e)
        {
            console.error ('[forget] не смог удалить данные ' + target.id + ': ' + oneLine (e.message));
            return interaction.editReply ('⚠️ Не смог удалить: `' + oneLine (e.message, 150) + '`');
        }
        const until = await db (server, 'membersBanTimeout', target.id).catch (() => null);
        const active = (until && until > Date.now ())
            ? ' Активное наказание НЕ тронуто -- снять его можно `/unban`.' : '';
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        console.log ('[' + (d()) + '] [forget] (кто: ' + who + ') удалил данные ' + target.username +
            ' \`' + target.id + '\`: ' + (had.length ? had.join (', ') : 'нечего было удалять'));
        return interaction.editReply ('🧽 Данные ' + u (target.id) + ' удалены: ' +
            (had.length ? had.join (', ') : 'нечего было удалять') + '.' + active);
    }
    if (name === 'mydata')
    {
        const opt0 = interaction.options.getUser ('user');
        const target = opt0 || interaction.user;
        const self = String (target.id) === String (interaction.user.id);
        if (!self && !isStaffInteraction (interaction))
            return interaction.reply ({ content: '🚫 О другом человеке -- только админ или модер.\n' +
                'О себе -- всегда: просто `/mydata`.', flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const user = self ? interaction.user : (await client.users.fetch (target.id).catch (() => target));
        let text = '';
        try { text = await myDataReport (interaction.guildId, user, self); }
        catch (e) { return interaction.editReply ('⚠️ Не смог собрать отчёт: `' + oneLine (e.message, 150) + '`'); }
        console.log ('[' + (d()) + '] [data] (кто: ' +
            (interaction.member ? uuu (interaction.member) : interaction.user.username) +
            ') посмотрел, что бот помнит о ' + user.username + (self ? ' (о себе)' : '') + ' -- отчёт выдан');
        return interaction.editReply ({ content: clipText (text, 1900) });
    }
    if (name === 'rekey')
    {
        if (!isBotOwner (interaction.user.id))
            return interaction.reply ({ content: '🚫 Команда только для владельца бота (id в ключе `OWNER` конфига)' +
                (OWNER_HOSTER ? '' : '; сейчас `OWNER` не заполнен -- команда недоступна никому') + '.',
                flags: MessageFlags.Ephemeral });
        await interaction.deferReply ({ flags: MessageFlags.Ephemeral });
        const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
        const oldKeys = DB_KEYS.slice ();
        console.log ('[' + (d()) + '] [db] (кто: ' + who + ') /rekey: перешифровываю базу новым ключом');
        const newKey = crypto.randomBytes (32);
        const res = await dbRekey (newKey);
        const sum = 'перешифровано ' + (res.enc + res.plain) + ' ' +
            plural (res.enc + res.plain, 'запись', 'записи', 'записей') +
            ' (открытыми до этого были: ' + res.plain + ')' +
            (res.bad ? ', пропущено нечитаемых: ' + res.bad : '') + ', неймспейсов: ' + res.ns;
        if (res.abort)
        {
            DB_KEYS.length = 0;
            for (const k of oldKeys) DB_KEYS.push (k);
            if (!DB_KEYS.some (k => k.equals (newKey))) DB_KEYS.push (newKey);
            const saved = dbKeysSaveToConfig (oldKeys[0] || null, [newKey]);
            console.log ('[' + (d()) + '] [db] /rekey ПРЕРВАН (' + res.why + '): ' + sum +
                '; основной ключ -- прежний, новый записан запасным (' +
                (saved ? 'config.json обновлён' : 'config.json НЕ обновлён -- впиши вручную') + ')');
            return interaction.editReply ('⚠️ Перешифровка прервана: `' + oneLine (res.why, 120) + '`.\n' + sum +
                '\nНовый ключ **не** стал основным: в `config.json` остался прежний `db_key`, а новый лежит в `db_key_prev` -- данные читаются' +
                (saved ? ' и переживут перезапуск' : '; в конфиг записать не удалось, возьми ключ из консоли бота') +
                '.\nПовтори `/rekey`, когда будет время.');
        }
        DB_KEYS.length = 0;
        DB_KEYS.push (newKey);
        if (oldKeys[0]) DB_KEYS.push (oldKeys[0]);
        const saved2 = dbKeysSaveToConfig (newKey, []);
        console.log ('\n' + '='.repeat (62));
        console.log (' [db] НОВЫЙ КЛЮЧ ШИФРОВАНИЯ БАЗЫ (ключ db_key): ' + newKey.toString ('hex'));
        console.log (' [db] ' + (saved2 ? 'уже вписан в config.json' : 'ВПИСАТЬ В config.json НЕ УДАЛОСЬ -- сделай вручную'));
        console.log (' [db] сохрани его отдельно: без этого ключа записи базы не читаются.');
        console.log ('='.repeat (62) + '\n');
        console.log ('[' + (d()) + '] [db] (кто: ' + who + ') /rekey готов: ' + sum);
        return interaction.editReply ('🔐 База перешифрована новым ключом.\n' + sum +
            '\nНовый ключ ' + (saved2 ? 'уже вписан в `config.json` (`db_key`), старый убран'
                : '**вписать в `config.json` не удалось** -- возьми его из консоли бота') +
            '; ключ также напечатан **в консоли бота** (в Discord не отправляю: оттуда он ушёл бы на серверы Discord).' +
            '\nСохрани его отдельно от config.json -- без него записи базы не читаются. Перезапуск не нужен.');
    }
    if (!['play','join','stop','skip','pause','resume','seek','queue','nowplaying','history','health','leave','remove','clear','jump','move','push','repeat','repeat-list','filter'].includes (name)) return;
    const guildId = interaction.guildId;
    const m = musicOf (guildId);
    const qRedraw = (ms = 300) => queueMsgRedraw (guildId, ms).catch (() => {});

    try
    {
        if (!['queue', 'nowplaying', 'history', 'health', 'repeat', 'repeat-list', 'filter'].includes (name) && !isDJ (interaction))
        {
            let role_dj = SERVERS[guildId].role_dj || '';
            return interaction.reply ({ content: '🚫 Музыка только для ' + (role_dj ? '<@&' + role_dj + '>' : 'DJ'), flags: MessageFlags.Ephemeral });
        }

        if (name === 'join')
            return joinMusicChannel (interaction);

        if (name === 'play')
        {
            const callerVoice = interaction.member && interaction.member.voice ? interaction.member.voice.channel : null;
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
            const addedAt = Date.now ();
            for (const t of tracks)
            {
                t.byId = interaction.user.id;
                t.byName = interaction.user.username;
                t.addAt = addedAt;
                t.addIn = interaction.channelId;
            }

            const mine = m.connection ? m.connection.joinConfig.channelId : null;
            const mineCh = mine ? client.channels.cache.get (mine) : null;
            const mineName = mineCh ? '«' + mineCh.name + '»' : 'другом канале';
            const minePeople = mine ? humansInChannel (guildId, mine) : 0;
            let note = '';
            let askMoveRow = null;
            if (m.connection && callerVoice && callerVoice.id !== mine && minePeople > 0)
            {
                note = '\n🎧 Играю в ' + mineName + ' (' + minePeople + ' -- слушают) -- там и продолжу.' +
                    '\n❔ Перейти к тебе в «' + callerVoice.name + '»?';
                askMoveRow = new ActionRowBuilder ().addComponents
                (
                    new ButtonBuilder ()
                        .setCustomId ('q:mvh:' + guildId + ':' + callerVoice.id).setLabel ('🚚 Перейти')
                        .setStyle (ButtonStyle.Success),
                    new ButtonBuilder ()
                        .setCustomId ('q:mvn').setLabel (('✖ Остаться в ' + mineName).slice (0, 78))
                        .setStyle (ButtonStyle.Secondary)
                );
            }
            else if (callerVoice && (!m.connection || callerVoice.id !== mine))
            {
                const wasElsewhere = !!mine && mine !== callerVoice.id;
                connectTo (interaction);
                if (wasElsewhere) note = '\n🚚 Переехал в «' + callerVoice.name + '».';
            }

            m.textChannelId = interaction.channelId;
            const shouldStart = !!m.connection && !m.current;
            qGluePlaying (m);
            const _insAt = authorBlockInsertAt (m.tracks, interaction.user.id);
            const _blockBefore = _insAt < m.tracks.length;
            m.tracks.splice (_insAt, 0, ...tracks);
            scheduleVoiceStatus (guildId);
            schedulePresence ();
            scheduleDeadScan (guildId);
            if (!shouldStart) startPreload (guildId);
            saveMusicState (guildId);
            historyAdd (guildId,
            {
                at: addedAt,
                byId: interaction.user.id,
                byName: interaction.user.username,
                inCh: interaction.channelId,
                n: tracks.length,
                live: tracks.filter (t => t.isLive).length,
                titles: tracks.map (t => t.title || t.url || ''),
                q: query,
                urls: tracks.map (t => t.url || ''),
                ids: tracks.map (t => ytKey (t.url)),
            }).catch (e => console.error ('[music] история добавлений: ' + oneLine ((e && e.message) || e)));
            await interaction.editReply
            (
                '🎶 Добавлено: **' + (tracks[0].title || query) + '**' +
                (tracks.length > 1 ? ' + ещё ' + (tracks.length - 1) + ' треков' : '') +
                '\nИсточник: `' + tracks[0].author + '` | Длина: `' + fmtDur (tracks[0].duration, tracks[0].isLive) + '`' +
                note +
                (m.connection ? (shouldStart ? '\n▶️ Запускаю...' : '') :
                    '\n⏳ Я не в канале -- заиграю, когда позовёшь `/join`.') +
                (_blockBefore ? '\n📚 Пачка встала в конец твоего блока в очереди (№' + _insAt + ').' : ''),
                { components: askMoveRow ? [askMoveRow] : [] }
            );
            qRedraw ();
            if (shouldStart)
                playNext (guildId);
        }
        else if (name === 'stop')
        {
            const c = queueClearConfirm (m, interaction.user.id, isStaffInteraction (interaction),
                { leave: true, msgId: '0' });
            return interaction.reply ({ content: c.text, components: c.rows, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'remove')
        {
            const res = queueRemove (guildId, interaction.options.getInteger ('number'),
                interaction.member ? uuu (interaction.member) : interaction.user.username,
                { staff: isStaffInteraction (interaction), actorId: interaction.user.id });
            if (res.ok) qRedraw ();
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'move')
        {
            const res = queueMove (guildId,
                interaction.options.getInteger ('number'),
                interaction.options.getInteger ('to'),
                interaction.member ? uuu (interaction.member) : interaction.user.username,
                { staff: isStaffInteraction (interaction), actorId: interaction.user.id });
            if (res.ok) qRedraw ();
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'push')
        {
            if (!isStaffInteraction (interaction))
                return interaction.reply ({ content: qPackStaffText (), flags: MessageFlags.Ephemeral });
            const pick = interaction.options.getUser ('author');
            const targetId = pick ? pick.id : interaction.user.id;
            const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
            const packNo = interaction.options.getInteger ('number');
            if (packNo)
            {
                const res = queueMovePack (guildId, targetId, packNo, who, { staff: true, actorId: interaction.user.id });
                if (res.ok) qRedraw ();
                return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
            }
            const res = queuePush (guildId, targetId, who);
            if (res.ok) qRedraw ();
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'clear')
        {
            const who = interaction.options.getUser ('author');
            const staffClear = isStaffInteraction (interaction);
            if (who)
            {
                if (!staffClear && String (who.id) !== String (interaction.user.id))
                    return interaction.reply
                    ({
                        content: '🚫 Убрать треки другого человека могут только админы и модеры.\n' +
                            '_Свои -- можно: `/clear author:@себя` или меню «🗑 Удалить треки автора» под `/queue`._',
                        flags: MessageFlags.Ephemeral,
                    });
                const res = queueClearAuthor (guildId, who.id,
                    interaction.member ? uuu (interaction.member) : interaction.user.username);
                if (res.ok) qRedraw ();
                return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
            }
            if (!m.tracks.length && !m.current && !m.seekTrack)
                return interaction.reply ({ content: '🈳 Очередь и так пуста -- чистить нечего.', flags: MessageFlags.Ephemeral });
            const c = queueClearConfirm (m, interaction.user.id, staffClear, { leave: false, msgId: '0' });
            return interaction.reply ({ content: c.text, components: c.rows, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'filter')
        {
            if (!isStaffInteraction (interaction))
                return interaction.reply
                ({
                    content: '🚫 Фильтр очереди -- только админы и модеры.\n' +
                        '_Обычный DJ распоряжается своими записями: `/remove`, `/clear author:@себя` ' +
                        'или «🗂 Трек: подвинуть или убрать…» под `/queue`._',
                    flags: MessageFlags.Ephemeral,
                });
            const textF = filterTextOf (interaction.options.getString ('text'));
            if (!textF)
                return interaction.reply ({ content: '🤔 Пустая подстрока -- искать нечего.', flags: MessageFlags.Ephemeral });
            if (!m.tracks.length && !m.current && !m.seekTrack)
                return interaction.reply ({ content: '🈳 Очередь и так пуста -- фильтровать нечего.', flags: MessageFlags.Ephemeral });
            const cF = queueFilterConfirm (m, interaction.options.getString ('mode'), textF,
                interaction.options.getString ('scope') || 'all', interaction.user.id, '0');
            return interaction.reply ({ content: cF.text, components: cF.rows, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'jump')
        {
            const n = interaction.options.getInteger ('number');
            if (!m.tracks.length || n < 1 || n > m.tracks.length)
                return interaction.reply
                (
                    {
                        content: m.tracks.length
                            ? '🤔 В очереди ' + m.tracks.length + ' треков -- номер от 1 до ' + m.tracks.length + '.'
                            : '🈳 В очереди нет треков (играет только текущий).',
                        flags: MessageFlags.Ephemeral,
                    }
                );
            const ctxJ = { actorId: interaction.user.id, staff: isStaffInteraction (interaction),
                actorName: interaction.member ? uuu (interaction.member) : interaction.user.username,
                who: interaction.member ? uuu (interaction.member) : interaction.user.username };
            const mode = interaction.options.getString ('mode');
            if (!mode)
            {
                const c = jumpConfirm (n);
                return interaction.reply ({ content: c.text, components: c.rows, flags: MessageFlags.Ephemeral });
            }
            const res = jumpMusic (guildId, n, mode === 'cut', ctxJ);
            if (res.ok) qRedraw (1500);
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'skip')
        {
            const res = queueSkip (guildId,
                interaction.member ? uuu (interaction.member) : interaction.user.username,
                { actorId: interaction.user.id, staff: isStaffInteraction (interaction) });
            if (res.ok) qRedraw ();
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'seek')
        {
            const raw = interaction.options.getString ('time');
            const sec = parseSeekTime (raw);
            if (sec === null)
                return interaction.reply
                ({
                    content: '🤔 Не понял время: `' + String (raw).slice (0, 20) + '`.\n' +
                        '_Примеры: `90`, `1:30`, `1:02:03`, `0:05` (всего -- до 6 часов). Начать с начала -- `0`._',
                    flags: MessageFlags.Ephemeral,
                });
            const res = seekMusic (guildId, sec,
                interaction.member ? uuu (interaction.member) : interaction.user.username,
                { actorId: interaction.user.id, staff: isStaffInteraction (interaction) });
            if (res.ok) qRedraw (1500);
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
        else if (name === 'pause')
        {
            m.player.pause ();
            m.playedMs = playedMsOf (m);
            m.playingSince = null;
            saveMusicState (guildId);
            scheduleVoiceStatus (guildId, true);
            schedulePresence (true);
            checkListeners (guildId);
            qRedraw ();
            return interaction.reply ('⏸ Пауза.');
        }
        else if (name === 'resume')
        {
            m.player.unpause ();
            m.playingSince = Date.now ();
            saveMusicState (guildId);
            scheduleVoiceStatus (guildId, true);
            schedulePresence (true);
            qRedraw ();
            return interaction.reply ('▶️ Продолжаем.');
        }
        else if (name === 'nowplaying')
        {
            return interaction.reply (nowPlayingText (m, guildId, interaction.user.id));
        }
        else if (name === 'health')
        {
            await interaction.deferReply ();            // проверка путей занимает пару секунд
            const hr = await netHealthText (m, guildId, interaction.user.id);
            const rows = [];
            let hText = hr.text;
            if (hr.owner)
            {
                const rowV = new ActionRowBuilder ();
                rowV.addComponents (new ButtonBuilder ().setCustomId ('h:voice:real')
                    .setLabel ('🔊 Проверить голос по-настоящему').setStyle (ButtonStyle.Primary));
                rows.push (rowV);
                hText += '\n_«Проверить голос» -- по-настоящему: если я уже в канале и к медиа-адресу ходят пакеты, отвечу сразу и ничего не прерву; иначе выйду из канала на несколько секунд, проверю медиа-адрес и верну музыку на то же место._';
            }
            if (hr.fix)
            {
                const row = new ActionRowBuilder ();
                if (hr.canStart)
                    row.addComponents (new ButtonBuilder ().setCustomId ('h:dpi:start').setLabel ('▶ Поднять обход').setStyle (ButtonStyle.Success));
                row.addComponents (new ButtonBuilder ().setCustomId ('h:dpi:pick').setLabel ('🛠 Подобрать обход').setStyle (ButtonStyle.Danger));
                rows.push (row);
                hText += '\n_Кнопки про обход делают то, где нужны права: Windows спросит разрешение' +
                    (hr.canStart ? '; «поднять» вернёт сохранённую стратегию за пару секунд, «подобрать» -- переберёт все (на это время обход останавливается)' : ', на время подбора обход останавливается') + '._';
            }
            return interaction.editReply (rows.length ? { content: hText, components: rows } : { content: hText });
        }
        else if (name === 'history')
        {
            await historyLoad (guildId);
            const hRows = historyComponents (guildId, 1);
            const hText = historyText (guildId, 1);
            return interaction.reply (hRows.length
                ? { content: hText, components: hRows }
                : hText);
        }
        else if (name === 'repeat')
        {
            if (!isStaffInteraction (interaction))
                return interaction.reply
                ({
                    content: '🚫 Режим повтора включают только админы и модеры.\n' +
                        '_Себе: `/repeat`; другому автору: `/repeat user:@кто`. Кто сейчас в режиме -- `/repeat-list`._',
                    flags: MessageFlags.Ephemeral,
                });
            const pick = interaction.options.getUser ('user');
            const targetId = pick ? pick.id : interaction.user.id;
            const targetName = pick ? pick.username
                : (interaction.member ? interaction.user.username : '?');
            const who = interaction.member ? uuu (interaction.member) : interaction.user.username;
            await repeatLoad (guildId);
            const wasOn = repeatOn (guildId, targetId);
            const res = await repeatSet (guildId, targetId, targetName, !wasOn);
            if (!res.ok)
                return interaction.reply ({ content: res.text, flags: MessageFlags.Ephemeral });
            const inQ = repeatTracksOf (guildId, targetId);
            const playingNow = !!(m.current && String (m.current.byId || '') === String (targetId));
            if (!res.on)
            {
                console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'выключил режим повтора для ' +
                    targetName + ' (в очереди было ' + inQ + ')');
                qRedraw ();
                return interaction.reply
                ({
                    content: '➡️ Повтор для **' + targetName + '** выключен -- его треки снова убираются ' +
                        'после проигрывания.' +
                        (inQ ? '\n_В очереди остаётся ' + inQ + '; убрать сразу: `/clear author:@кто`._' : ''),
                    flags: MessageFlags.Ephemeral,
                });
            }
            console.log ('[' + (d()) + '] [music] ' + whoText (who) + 'включил режим повтора для ' +
                targetName + ' (в очереди ' + inQ + ')');
            qRedraw ();
            return interaction.reply
            ({
                content: '🔁 Повтор включён для **' + targetName + '**: ' +
                    (inQ ? 'его ' + inQ + ' ' + plural (inQ, 'трек', 'трека', 'треков') + ' в очереди'
                         : 'треков в очереди сейчас нет') +
                    (playingNow ? ', и играющий сейчас тоже' : '') +
                    ' больше не убираются после проигрывания -- доиграв, трек встаёт в конец очереди и играет снова.\n' +
                    '_Выключить: `/repeat user:@кто`; список авторов в режиме -- `/repeat-list`._',
                flags: MessageFlags.Ephemeral,
            });
        }
        else if (name === 'repeat-list')
        {
            await repeatLoad (guildId);
            return interaction.reply (repeatListText (guildId));
        }
        else if (name === 'queue')
        {
            const total = m.tracks.length;
            if (!m.current && !total)
                return interaction.reply ('🈳 Очередь пуста.');
            const ctxQ =
            {
                actorId: interaction.user.id,
                actorName: interaction.member ? uuu (interaction.member) : interaction.user.username,
                staff: isStaffInteraction (interaction),
            };
            const fromQ = interaction.options.getInteger ('from') || 1;
            const view = queueView (m, fromQ, 0, ctxQ);
            const sent = await interaction.reply
            (
                Object.assign
                (
                    view.components.length
                        ? { content: view.content, components: view.components }
                        : { content: view.content },
                    { withResponse: true, allowedMentions: { parse: [] } }
                )
            );
            const sentMsg = (sent && sent.resource && sent.resource.message) || null;
            if (sentMsg) queueWatch (m, sentMsg, ctxQ, fromQ, view.content, 0);
        }
        else if (name === 'leave')
        {
            const res = leaveMusicVoice (guildId, interaction.user.id,
                interaction.member ? uuu (interaction.member) : interaction.user.username);
            if (res.ok) qRedraw ();
            return interaction.reply (res.ok ? res.text : { content: res.text, flags: MessageFlags.Ephemeral });
        }
    }
    catch (e)
    {
        console.error ('[music] ошибка обработки команды: ' + e.message);
        if (interaction.deferred || interaction.replied)
            interaction.editReply ('❌ Ошибка: ' + e.message.slice (0, 150)).catch (() => {});
        else
            interaction.reply ({ content: '❌ Ошибка: ' + e.message.slice (0, 150), flags: MessageFlags.Ephemeral }).catch (() => {});
    }
});

client.once ('clientReady', () => registerMusicCommands ());

for (const _cfgIssue of configSanityIssues ())
    console.log ('[' + (d()) + '] [config] ' + _cfgIssue);

for (const _cfgDrift of (BOT_RUN ? configDriftIssues () : []))
    console.log ('[' + (d()) + '] [config] ' + _cfgDrift);

for (const _cfgTmpl of (BOT_RUN ? configTemplateIssues ().hard : []))
    console.log ('[' + (d()) + '] [config] ШАБЛОНЫ: ' + _cfgTmpl);
