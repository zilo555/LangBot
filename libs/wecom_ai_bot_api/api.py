import json
import time
import uuid
import xml.etree.ElementTree as ET
from urllib.parse import unquote
import hashlib
import traceback

import httpx
from libs.wecom_ai_bot_api.WXBizMsgCrypt3 import WXBizMsgCrypt
from quart import Quart, request, Response, jsonify
import langbot_plugin.api.entities.builtin.platform.message as platform_message
import asyncio
from libs.wecom_ai_bot_api import wecombotevent
from typing import Callable
import base64
from Crypto.Cipher import AES
from pkg.platform.logger import EventLogger



class WecomBotClient:
    def __init__(self,Token:str,EnCodingAESKey:str,Corpid:str,logger:EventLogger):
        self.Token=Token
        self.EnCodingAESKey=EnCodingAESKey
        self.Corpid=Corpid
        self.ReceiveId = ''
        self.app = Quart(__name__)
        self.app.add_url_rule(
            '/callback/command',
            'handle_callback',
            self.handle_callback_request,
            methods=['POST','GET']
        )
        self._message_handlers = {
            'example': [],
        }
        self.user_stream_map = {}
        self.logger = logger
        self.generated_content = {}
        self.msg_id_map = {}

    async def sha1_signature(token: str, timestamp: str, nonce: str, encrypt: str) -> str:
        raw = "".join(sorted([token, timestamp, nonce, encrypt]))
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()
    
    async def handle_callback_request(self):
        try:
            self.wxcpt=WXBizMsgCrypt(self.Token,self.EnCodingAESKey,'')

            if request.method == "GET":

                msg_signature = unquote(request.args.get("msg_signature", ""))
                timestamp     = unquote(request.args.get("timestamp", ""))
                nonce         = unquote(request.args.get("nonce", ""))
                echostr       = unquote(request.args.get("echostr", ""))

                if not all([msg_signature, timestamp, nonce, echostr]):
                    await self.logger.error("请求参数缺失")
                    return Response("缺少参数", status=400)

                ret, decrypted_str = self.wxcpt.VerifyURL(msg_signature, timestamp, nonce, echostr)
                if ret != 0:
                    
                    await self.logger.error("验证URL失败")
                    return Response("验证失败", status=403)

                return Response(decrypted_str, mimetype="text/plain")

            elif request.method == "POST":
                msg_signature = unquote(request.args.get("msg_signature", ""))
                timestamp     = unquote(request.args.get("timestamp", ""))
                nonce         = unquote(request.args.get("nonce", ""))

                try:
                    timeout = 3
                    interval = 0.1
                    start_time = time.monotonic()
                    encrypted_json  = await request.get_json()
                    encrypted_msg   = encrypted_json.get("encrypt", "")
                    if not encrypted_msg:
                        await self.logger.error("请求体中缺少 'encrypt' 字段")

                    xml_post_data = f"<xml><Encrypt><![CDATA[{encrypted_msg}]]></Encrypt></xml>"
                    ret, decrypted_xml = self.wxcpt.DecryptMsg(xml_post_data, msg_signature, timestamp, nonce)
                    if ret != 0:
                        await self.logger.error("解密失败")


                    msg_json = json.loads(decrypted_xml)
                    
                    from_user_id = msg_json.get("from", {}).get("userid")
                    chatid = msg_json.get("chatid", "")
                    
                    message_data = await self.get_message(msg_json)
                    
                    

                    if message_data:
                        try:
                            event = wecombotevent.WecomBotEvent(message_data)
                            if event:
                                await self._handle_message(event)
                        except Exception as e:
                            await self.logger.error(traceback.format_exc())
                            print(traceback.format_exc())

                    start_time = time.time()
                    try:
                        if msg_json.get('chattype','') == 'single':
                            if from_user_id in self.user_stream_map:
                                stream_id = self.user_stream_map[from_user_id]
                            else:
                                stream_id =str(uuid.uuid4())
                                self.user_stream_map[from_user_id] = stream_id
                            

                        else:
                            
                            if chatid in self.user_stream_map:
                                stream_id = self.user_stream_map[chatid]
                            else:
                                stream_id = str(uuid.uuid4())
                                self.user_stream_map[chatid] = stream_id
                    except Exception as e:
                        await self.logger.error(traceback.format_exc())
                        print(traceback.format_exc())
                    while True:
                        content = self.generated_content.pop(msg_json['msgid'],None)
                        if content:
                            reply_plain = {
                                "msgtype": "stream",
                                "stream": {
                                    "id": stream_id,
                                    "finish": True,
                                    "content": content
                                }
                            }
                            reply_plain_str = json.dumps(reply_plain, ensure_ascii=False)

                            reply_timestamp = str(int(time.time()))
                            ret, encrypt_text = self.wxcpt.EncryptMsg(reply_plain_str, nonce, reply_timestamp)
                            if ret != 0:
                                
                                await self.logger.error("加密失败"+str(ret))
                            

                            root = ET.fromstring(encrypt_text)
                            encrypt = root.find("Encrypt").text
                            resp = {
                                "encrypt": encrypt,
                            }
                            return jsonify(resp), 200

                        if time.time() - start_time > timeout:
                            break

                        await asyncio.sleep(interval)

                    if self.msg_id_map.get(message_data['msgid'], 1) == 3:
                        await self.logger.error('请求失效：暂不支持智能机器人超过7秒的请求，如有需求，请联系 LangBot 团队。')
                        return ''

                except Exception as e:
                    await self.logger.error(traceback.format_exc())
                    print(traceback.format_exc())

        except Exception as e:
            await self.logger.error(traceback.format_exc())
            print(traceback.format_exc())

    
    async def get_message(self,msg_json):
        message_data = {}

        if msg_json.get('chattype','') == 'single':
            message_data['type'] = 'single'
        elif msg_json.get('chattype','') == 'group':
            message_data['type'] = 'group'

        if msg_json.get('msgtype') == 'text':
            message_data['content'] = msg_json.get('text',{}).get('content')
        elif msg_json.get('msgtype') == 'image':
            picurl = msg_json.get('image', {}).get('url','')
            base64 = await self.download_url_to_base64(picurl,self.EnCodingAESKey)
            message_data['picurl'] = base64 
        elif msg_json.get('msgtype') == 'mixed':
            items = msg_json.get('mixed', {}).get('msg_item', [])
            texts = []
            picurl = None
            for item in items:
                if item.get('msgtype') == 'text':
                    texts.append(item.get('text', {}).get('content', ''))
                elif item.get('msgtype') == 'image' and picurl is None:
                    picurl = item.get('image', {}).get('url')

            if texts:
                message_data['content'] = "".join(texts)  # 拼接所有 text
            if picurl:
                base64 = await self.download_url_to_base64(picurl,self.EnCodingAESKey)
                message_data['picurl'] = base64          # 只保留第一个 image

        message_data['userid'] = msg_json.get('from', {}).get('userid', '')
        message_data['msgid'] = msg_json.get('msgid', '')

        if msg_json.get('aibotid'):
            message_data['aibotid'] = msg_json.get('aibotid', '')

        return message_data
    
    async def _handle_message(self, event: wecombotevent.WecomBotEvent):
        """
        处理消息事件。
        """
        try:
            message_id = event.message_id
            if message_id in self.msg_id_map.keys():
                self.msg_id_map[message_id] += 1
                return
            self.msg_id_map[message_id] = 1
            msg_type = event.type
            if msg_type in self._message_handlers:
                for handler in self._message_handlers[msg_type]:
                    await handler(event)
        except Exception:
                print(traceback.format_exc())

    async def set_message(self, msg_id: str, content: str):
        self.generated_content[msg_id] = content

    def on_message(self, msg_type: str):
        def decorator(func: Callable[[wecombotevent.WecomBotEvent], None]):
            if msg_type not in self._message_handlers:
                self._message_handlers[msg_type] = []
            self._message_handlers[msg_type].append(func)
            return func

        return decorator


    async def download_url_to_base64(self, download_url, encoding_aes_key):
        async with httpx.AsyncClient() as client:
            response = await client.get(download_url)
            if response.status_code != 200:
                await self.logger.error(f'failed to get file: {response.text}')
                return None

            encrypted_bytes = response.content

        
        aes_key = base64.b64decode(encoding_aes_key + "=")  # base64 补齐
        iv = aes_key[:16]

        
        cipher = AES.new(aes_key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(encrypted_bytes)

        
        pad_len = decrypted[-1]
        decrypted = decrypted[:-pad_len]

        
        if decrypted.startswith(b"\xff\xd8"):   # JPEG
            mime_type = "image/jpeg"
        elif decrypted.startswith(b"\x89PNG"):  # PNG
            mime_type = "image/png"
        elif decrypted.startswith((b"GIF87a", b"GIF89a")):  # GIF
            mime_type = "image/gif"
        elif decrypted.startswith(b"BM"):       # BMP
            mime_type = "image/bmp"
        elif decrypted.startswith(b"II*\x00") or decrypted.startswith(b"MM\x00*"):  # TIFF
            mime_type = "image/tiff"
        else:
            mime_type = "application/octet-stream"

        # 转 base64
        base64_str = base64.b64encode(decrypted).decode("utf-8")
        return f"data:{mime_type};base64,{base64_str}"
    

    async def run_task(self, host: str, port: int, *args, **kwargs):
        """
        启动 Quart 应用。
        """
        await self.app.run_task(host=host, port=port, *args, **kwargs)

                
    
            

