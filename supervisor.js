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

// Как пользоваться (с v2.160 присмотр -- поведение по умолчанию, отдельно звать не нужно):
//   node .                    -- обычный запуск: сам поднимает супервизор (то же, что этот файл)
//   node supervisor.js        -- то же самое, явно (Ctrl+C -- остановить обоих)
//   npm run supervise         -- то же самое
//   PANDAMIA_NO_SUPERVISOR=1  -- отключить присмотр: бот живёт один, как раньше
//
// Правила:
//   - бот вышел кодом 0 -- значит, его закрыли вручную (Ctrl+C или команда); не поднимаю;
//   - бот упал (код не 0 или сигнал) -- поднимаю заново: паузы 2, 5, 15, 30, 60 секунд;
//   - пять падений за минуту -- останавливаюсь и говорю, куда смотреть (иначе был бы вечный цикл);
//   - сам супервизор получает Ctrl+C -- ждёт бота (сигнал приходит и ему: он в этом же окне,
//     сохраняет очередь и выходит) и выходит за ним; если сигнал пришёл в паузу между
//     перезапусками (бота сейчас нет), супервизор выходит сразу и нового не поднимает;
//   - супервизора снимают жёстко (taskkill /F) -- бот этого не замечает и играет дальше (v2.164).
//
// Проверочные ручки (только для песочницы, в обычной работе не нужны):
//   PANDAMIA_BOT_MAIN          -- что запускать вместо '.' (подставной скрипт)
//   PANDAMIA_SUPERVISOR_LIMIT  -- сколько падений за минуту терпеть (по умолчанию 5)
//   PANDAMIA_SUPERVISOR_BACKOFF-- список пауз через запятую (по умолчанию 2000,5000,15000,30000,60000)
//   PANDAMIA_SUPERVISOR_LOG    -- файл, куда дублировать строки няньки (подставляет сам бот; пусто -- только консоль)
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
            log ('бот остановлен' + (typeof code === 'number' ? ' (код ' + code + ')' : '') + ' -- супервизор выходит');
            process.exit (typeof code === 'number' ? code : 0);
        }
        if (code === 0)
        {
            log ('бот вышел сам (код 0, прожил ' + lived + ' с) -- не поднимаю: так закрывают вручную');
            process.exit (0);
        }
        const now = Date.now ();
        while (crashes.length && (now - crashes[0]) > WINDOW_MS) crashes.shift ();
        crashes.push (now);
        log ('бот упал (' + (signal ? 'сигнал ' + signal : 'код ' + code) + ', прожил ' + lived + ' с)');
        if (crashes.length >= RESTART_LIMIT)
        {
            log ('за минуту это падение ' + crashes.length + '-е подряд -- похоже, дело не в случайности, крутиться вслепую не буду.');
            log ('посмотри последние строки живого лога и logs/crash-*.txt, поправь причину и запусти снова.');
            process.exit (1);
        }
        const wait = BACKOFF_MS[Math.min (crashes.length - 1, BACKOFF_MS.length - 1)];
        log ('подниму через ' + Math.round (wait / 1000) + ' с (падение ' + crashes.length + ' из ' + RESTART_LIMIT + ')');
        setTimeout (start, wait);
    });
}

// Сигнал консоли (Ctrl+C) приходит и боту -- он в этом же окне: сохраняет очередь и выходит кодом 0,
// а я ухожу за ним по правилу ниже. Если бот не ответил за 15 с, выхожу сам; бот при этом продолжает
// играть (в окне видно его строки), и убрать его можно командой `node . stop` или ещё одним Ctrl+C.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.on (sig, () =>
    {
        if (stopping) return;
        stopping = true;
        if (!child)
        {
            log ('останавливаюсь по сигналу ' + sig + ': бот сейчас не запущен (ждём паузу перед перезапуском) -- выхожу');
            process.exit (0);
        }
        log ('останавливаюсь по сигналу ' + sig + ': жду бота, он сохраняет очередь и позицию');
        const force = setTimeout (() =>
        {
            log ('бот не ответил за 15 с -- выхожу сам; бот при этом играет дальше (остановить: `node . stop`)');
            process.exit (0);
        }, 15000);
        if (force.unref) force.unref ();
    });

log ('PANDAMIA супервизор: держу бота запущенным. Ctrl+C -- остановить обоих (бот выйдет по-хорошему, очередь и позиция целы).');
log ('правило: упадёт бот -- подниму его сам (паузы 2, 5, 15, 30, 60 с); закроют вручную (код 0) -- не поднимаю; меня снимут грубо -- бот останется играть (остановить: `node . stop`).');
start ();
