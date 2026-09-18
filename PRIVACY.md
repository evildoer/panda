# Privacy Policy — PANDAMIA Discord bot

_Last updated: 19.09.2026_

This bot is a **private, self-hosted** Discord bot (Discord application name: "Peka") operated by one
person for one community. It is not listed in any bot directory, is not offered as a service to the
public, and is not used for advertising, analytics or profiling. This page describes exactly what the
bot stores and how it can be deleted.

## What the bot stores

Everything is keyed by **Discord IDs** (user IDs, role IDs, channel IDs, message IDs). Nothing is
stored in the cloud: there is no external database, no analytics service, no third-party API.

1. **Voice-room state and appearance** — which member currently owns which voice room, and the
   key mark (🔑) that the bot puts in front of a member's nickname while that member has rights in a
   channel. Derived from the current state and re-checked continuously; removed as soon as the
   rights are gone.
2. **Moderation timers** — when a member leaves the server, the bot records a 20-minute timeout
   (configurable by the operator) under that member's user ID, so that leaving and instantly
   rejoining cannot bypass an active moderation. The record is deleted as soon as the timeout is
   lifted or expires.
3. **Roles for restoration** — the IDs of the roles a member had when they left, so those roles can be
   given back when the member returns. **Kept indefinitely by default**, on purpose: a member who comes
   back after months still gets their roles back. The operator can set an expiry in days in the bot's
   configuration file (`save_roles_days`) if he prefers a shorter period.
4. **Punishment counters** — for each user ID, how many times the member left the server, was timed
   out or banned, and had a punishment lifted. Used by the staff-only `/bans` summary. **Kept
   indefinitely by default** for long-term statistics, with the same optional expiry in days
   (`bans_history_days`).
5. **Music queue** — the queue of tracks (their titles and links), the position in the current track
   and which member added each track. Stored so that a restart, a crash or a temporary disconnect does
   not reset the music. Cleared when a DJ stops the bot (`/stop`) or when the queue finishes.
6. **Server configuration** — channel IDs and role IDs that the operator put in the bot's config file
   (log channel, rules channel, DJ role, and so on).

