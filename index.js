const { VK } = require('vk-io')
const telegramBot = require('node-telegram-bot-api')
const { LocalStorage } = require('node-localstorage')
const localStorage = new LocalStorage('./data')

require('dotenv').config()

const vk = new VK({
    token: process.env.VK_GROUP_TOKEN
})
const tg = new telegramBot(process.env.TG_BOT_TOKEN, { polling: true })

// VK manipulation
async function formMessage(idSender, text, type, reply=false, level=0) {
    let resultMessage = '' + (level > 0 ? '      '.repeat(level - 1) + '↪️' : '')
    switch (type) {
        case 'user':
            const userInfo = (await vk.api.users.get({
                user_ids: idSender
            }))[0]
            resultMessage += `👤 *${userInfo.last_name} ${userInfo.first_name.slice(0, 1)}.*${reply ? ' ↩️' : ''}\n`
            resultMessage += text ? '      '.repeat(level + 1) + (reply ? `_${text}_\n` : `${text}\n`) : ''
            break
        case 'group':
            const groupInfo = (await vk.api.groups.getById({
                group_ids: idSender
            }))[0]
            resultMessage += `👥 *${groupInfo.name}*${reply ? ' ↩️' : ''}\n`
            resultMessage += text ? '      '.repeat(level + 1) + `${text}\n` : ''
            break
    }
    return resultMessage
}
async function parseVkMessageForwards(msg) {
    let message = ''
    for (const forward of msg.forwards) {

    }
}
async function parseVkMessage(msg, reply=false, level=0) {
    let message = ''
    if (msg.replyMessage) {
        message += await parseVkMessage(msg.replyMessage, true)
    }
    if (level === 0) {
        message += await formMessage(msg.senderId, msg.text, msg.senderType, reply)
        level++
    }
    if (msg.forwards && msg.forwards.length) {
        for (const forward of msg.forwards) {
            message += await formMessage(forward.senderId, forward.text, forward.senderType, false, level)
            if (forward.forwards && forward.forwards.length) {
                message += await parseVkMessage(forward,false, level + 1)
            }
        }
    }
    return message
}
vk.updates.on('message_new', async (context) => {
    if (localStorage['BUS_ENDPOINT_ID']) {
        console.log(context)
        await tg.sendMessage(localStorage['BUS_ENDPOINT_ID'], await parseVkMessage(context), { parse_mode: 'markdown' })
    } else {
        await context.send('Endpoint is not registered! Connect Tg bot to your group and white \'/reg\' in the chat')
    }
})

// TG manipulation
async function clearEndpoint(id) {
    localStorage.removeItem('BUS_ENDPOINT_ID')
    localStorage.removeItem('BUS_ENDPOINT_KEY')
    localStorage.removeItem('BUS_ENDPOINT_USER_REG')
    await tg.sendMessage(id, 'Endpoint was deleted!')
}
tg.onText(/\/reg/, async (context) => {
    if (!localStorage['BUS_ENDPOINT_KEY']) {
        if (context.chat.type === 'supergroup' || context.chat.type === 'private') {
            localStorage['BUS_ENDPOINT_ID'] = '' + context.chat.id
            localStorage['BUS_ENDPOINT_KEY'] = '' + (Math.round(Math.random() * (999999999 - 100000000) + 100000000))
            localStorage['BUS_ENDPOINT_USER_REG'] = context.from.username
            await tg.sendMessage(
                context.chat.id,
                `This group is selected by the bus endpoint!\nYour endpoint reset key: \`${localStorage['BUS_ENDPOINT_KEY']}\``,
                { parse_mode: 'markdown' }
            )
        }
    } else {
        if (localStorage['BUS_ENDPOINT_ID'] === '' + context.chat.id) {
            await tg.sendMessage(context.chat.id, 'This group already register as bus endpoint')
        } else {
            if (localStorage['BUS_ENDPOINT_USER_REG'] === context.from.username) {
                await tg.sendMessage(
                    context.chat.id,
                    `This bot was already register by you in another group! Input /unreg, for deleting bus endpoint`
                )
            } else {
                await tg.sendMessage(
                    context.chat.id,
                    `This bot was already register user @${localStorage['BUS_ENDPOINT_USER_REG']} in another group! Input /unreg "key", for deleting bus endpoint`
                )
            }
        }
    }
})
tg.onText(/\/unreg/, async (context) => {
    if (localStorage['BUS_ENDPOINT_USER_REG'] === context.from.username || localStorage['TG_ADMIN_USERNAME']  === context.from.username) {
        await clearEndpoint(context.chat.id)
    } else {
        const commandElems = context.text.split(' ')
        const key = commandElems.length === 2 ? context.text.split(' ')[1] : commandElems.length === 1 ? 'noKey' : null
        if (key) {
            if (key === 'noKey') {
                await tg.sendMessage(context.chat.id, 'You have not registered this bus endpoint. Enter key access')
            } else {
                if (key === localStorage['BUS_ENDPOINT_KEY']) {
                    await clearEndpoint(context.chat.id)
                } else {
                    await tg.sendMessage(context.chat.id, 'Key is not correct!')
                }
            }
        } else {
            await tg.sendMessage(context.chat.id, 'Incorrect syntax')
        }
    }
})

console.log('Bot started');
vk.updates.start().catch(console.error);