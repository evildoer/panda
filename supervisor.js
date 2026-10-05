// PANDAMIA Bot -- супервизор (v2.164)
//
// Зачем: музыка должна играть «в любом случае». Если бот упал или штатно вышел после
// необработанного исключения, кто-то должен поднять его заново -- бот теперь сохраняет
// очередь и позицию и выходит кодом 1, а супервизор запускает его снова.
//
// v2.164 -- по разбору вопроса владельца «почему жёсткое снятие няньки уносит и бота, хотя
// taskkill без /T детей не трогает». Убивает бота не taskkill: детей не трогает именно он,
// но процесс рождается уже привязанным к родителю. Node запускает процессы через libuv, а тот
// каждого не-detached ребёнка сажает в свой job-объект с флагом «закрылся родитель -- бей всех»
// (JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE), причём ручку держит только сам родитель. Значит, любая
// смерть няньки -- taskkill /F, закрытие окна, падение -- мгновенно и молча убивает и бота
// (без сигналов, без сохранения очереди и без строк в логе).
// Поэтому бота запускает посредник -- cmd: сам он ребёнок няньки (и умрёт вместе с ней), а бот --
// уже его ребёнок, а дети члена job-объекта в этот job не попадают (у няньки он помечен
// SILENT_BREAKAWAY_OK). В итоге бот остаётся в этом же окне (лог и Ctrl+C работают как раньше),
// но жёсткого снятия няньки не замечает: музыка играет дальше, а остановить её можно командой
// `node . stop`. Отдельным процессом (detached) бота не запускаю нарочно: такой процесс отцеплен
// от консоли, и его строки в окне уже не видны (живой лог остался бы только в файле).
//
// v2.165 -- закрытие окна больше не теряет очередь: бот сам ловит SIGHUP (так Windows отдаёт закрытие
// консоли) и сохраняет всё, как по Ctrl+C, а нянька на сигнал ещё и кладёт ему просьбу остановиться
// (logs/bot.stop, тот же файл, что у `node . stop`) -- на случай, если сигнал до бота не дошёл, а окно
// уже закрывают. Правило «сняли няньку жёстко -- бот играет дальше» не тронуто: при жёстком снятии
// обработчики не выполняются, значит и просьба не пишется.
//
// v2.166 -- присмотр возвращается сам. До этого присмотр можно было потерять насовсем: няньку сняли
// жёстко (taskkill /F), бот играет дальше, но поднять его после падения уже некому, и в логе это никак
// не видно. Теперь `node .` при живом боте не отказывается, а БЕРЁТ его под присмотр: следит за
// замком бота по секунде и, если бот исчез, решает по его записке о выходе (logs/bot.exit, её пишет сам
// бот в обработчике exit) -- вышел сам (код 0) не поднимаю, упал (код не 0) или записки нет (сняли
// жёстко) -- поднимаю по тем же паузам. Чтобы на одно падение не поднялись две няньки, у няньки свой
// замок (logs/supervisor.pid): живой чужой pid -- второй запуск просто выходит с подсказкой.