The bot also writes a **plain-text log** (to its own console/`logs` on the operator's machine) about
active events: who joined or left voice, who was muted, which command was used and by whom. This log
never leaves the operator's machine except for the events the staff themselves want to see in the
server's own log channel (messages posted by the bot inside Discord).

## What the bot does NOT store

- **No message content.** The bot does not save, index or keep the text of any message. If the
  Message Content intent is available, it is used only to react to a staff command in the chat
  (a message starting with the configured prefix) and to republish a staff announcement from one
  channel to another; the text is neither written to a database nor kept after the action.
- No usernames, avatars, nicknames, e-mails, phone numbers or any other profile data.
- No message history, no voice recordings, no audio.
- No payment data, no IP addresses, no device information.
- No analytics, no advertising, no profiling, no machine-learning training on user data.
- Nothing is sold, shared or transferred to third parties (there are no third parties involved).

## Where the data is kept

In a single local SQLite file next to the bot on the machine of the person who runs it (the operator).
The bot runs on the operator's own computer/hosting; there is no external database and no API calls to
any service other than Discord itself. Access to the machine and to the file is limited to the
operator. The bot token and the configuration file are never published. One **local backup copy** of that file may
sit next to it (same folder, same machine, overwritten on every start), so that an abrupt power loss cannot leave
the bot without a readable database. It never leaves the machine and is never uploaded anywhere.

### Encryption

Every value written to that database is encrypted with **AES-256-GCM** (random IV per record, tag
checked on read). The key is a setting in the bot's own configuration file (`db_key`) on the same
machine; if the setting is empty, the bot stores values unencrypted and says so in its log. Records
written before encryption was enabled are still read; nothing is lost when it is switched on.

Nothing is ever decrypted on disk: to look at what is stored, the operator uses a read-only
inspection command (`node . dump [user id]`), which opens the database file read-only, decrypts a copy
in memory for display and does not change a single byte of it. Stored data in the database file stays
encrypted whether or not anyone looks.

Honest scope of that protection: the key sits next to the database, so a copy of the **whole folder**
stays readable — this protects the case where the **database file alone** ends up somewhere (a backup,
a cloud-synced folder, a copy on another machine): its content is unreadable ciphertext rather than a
list of role IDs and moderation counters. Nothing here protects against a person who has access to the
running machine under the operator's own account.

## Retention

| Data | Default | Configurable |
|---|---|---|
| Moderation timers | deleted when the timeout is lifted or expires | yes |
| Key marks (🔑) | removed as soon as the rights are gone | — |
| Role IDs for restoration | kept indefinitely (so returning members get their roles back) | yes, in days (`save_roles_days`) |
| Punishment counters | kept indefinitely, for statistics | yes, in days (`bans_history_days`) |
| Current music queue | until `/stop` or the end of the queue | — |
| Plain-text event log | the bot only prints it to its own console; nothing is uploaded and the bot keeps no log files itself (the operator may redirect the console to a local file) | — |

## How to have your data deleted

Any member can request deletion of everything the bot stores about them, in two ways:

1. **In Discord:** ask the staff of the server where the bot runs. They have the command
   `/forget user:@who`, which immediately deletes the stored role IDs and the punishment counters for
   that member. The command is available to server administrators/moderators only, the reply is visible
   only to them, and the deletion is written to the bot log. An active punishment is not affected by
   this command — it is lifted with `/unban`.
2. **Directly to the operator:** the contact is shown by the bot itself in the `/help` message (and in
   the message the bot sends when it starts). Write there and the same records will be deleted
   manually.

Because everything is stored locally and keyed by the Discord user ID, a deletion request is a single
lookup — nothing has to be requested from a third party, and nothing is left behind except the plain
text of already published log messages inside Discord itself (those can be deleted by the server's
staff like any other message).

## Children

The bot is not directed at children and does not knowingly store data about them. Discord's own
age requirements apply to everyone who uses the server where the bot runs.

## Changes

If the bot starts storing anything new, this page will be updated before that happens. The date of the
last change is at the top.

## Contact

The operator of this bot and the contact for any privacy request:

- **Discord: `lapulya666`** (user ID `247110936115150848`) -- direct messages are open, so this works
  for anyone, including people who are not in the server where the bot runs.

The bot also prints this contact by itself in the `/help` message on every server it runs on, so the
contact can be found without opening this page (it is configured by the operator, not hard-coded).

---

## Кратко по-русски

_Полная версия -- выше по-английски; здесь -- то же самое коротко._

Бот приватный, крутится на машине владельца и хранит только это (по **id** участника/роли/канала):
таймер таймаута за выход (20 минут, снимается сразу), id ролей -- чтобы вернуть их при возврате
человека на сервер, счётчики наказаний для сводки `/bans`, текущую очередь музыки (названия, позиция,
кто поставил) и настройки сервера из конфига. По умолчанию роли и счётчики **не имеют срока давности**
-- так и задумано: человек, вернувшийся через месяцы, всё равно получает свои роли. Владелец может
поставить срок в днях в файле конфигурации.

**Шифрование:** записи в базе -- AES-256-GCM, ключ в `config.json` (`db_key`); без ключа файл базы нечитаем. Наружу ничего не расшифровывается: посмотреть содержимое владелец может только командой чтения (`node . dump [id человека]`) -- файл открывается read-only, ни один байт не меняется, данные на диске остаются зашифрованными. Честно про границы: ключ лежит рядом с базой, поэтому копия папки целиком всё равно читается -- защищён случай, когда утекает **только файл базы** (там шифртекст, а не список id ролей).

**Не хранится:** текст сообщений (он используется только для команд staff и пересылки объявления),
ники, аватары, e-mail, история сообщений, записи голоса, IP-адреса, платежные данные. Никакой
аналитики, профилирования, обучения моделей и передачи данных на сторону -- сторонних сервисов нет
вообще, база одна и лежит локально.

**Удалить свои данные:** попросить staff сервера -- у них есть команда `/forget user:@кто`, она сразу
стирает id ролей и счётчики наказаний этого человека (активное наказание не трогает: его снимает
`/unban`); либо написать владельцу (контакт есть и здесь, и в `/help`), и те же записи удаляют вручную.

