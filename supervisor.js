// PANDAMIA Bot -- супервизор (v2.157)
//
// Зачем: музыка должна играть «в любом случае». Если бот упал или штатно вышел после
// необработанного исключения, кто-то должен поднять его заново -- бот теперь сохраняет
// очередь и позицию и выходит кодом 1, а супервизор запускает его снова.
//
// Как пользоваться:
//   node supervisor.js        -- запустить бота под присмотром (Ctrl+C -- остановить обоих)
//   npm run supervise         -- то же самое
//   node .                    -- прежний запуск, без присмотра (если супервизор не нужен)
//
// Правила:
//   - бот вышел кодом 0 -- значит, его закрыли вручную (Ctrl+C или команда); не поднимаю;
//   - бот упал (код не 0 или сигнал) -- поднимаю заново: паузы 2, 5, 15, 30, 60 секунд;
//   - пять падений за минуту -- останавливаюсь и говорю, куда смотреть (иначе был бы вечный цикл);
//   - сам супервизор получает Ctrl+C -- ждёт бота (тот сохраняет очередь) и выходит; если сигнал
//     пришёл в паузу между перезапусками (бота сейчас нет), супервизор выходит сразу и нового не поднимает.
//
// Проверочные ручки (только для песочницы, в обычной работе не нужны):
//   PANDAMIA_BOT_MAIN          -- что запускать вместо '.' (подставной скрипт)
//   PANDAMIA_SUPERVISOR_LIMIT  -- сколько падений за минуту терпеть (по умолчанию 5)
//   PANDAMIA_SUPERVISOR_BACKOFF-- список пауз через запятую (по умолчанию 2000,5000,15000,30000,60000)
'use strict';
const {spawn} = require ('child_process');

const NODE = process.execPath;
const MAIN = process.env.PANDAMIA_BOT_MAIN || '.';
const RESTART_LIMIT = Math.max (1, Number (process.env.PANDAMIA_SUPERVISOR_LIMIT) || 5);
const WINDOW_MS = 60 * 1000;
const BACKOFF_MS = String (process.env.PANDAMIA_SUPERVISOR_BACKOFF || '2000,5000,15000,30000,60000')
    .split (',')
    .map (x => Math.max (0, Number (x) || 0));

function log (line)
{
    try { process.stdout.write ('[' + new Date ().toLocaleTimeString () + '] [supervisor] ' + line + '\n'); } catch (e) {}
}

let child = null;
let stopping = false;
let startedAt = 0;
const crashes = [];

function start ()
{
    if (stopping) return;        // сигнал пришёл, пока ждали паузу между перезапусками -- бота не поднимаю
    startedAt = Date.now ();
    log ('запускаю бота: node ' + MAIN + (process.argv.length > 2 ? ' ' + process.argv.slice (2).join (' ') : '') +
        ' (супервизор: pid ' + process.pid + ')');
    child = spawn (NODE, [MAIN].concat (process.argv.slice (2)),
    {
        cwd: __dirname,
        stdio: 'inherit',
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

for (const sig of ['SIGINT', 'SIGTERM'])
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
        const force = setTimeout (() => { log ('бот не вышел за 15 с -- выхожу сам'); process.exit (0); }, 15000);
        if (force.unref) force.unref ();
    });

log ('PANDAMIA супервизор: держу бота запущенным. Ctrl+C -- остановить обоих.');
log ('бот упал -- подниму заново сам; бот вышел кодом 0 (вручную) -- не поднимаю.');
start ();