// Как пользоваться (с v2.160 присмотр -- поведение по умолчанию, отдельно звать не нужно):
//   node .                    -- обычный запуск: сам поднимает супервизор (то же, что этот файл);
//                                видит уже работающего бота -- берёт его под присмотр, второго не поднимает
//   node supervisor.js        -- то же самое, явно (Ctrl+C -- остановить обоих)
//   npm run supervise         -- то же самое
//   PANDAMIA_NO_SUPERVISOR=1  -- отключить присмотр: бот живёт один, как раньше
//
// Правила:
//   - бот вышел кодом 0 -- значит, его закрыли вручную (Ctrl+C или команда); не поднимаю;
//   - бот упал (код не 0 или сигнал) -- поднимаю заново: паузы 2, 5, 15, 30, 60 секунд;
//   - пять падений за минуту -- останавливаюсь и говорю, куда смотреть (иначе был бы вечный цикл);
//   - сам супервизор получает Ctrl+C (или SIGHUP -- это закрывают окно) -- просит бота сохранить
//     очередь и выйти (файл-просьба) и ждёт его; вышел -- ухожу за ним; не ответил за 15 с --
//     выхожу сам, а бот играет дальше; если сигнал пришёл в паузу между перезапусками
//     (бота сейчас нет), супервизор выходит сразу и нового не поднимает;
//   - супервизора снимают жёстко (taskkill /F) -- бот этого не замечает и играет дальше (v2.164),
//     а следующий `node .` снова берёт его под присмотр (v2.166);
//   - живой бот и живая нянька -- второй `node .` не поднимает ни бота, ни няньку: у бота уже есть
//     присмотр (замок logs/supervisor.pid), и говорит об этом одной строкой.
//
// Проверочные ручки (только для песочницы, в обычной работе не нужны):
//   PANDAMIA_BOT_MAIN          -- что запускать вместо '.' (подставной скрипт)
//   PANDAMIA_SUPERVISOR_LIMIT  -- сколько падений за минуту терпеть (по умолчанию 5)
//   PANDAMIA_SUPERVISOR_BACKOFF-- список пауз через запятую (по умолчанию 2000,5000,15000,30000,60000)
//   PANDAMIA_SUPERVISOR_LOG    -- файл, куда дублировать строки няньки (подставляет сам бот; пусто -- только консоль);
//                                задаёт и каталог для замков няньки, бота и записки о выходе (песочница)
'use strict';
const {spawn} = require ('child_process');
const fsMod = require ('fs');
const pathMod = require ('path');

const NODE = process.execPath;
const MAIN = process.env.PANDAMIA_BOT_MAIN || '.';
const RESTART_LIMIT = Math.max (1, Number (process.env.PANDAMIA_SUPERVISOR_LIMIT) || 5);
const WINDOW_MS = 60 * 1000;
const BACKOFF_MS = String (process.env.PANDAMIA_SUPERVISOR_BACKOFF || '2000,5000,15000,30000,60000')
    .split (',')
    .map (x => Math.max (0, Number (x) || 0));

