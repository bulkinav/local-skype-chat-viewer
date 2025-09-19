import re
from collections import defaultdict, Counter
from datetime import datetime
import json

INPUT_FILE = 'skype_messages.txt'
OUTPUT_FILE = 'processed_data.json'

def parse_records(file_content):
    """Разбивает текстовый файл на отдельные записи."""
    records_raw = file_content.split('==================================================')
    return [record.strip() for record in records_raw if record.strip()]

def parse_record_to_dict(record_text):
    """Преобразует текст одной записи в словарь."""
    record_dict = {}
    for line in record_text.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            record_dict[key.strip()] = value.strip()
    return record_dict

def get_canonical_chat_key(chat_id):
    """
    Создает уникальный и стабильный ключ для чата на основе его участников.
    Это ключ для объединения дублирующихся чатов.
    """
    # Убираем префикс и хеш-суффикс: #user1/$user2;hash -> user1/user2
    clean_id = chat_id.split(';')[0].replace('#', '').replace('$', '')
    participants = clean_id.split('/')
    
    # Сортируем участников, чтобы порядок не имел значения (user1/user2 == user2/user1)
    participants.sort()
    
    # Соединяем в одну строку, которая и будет нашим ключом
    return '|'.join(participants)

def get_chat_display_name(canonical_key, owner_id, contact_map):
    """Создает человекочитаемое имя для чата на основе канонического ключа."""
    participants = canonical_key.split('|')
    
    # Если это личный чат (2 участника)
    if len(participants) == 2:
        other_user = next((p for p in participants if p != owner_id), None)
        if other_user:
            other_user_name = contact_map.get(other_user, other_user)
            # Строгое соответствие "Чат с Имя"
            return f"Чат с {other_user_name}"

    # Если это групповой чат
    other_participants = [contact_map.get(p, p) for p in participants if p != owner_id]
    if other_participants:
        # Для групповых чатов просто перечисляем участников
        return ", ".join(other_participants)
    
    return canonical_key # Запасной вариант

print(f"Начинаю импорт из файла '{INPUT_FILE}'...")

try:
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
except FileNotFoundError:
    print(f"Ошибка: Файл '{INPUT_FILE}' не найден.")
    exit()

all_records = parse_records(content)
print(f"Найдено {len(all_records)} записей в файле.")

# --- Парсим все записи ---
all_parsed_messages = []
contact_map = {} # { 'user_name': 'display_name' }
senders = []

for record_text in all_records:
    record = parse_record_to_dict(record_text)
    
    if record.get('Action Type') != 'Chat Message':
        continue
    
    if not all(k in record for k in ['ChatID', 'User Name', 'Action Time', 'Chat Message']):
        continue
        
    chat_id = record['ChatID']
    user_name = record['User Name']
    display_name = record.get('Display Name', user_name)
    
    if user_name and display_name:
        contact_map[user_name] = display_name
        
    content = re.sub(r'<[^>]+>', '', record['Chat Message'])
    
    try:
        dt_object = datetime.strptime(record['Action Time'], '%d.%m.%Y %H:%M:%S')
        iso_timestamp = dt_object.isoformat()
    except ValueError:
        continue

    all_parsed_messages.append({
        'original_chat_id': chat_id, # Сохраняем оригинальный ID для группировки
        'from': user_name,
        'timestamp': iso_timestamp,
        'content': content.strip(),
        'media_path': None
    })
    senders.append(user_name)

print(f"Обработано {len(all_parsed_messages)} сообщений.")

# --- Определяем владельца архива ---
if not senders:
    print("Ошибка: не найдено ни одного сообщения для определения владельца.")
    exit()

owner_id = Counter(senders).most_common(1)[0][0]
print(f"Автоматически определен владелец архива: {owner_id}")

# --- Группируем сообщения по каноническому ключу (ОБЪЕДИНЕНИЕ) ---
merged_chats = defaultdict(list)
for msg in all_parsed_messages:
    canonical_key = get_canonical_chat_key(msg.pop('original_chat_id'))
    merged_chats[canonical_key].append(msg)

print(f"Сообщения объединены в {len(merged_chats)} уникальных чатов.")

# --- Сортируем сообщения в каждом объединенном чате ---
final_chats = {}
for key, messages in merged_chats.items():
    if messages:
        messages.sort(key=lambda x: x['timestamp'])
        final_chats[key] = messages

# --- Создаем красивые имена для объединенных чатов и добавляем их в contact_map ---
final_contact_map = contact_map.copy() # Начинаем с карты имен пользователей
for canonical_key in final_chats.keys():
    chat_name = get_chat_display_name(canonical_key, owner_id, contact_map)
    final_contact_map[canonical_key] = chat_name
    
# --- Формируем и сохраняем итоговый JSON ---
output_data = {
    'ownerId': owner_id,
    'contacts': final_contact_map, # Используем новую карту с именами чатов
    'chats': final_chats
}

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"\nГотово! Данные успешно объединены и сохранены в файл '{OUTPUT_FILE}'.")