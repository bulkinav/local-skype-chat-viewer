import json
from collections import defaultdict, Counter
import re
import html

print("Начинаю обработку данных Skype...")

# --- Загрузка данных ---
try:
    with open('messages.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    with open('endpoints.json', 'r', encoding='utf-8') as f:
        endpoints_data = json.load(f)
except FileNotFoundError:
    print("Ошибка: убедитесь, что файлы messages.json и endpoints.json находятся в той же папке, что и скрипт.")
    exit()

# --- Автоматическое определение ID владельца ---
print("Определяю владельца архива...")
from_counts = Counter()
conversations_list = data.get('conversations', [])
for conversation in conversations_list:
    for message in conversation.get('MessageList', []): 
        sender = message.get('from')
        if sender:
            from_counts[sender] += 1

if not from_counts:
    print("Ошибка: не найдено ни одного сообщения для определения владельца.")
    exit()

user_id = from_counts.most_common(1)[0][0]
print(f"Автоматически определен ID владельца: {user_id}")

# --- Группировка сообщений по чатам ---
print("\nГруппирую сообщения по чатам...")
grouped_chats = defaultdict(list)
total_conversations_found = len(conversations_list)
print(f"Найдено {total_conversations_found} объектов бесед в файле.")

for conversation in conversations_list:
    if 'id' in conversation and 'MessageList' in conversation:
        chat_id = conversation['id']
        grouped_chats[chat_id].extend(conversation['MessageList'])

print(f"Создано {len(grouped_chats)} групп чатов.")

# --- Создание карты контактов для имен ---
contact_map = {}
if 'contacts' in endpoints_data:
    for contact in endpoints_data['contacts']:
        contact_map[contact.get('id')] = contact.get('displayname', 'Неизвестный контакт')
for chat in conversations_list:
    if 'id' in chat and 'displayName' in chat and chat['displayName']:
        contact_map[chat['id']] = chat['displayName']

# --- Обработка и сортировка сообщений ---
print("\nНачинаю обработку сообщений в каждом чате...")
final_chats = {}
processed_chats_count = 0

for chat_id, messages in grouped_chats.items():
    processed_messages = []
    
    for msg in messages:
        if msg.get('messagetype') == 'Event/Call':
            continue

        content = msg.get('content')
        media_path = None
        
        if content and '<uri' in content:
            match = re.search(r'vcard_name="([^"]+)"', content)
            if match:
                filename = match.group(1)
                media_path = f"media/{filename}"
            else:
                match = re.search(r'>([^<]+)</URI>', content, re.IGNORECASE)
                if match and any(ext in match.group(1).lower() for ext in ['.jpg', '.png', '.gif', '.jpeg', '.mp4', '.mov']):
                     filename = match.group(1)
                     media_path = f"media/{filename}"

        if content:
            content = content.replace('<br/>', '\n').replace('<br>', '\n')
            content = re.sub(r'<[^>]+>', '', content)
            content = html.unescape(content).strip()
        else:
            content = ""

        if content == "" and not media_path:
             if msg.get('messagetype') != 'Text':
                 content = f"[{msg.get('messagetype', 'Системное сообщение')}]"
             else:
                 continue

        processed_messages.append({
            'from': msg.get('from', 'unknown').replace('8:', ''),
            'timestamp': msg.get('originalarrivaltime'),
            'content': content,
            'media_path': media_path
        })
    
    if processed_messages:
        processed_messages.sort(key=lambda x: x.get('timestamp') or "")
        final_chats[chat_id] = processed_messages
        processed_chats_count += 1
        print(f"  - Обработан чат '{contact_map.get(chat_id, chat_id)}': {len(processed_messages)} сообщений добавлено.")
    else:
        print(f"  - ВНИМАНИЕ: В чате '{contact_map.get(chat_id, chat_id)}' все сообщения были отфильтрованы.")


# --- Формирование финального JSON ---
output_data = {
    'ownerId': user_id.replace('8:', ''),
    'contacts': contact_map,
    'chats': final_chats
}

# --- Сохранение результата ---
with open('processed_data.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"\nГотово! Обработано и сохранено {processed_chats_count} чатов.")
print("Файл processed_data.json успешно создан.")