// Куда дублировать строки няньки в живой лог-файл: путь подставляет сам бот (PANDAMIA_SUPERVISOR_LOG);
// если супервизор запустили напрямую, беру log_dir (и имя) из config.json -- тот же месячный файл, что пишет бот.
function supervisorLogFile ()
{
    const fromEnv = String (process.env.PANDAMIA_SUPERVISOR_LOG || '').trim ();
    if (fromEnv) return fromEnv;
    try
    {
        const cfg = JSON.parse (fsMod.readFileSync (pathMod.join (__dirname, 'config.json'), 'utf8'));
        const dir = String ((cfg && cfg.log_dir) || '').trim () || 'logs';
        const base = pathMod.isAbsolute (dir) ? pathMod.normalize (dir) : pathMod.join (__dirname, dir);
        const name = String ((cfg && cfg.PREFIX) || 'panda')
            .replace (/[^0-9A-Za-zА-Яа-яЁё_-]+/g, '-').replace (/^-+|-+$/g, '') || 'panda';
        const now = new Date (), two = n => String (n).padStart (2, '0');
        return pathMod.join (base, name + '-' + now.getFullYear () + '-' + two (now.getMonth () + 1) + '.log');
    }
    catch (e) { return ''; }
}
const LOG_FILE = supervisorLogFile ();
const LOG_DIR = LOG_FILE ? pathMod.dirname (LOG_FILE) : pathMod.join (__dirname, 'logs');
// v2.165 -- запасная дорожка к боту, когда закрывают окно: те же файл-просьба и пары, что у команды
// `node . stop` (logs/bot.stop, pid бота из замка logs/bot.pid). Бот проверяет файл раз в секунду и,
// увидев СВОЙ pid, гаснет как по Ctrl+C -- очередь и позиция целы, замок снят, следующий `node .`
// поднимает всё с того же места. Нужна на случай, когда сигнал до бота не дошёл, а окно уже закрывают:
// строку просьбы он успеет прочитать до того, как Windows досчитает свои пять секунд.
let askedPid = 0;                                 // кому положил просьбу -- чтобы убрать её за собой
function askBotToStop ()
{
    let pid = 0;
    try { pid = parseInt (String (fsMod.readFileSync (pathMod.join (LOG_DIR, 'bot.pid'), 'utf8')).replace (/\D+/g, ''), 10) || 0; }
    catch (e) { return false; }                       // бот ещё не написал замок (стартует) -- повторим позже
    if (!pid) return false;
    try
    {
        fsMod.mkdirSync (LOG_DIR, {recursive: true});
        fsMod.writeFileSync (pathMod.join (LOG_DIR, 'bot.stop'), String (pid));
        askedPid = pid;
        return true;
    }
    catch (e)
    {
        log ('не смог положить просьбу остановиться в ' + pathMod.join (LOG_DIR, 'bot.stop') + ': ' + ((e && e.message) || e));
        return false;
    }
}
// v2.166 -- нянька и её замок. Двум нянькам нельзя: на одно падение бота каждая подняла бы по боту,
// и они рвали бы друг другу голос. Замок -- logs/supervisor.pid: живой чужой pid -- второй не встаёт,
// мёртвый (остался от жёстко снятой няньки) -- перезаписываю своим.
function supLockFile ()
{
    return pathMod.join (LOG_DIR, 'supervisor.pid');
}
function readLockPid (file)
{
    try { return parseInt (String (fsMod.readFileSync (file, 'utf8')).replace (/\D+/g, ''), 10) || 0; }
    catch (e) { return 0; }
}
function processAlive (pid)
{
    if (!pid || pid === process.pid) return false;
    try { process.kill (pid, 0); return true; }
    catch (e) { return !!(e && e.code === 'EPERM'); }
}
function claimSupervisorLock ()
{
    const other = readLockPid (supLockFile ());
    if (other && processAlive (other))
        return 'у бота уже есть нянька (pid ' + other + ', замок ' + supLockFile () + ') -- второй не нужен';
    try
    {
        fsMod.mkdirSync (LOG_DIR, {recursive: true});
        fsMod.writeFileSync (supLockFile (), String (process.pid));
        process.on ('exit', () =>
        {
            try { if (readLockPid (supLockFile ()) === process.pid) fsMod.unlinkSync (supLockFile ()); } catch (e) {}
        });
    }
    catch (e) { log ('не смог записать замок няньки ' + supLockFile () + ': ' + ((e && e.message) || e)); }
    return '';
}
// Записка бота о выходе: «pid код когда» -- её пишет сам бот в обработчике exit (любой выход, и штатный,
// и аварийный; при жёстком снятии обработчик не выполняется, значит записки не будет). По ней приёмыш-нянька
// и понимает: код 0 -- закрыли вручную, не поднимать; код не 0 или нет записки -- упал/снят жёстко, поднять.
function botExitNoteFile ()
{
    return pathMod.join (LOG_DIR, 'bot.exit');
}
function readBotExitNote ()
{
    try
    {
        const parts = String (fsMod.readFileSync (botExitNoteFile (), 'utf8')).trim ().split (/\s+/);
        const pid = parseInt (parts[0], 10) || 0;
        const code = parseInt (parts[1], 10);
        if (!pid) return null;
        return {pid: pid, code: Number.isFinite (code) ? code : 0};
    }
    catch (e) { return null; }
}
function clearBotExitNote ()
{
    try { if (fsMod.existsSync (botExitNoteFile ())) fsMod.unlinkSync (botExitNoteFile ()); }
    catch (e) {}
}
// Замок бота (logs/bot.pid) -- по нему нянька и берёт уже играющего бота под присмотр.
function botLockPid ()
{
    const pid = readLockPid (pathMod.join (LOG_DIR, 'bot.pid'));
    return processAlive (pid) ? pid : 0;
}
// Бот вышел, не прочитав просьбу (например, погас по сигналу сам) -- убираю её, чтобы она не путала
// следующий запуск (бот, впрочем, и сам убирает чужую-старую просьбу на старте).
function forgetBotStopRequest ()
{
    if (!askedPid) return;
    const f = pathMod.join (LOG_DIR, 'bot.stop');
    try
    {
        if (fsMod.existsSync (f) && parseInt (String (fsMod.readFileSync (f, 'utf8')).replace (/\D+/g, ''), 10) === askedPid)
        {
            fsMod.unlinkSync (f);
            log ('просьбу, которую бот не успел прочитать, убрал');
        }
    }
    catch (e) {}
    askedPid = 0;
}
// v2.164 -- бота поднимает посредник cmd: см. разбор в шапке файла. Путь и главный аргумент -- в кавычках
// (в пути бывают пробелы), остальные аргументы -- как есть; /d отключает автозапуск, /s -- предсказуемый
// разбор кавычек, /c -- «выполнить и выйти кодом команды» (по этому коду я и понимаю, упал бот или закрылся).
const COMSPEC = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
function botCommandLine ()
{
    const q = s => '"' + String (s) + '"';
    return q (NODE) + ' ' + q (MAIN) + (process.argv.length > 2 ? ' ' + process.argv.slice (2).join (' ') : '');
}
function logStamp ()
{
    const now = new Date (), two = n => String (n).padStart (2, '0');
    return two (now.getDate ()) + '.' + two (now.getMonth () + 1) + '.' + now.getFullYear () + ', ' +
        two (now.getHours ()) + ':' + two (now.getMinutes ()) + ':' + two (now.getSeconds ());
}
function log (line)
{
    try { process.stdout.write ('[' + new Date ().toLocaleTimeString () + '] [supervisor] ' + line + '\n'); } catch (e) {}
    if (!LOG_FILE) return;
    try { fsMod.appendFileSync (LOG_FILE, '[' + logStamp () + '] [supervisor] ' + line + '\n'); } catch (e) {}
}

