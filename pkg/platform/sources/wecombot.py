from __future__ import annotations
import typing
import asyncio
import traceback

import datetime
from pkg.platform.adapter import MessagePlatformAdapter
from pkg.platform.types import events as platform_events, message as platform_message
from libs.wecom_ai_bot_api.wecombotevent import WecomBotEvent
from libs.wecom_ai_bot_api.api import WecomBotClient
from .. import adapter
from ...core import app
from ..types import entities as platform_entities
from ...command.errors import ParamNotEnoughError
from ..logger import EventLogger

class WecomBotMessageConverter(adapter.MessageConverter):
    @staticmethod
    async def yiri2target(message_chain: platform_message.MessageChain):
        content = ''
        for msg in message_chain:
            if type(msg) is platform_message.Plain:
                content += msg.text
        return content

    @staticmethod
    async def target2yiri(event: WecomBotEvent):
        yiri_msg_list = []
        if event.type == 'group':
            yiri_msg_list.append(platform_message.At(target=event.ai_bot_id))
        yiri_msg_list.append(platform_message.Source(id=event.message_id, time=datetime.datetime.now()))
        yiri_msg_list.append(platform_message.Plain(text=event.content))
        if event.picurl != '':
            yiri_msg_list.append(platform_message.Image(base64=event.picurl))
        chain = platform_message.MessageChain(yiri_msg_list)

        return chain

class WecomBotEventConverter(adapter.EventConverter):

    @staticmethod
    async def yiri2target(event:platform_events.MessageEvent):
        return event.source_platform_object
    
    @staticmethod
    async def target2yiri(event:WecomBotEvent):
        message_chain = await WecomBotMessageConverter.target2yiri(event)
        if event.type == 'single':
            return platform_events.FriendMessage(
                sender=platform_entities.Friend(
                    id=event.userid,
                    nickname='',
                    remark='',
                ),
                message_chain=message_chain,
                time=datetime.datetime.now().timestamp(),
                source_platform_object=event,
            )
        elif event.type == 'group':
            try:
                sender = platform_entities.GroupMember(
                    id=event.userid,
                    permission='MEMBER',
                    member_name=event.userid,
                    group=platform_entities.Group(
                        id=str(event.chatid),
                        name='',
                        permission=platform_entities.Permission.Member,
                    ),
                    special_title='',
                    join_timestamp=0,
                    last_speak_timestamp=0,
                    mute_time_remaining=0,
                )
                time = datetime.datetime.now().timestamp()
                return platform_events.GroupMessage(
                    sender=sender,
                    message_chain=message_chain,
                    time=time,
                    source_platform_object=event,
                )
            except Exception:
                print(traceback.format_exc())

class WecomBotAdapter(adapter.MessagePlatformAdapter):
    bot : WecomBotClient
    app: app.Application
    message_converter = WecomBotMessageConverter()
    event_converter = WecomBotEventConverter()
    config:dict
    bot_account_id:str

    def __init__(self, config:dict, ap:app.Application, logger:EventLogger):
        self.config = config
        self.app = ap
        self.logger = logger
        required_keys = ['Token', 'EncodingAESKey', 'Corpid']
        missing_keys = [key for key in required_keys if key not in config]
        if missing_keys:
            raise ParamNotEnoughError('缺少相关配置项，请查看文档或联系管理员')
        self.bot = WecomBotClient(
            Token=self.config['Token'],
            EnCodingAESKey=self.config['EncodingAESKey'],
            Corpid=self.config['Corpid'],
            logger=self.logger,
        )
        self.bot_account_id = self.config['BotId']

    async def reply_message(self, message_source:platform_events.MessageEvent, message:platform_message.MessageChain,quote_origin: bool = False):

        content = await self.message_converter.yiri2target(message)
        await self.bot.set_message(message_source.source_platform_object.message_id, content)

    async def send_message(self, target_type, target_id, message):
        pass

    def register_listener(
        self,
        event_type: typing.Type[platform_events.Event],
        callback: typing.Callable[[platform_events.Event, MessagePlatformAdapter], None],
    ):
        async def on_message(event: WecomBotEvent):
            try:
                return await callback(await self.event_converter.target2yiri(event), self)
            except Exception:
                await self.logger.error(f'Error in wecombot callback: {traceback.format_exc()}')
                print(traceback.format_exc())
        try:
            if event_type == platform_events.FriendMessage:
                self.bot.on_message('single')(on_message)
            elif event_type == platform_events.GroupMessage:
                self.bot.on_message('group')(on_message)
        except Exception:
            print(traceback.format_exc())
            

    async def run_async(self):
        async def shutdown_trigger_placeholder():
            while True:
                await asyncio.sleep(1)

        await self.bot.run_task(
            host=self.config['host'],
            port=self.config['port'],
            shutdown_trigger=shutdown_trigger_placeholder,
        )

    async def kill(self) -> bool:
        return False

    async def unregister_listener(
        self,
        event_type: type,
        callback: typing.Callable[[platform_events.Event, MessagePlatformAdapter], None],
    ):
        return super().unregister_listener(event_type, callback)

    
