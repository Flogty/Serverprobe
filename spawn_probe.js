// spawn_probe.js — заходит на Bedrock-сервер как клиент, просит большой радиус чанков
// и пишет сырые пакеты мира (level_chunk / subchunk) в файл. Конвертацию в .mcworld делаем потом,
// когда увидим, что реально приходит от сервера.
//
// Запуск:  npm i bedrock-protocol && node spawn_probe.js
// Первый вход: в консоли появится ссылка и код — открыть на телефоне и войти в Xbox-аккаунт.

const bedrock = require('bedrock-protocol')
const fs = require('fs')
const v8 = require('v8')

const HOST = 'mypex.ru'
const PORT = 19133
const SECONDS = 60          // сколько сидим на спавне
const RADIUS = 32           // запрашиваемый радиус чанков (сервер может урезать)

fs.mkdirSync('dump', { recursive: true })
const out = fs.createWriteStream('dump/packets.bin')
const counts = {}

function save (name, packet) {
  counts[name] = (counts[name] || 0) + 1
  const buf = v8.serialize({ name, packet })
  const len = Buffer.alloc(4); len.writeUInt32LE(buf.length)
  out.write(len); out.write(buf)
}

const client = bedrock.createClient({
  host: HOST,
  port: PORT,
  username: 'probe',                 // для Xbox-аккаунта имя берётся из аккаунта
  profilesFolder: './auth',          // кэш токенов, повторно логиниться не придётся
  // version: '1.26.30',             // раскомментировать, если автоопределение версии не сработает
  conLog: console.log
})

client.on('error', e => console.error('ERROR:', e.message))
client.on('disconnect', p => { console.log('DISCONNECT:', JSON.stringify(p)); finish() })

client.on('join', () => console.log('join: версия протокола клиента =', client.options.version))

client.on('start_game', p => {
  console.log('start_game: pos', JSON.stringify(p.player_position), 'dim', p.dimension)
  save('start_game', p)
})

client.on('spawn', () => {
  console.log('spawned, запрашиваю радиус', RADIUS)
  client.queue('request_chunk_radius', { chunk_radius: RADIUS, max_radius: RADIUS })
  setTimeout(finish, SECONDS * 1000)
})

client.on('chunk_radius_update', p => console.log('сервер дал радиус:', p.chunk_radius))
client.on('level_chunk', p => save('level_chunk', p))
client.on('subchunk', p => save('subchunk', p))
client.on('network_chunk_publisher_update', p => save('network_chunk_publisher_update', p))

let done = false
function finish () {
  if (done) return
  done = true
  console.log('итого пакетов:', counts)
  out.end(() => process.exit(0))
}