let child = null;
let stopping = false;
let startedAt = 0;
const crashes = [];

function start ()
{
    if (stopping) return;        // сигнал пришёл, пока ждали паузу между перезапусками -- бота не поднимаю
    startedAt = Date.now ();
    log ('запускаю бота: ' + botCommandLine () + ' (через cmd, супервизор: pid ' + process.pid + ')');
    child = spawn (COMSPEC, ['/d', '/s', '/c', '"' + botCommandLine () + '"'],
    {
        cwd: __dirname,
        stdio: 'inherit',
        // v2.164: кавычки расставляю сам (windowsVerbatimArguments), иначе cmd разберёт строку по-своему
        windowsVerbatimArguments: true,
        env: Object.assign ({}, process.env, {PANDAMIA_SUPERVISOR: '1'}),
    });
    child.on ('error', e =>
    {
        log ('бота запустить не удалось: ' + ((e && e.message) || e));
        process.exit (1);
    });
    child.on ('exit', (code, signal) =>
    {
        child = null;
        const lived = Math.round ((Date.now () - startedAt) / 1000);
        if (stopping)
        {
            forgetBotStopRequest ();
            log ('бот остановлен' + (typeof code === 'number' ? ' (код ' + code + ')' : '') + ' -- супервизор выходит');
            process.exit (typeof code === 'number' ? code : 0);
        }
        if (code === 0)
        {
            log ('бот вышел сам (код 0, прожил ' + lived + ' с) -- не поднимаю: так закрывают вручную');
            process.exit (0);
        }
        log ('бот упал (' + (signal ? 'сигнал ' + signal : 'код ' + code) + ', прожил ' + lived + ' с)');
        restartAfterCrash ();
    });
}

// Общий счёт падений для обеих схем -- и когда бота запускал я, и когда подобрал его без няньки.
function restartAfterCrash ()
{
    const now = Date.now ();
    while (crashes.length && (now - crashes[0]) > WINDOW_MS) crashes.shift ();
    crashes.push (now);
    if (crashes.length >= RESTART_LIMIT)
    {
        log ('за минуту это падение ' + crashes.length + '-е подряд -- похоже, дело не в случайности, крутиться вслепую не буду.');
        log ('посмотри последние строки живого лога и logs/crash-*.txt, поправь причину и запусти снова.');
        process.exit (1);
    }
    const wait = BACKOFF_MS[Math.min (crashes.length - 1, BACKOFF_MS.length - 1)];
    log ('подниму через ' + Math.round (wait / 1000) + ' с (падение ' + crashes.length + ' из ' + RESTART_LIMIT + ')');
    setTimeout (start, wait);
}

// v2.166 -- «приёмыш»: бот уже играет, а няньки у него нет (её сняли жёстко, окно закрыли или бота
// подняли вручную). Тогда второго бота НЕ поднимаю -- слежу за замком приёмыша по секунде и, когда он
// исчезнет, решаю по записке бота о выходе: вышел сам (код 0) -- не поднимаю, упал или снят жёстко -- поднимаю.
let adoptedPid = 0;
function adoptBot (pid)
{
    adoptedPid = pid;
    const since = Date.now ();
    log ('вижу работающего бота (pid ' + pid + ', замок ' + pathMod.join (LOG_DIR, 'bot.pid') + ') -- беру его под присмотр');
    const tick = setInterval (() =>
    {
        if (processAlive (pid)) return;
        clearInterval (tick);
        adoptedPid = 0;
        const lived = Math.round ((Date.now () - since) / 1000);
        const note = readBotExitNote ();
        const mine = note && note.pid === pid ? note : null;
        if (stopping)
        {
            forgetBotStopRequest ();
            log ('бот остановлен' + (mine ? ' (код ' + mine.code + ')' : '') + ' -- супервизор выходит');
            process.exit (mine && typeof mine.code === 'number' ? mine.code : 0);
        }
        if (mine && mine.code === 0)
        {
            log ('бот вышел сам (код 0, под присмотром был ' + lived + ' с) -- не поднимаю: так закрывают вручную');
            process.exit (0);
        }
        log ('бот ' + (mine ? 'упал (код ' + mine.code + ')' : 'пропал без записки о выходе -- значит сняли жёстко') +
            ', под присмотром был ' + lived + ' с');
        clearBotExitNote ();
        restartAfterCrash ();
    }, 1000);
    // Отсоединять сторожа НЕЛЬЗЯ: в режиме приёмыша это единственная зацепка, которая держит няньку
    // живой (бот-то не мой ребёнок) -- с unref нянька вышла бы сразу и присмотр опять потерялся бы.
    void tick;
}

// Сигнал консоли (Ctrl+C, а по закрытию окна -- SIGHUP) приходит и боту: он в этом же окне и сохраняет
// очередь сам, а я ухожу за ним по правилу ниже. Сверх этого пишу ему просьбу остановиться (как делает
// `node . stop`): если сигнал до бота почему-то не дошёл, он всё равно выйдет по-хорошему.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.on (sig, () =>
    {
        if (stopping) return;
        stopping = true;
        if (!child && !adoptedPid)
        {
            log ('останавливаюсь по сигналу ' + sig + ': бот сейчас не запущен (ждём паузу перед перезапуском) -- выхожу');
            process.exit (0);
        }
        const why = sig === 'SIGHUP' ? 'окно закрывают' : 'получен сигнал ' + sig;
        log ('останавливаюсь (' + why + '): прошу бота сохранить очередь и выйти');
        if (askBotToStop ()) log ('просьба положена в ' + pathMod.join (LOG_DIR, 'bot.stop') + ' -- бот прочитает её за секунду');
        // Бот мог не увидеть просьбу (например, ещё стартовал и не написал замок) -- повторяю, пока он жив.
        // Приёмыша сигнал в этой консоли не касается (его окно -- другое), поэтому действует именно просьба.
        const repeat = setInterval (() =>
        {
            if (child || (adoptedPid && processAlive (adoptedPid))) { askBotToStop (); return; }
            clearInterval (repeat);
        }, 3000);
        if (repeat.unref) repeat.unref ();
        const force = setTimeout (() =>
        {
            clearInterval (repeat);
            // Просьбу НЕ убираю: если бот сейчас занят и ответит позже, он ещё успеет сохранить очередь и выйти.
            log ('бот не ответил за 15 с -- выхожу сам; бот при этом играет дальше (остановить: `node . stop`)');
            process.exit (0);
        }, 15000);
        if (force.unref) force.unref ();
    });

const supBusy = claimSupervisorLock ();
if (supBusy)
{
    log (supBusy + ' -- выхожу; бот при этом играет, и останавливать его не нужно');
    process.exit (0);
}
log ('PANDAMIA супервизор: держу бота запущенным. Ctrl+C -- остановить обоих (бот выйдет по-хорошему, очередь и позиция целы).');
log ('правило: упадёт бот -- подниму его сам (паузы 2, 5, 15, 30, 60 с); закроют вручную (код 0) -- не поднимаю; меня снимут грубо -- бот доиграет без присмотра, а следующий `node .` вернёт меня к нему (остановить: `node . stop`).');
const liveBot = botLockPid ();
if (liveBot) adoptBot (liveBot);
else start ();
