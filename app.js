document.addEventListener('DOMContentLoaded', () => {
    const chatListContainer = document.querySelector('.chat-list-items');
    const messagesContainer = document.getElementById('messages-container');
    const chatHeaderTitle = document.getElementById('chat-title');
    const chatCountSpan = document.getElementById('chat-count');
    const searchInput = document.getElementById('search-chat');
    const chatStartDateSpan = document.getElementById('chat-start-date');
    const saveChangesBtn = document.getElementById('save-changes-btn'); // ПУНКТ 7

    let skypeData = {};
    let activeChatId = null;
    let chatNameOverrides = {}; // Здесь будем хранить новые имена
    let isDataModified = false; // Флаг наличия несохраненных изменений

    fetch('processed_data.json')
        .then(response => response.json())
        .then(data => {
            skypeData = data;
            loadChatList();
        })
        .catch(error => {
            console.error("Ошибка при загрузке данных:", error);
            messagesContainer.innerHTML = `<p style="text-align: center;">Не удалось загрузить данные чатов.</p>`;
        });
        
    searchInput.addEventListener('input', () => {
        loadChatList(searchInput.value.toLowerCase());
    });

    function linkify(text) {
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(urlRegex, (url) => {
            let href = url;
            if (!href.startsWith('http')) {
                href = 'http://' + href;
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }
    
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, match => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match]));
    }

    // --- Исправление кавычек ---
    // Эта функция будет декодировать HTML-сущности типа &quot; в символы "
    function decodeHTMLEntities(text) {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    }

    // Логика сохранения файла
    saveChangesBtn.addEventListener('click', () => {
        if (Object.keys(chatNameOverrides).length === 0) {
            alert('Нет изменений для сохранения.');
            return;
        }

        // Создаем глубокую копию данных, чтобы не изменять оригинал в памяти
        const updatedData = JSON.parse(JSON.stringify(skypeData));

        // Применяем все наши переименования
        for (const chatId in chatNameOverrides) {
            if (updatedData.contacts.hasOwnProperty(chatId)) {
                updatedData.contacts[chatId] = chatNameOverrides[chatId];
            }
        }

        // Создаем JSON-строку
        const dataStr = JSON.stringify(updatedData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        // Создаем ссылку для скачивания и "нажимаем" на нее
        const a = document.createElement('a');
        a.href = url;
        a.download = 'processed_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Очищаем память

        alert('Файл processed_data.json с изменениями готов к скачиванию. Замените им старый файл.');
        chatNameOverrides = {}; // Сбрасываем изменения после сохранения
    });

    function loadChatList(filterText = '') {
        chatListContainer.innerHTML = '';
        const chatIds = Object.keys(skypeData.chats);

        // Сортиврока от новых сообщений к старым
        // chatIds.sort((a, b) => {
        //     const lastMsgA = skypeData.chats[a][skypeData.chats[a].length - 1]?.timestamp;
        //     const lastMsgB = skypeData.chats[b][skypeData.chats[b].length - 1]?.timestamp;
        //     if (!lastMsgA) return 1; if (!lastMsgB) return -1;
        //     return new Date(lastMsgB) - new Date(lastMsgA);
        // });

        // --- Алфавитная сортировка ---
        // Удаляем старую сортировку по дате и заменяем ее новой, алфавитной.
        chatIds.sort((a, b) => {
            // Получаем актуальные имена чатов (учитывая переименования)
            const nameA = chatNameOverrides[a] || skypeData.contacts[a] || a;
            const nameB = chatNameOverrides[b] || skypeData.contacts[b] || b;

            // Функция для определения группы сортировки (1 - Английский, 2 - Русский, 3 - Остальные)
            const getSortGroup = (name) => {
                if (/^[a-zA-Z]/.test(name)) return 1;
                if (/^[а-яА-ЯёЁ]/.test(name)) return 2;
                return 3;
            };

            const groupA = getSortGroup(nameA);
            const groupB = getSortGroup(nameB);

            // 1. Сначала сортируем по группе (Английский < Русский < Остальное)
            if (groupA !== groupB) {
                return groupA - groupB;
            }

            // 2. Если чаты в одной группе, сортируем их по алфавиту внутри группы
            // localeCompare идеально подходит для корректной сортировки, включая русские буквы.
            return nameA.localeCompare(nameB, 'ru', { sensitivity: 'base' });
        });

        const filteredChatIds = chatIds.filter(chatId => {
            // Ищем по новому или старому имени
            const chatName = chatNameOverrides[chatId] || skypeData.contacts[chatId] || chatId;
            return chatName.toLowerCase().includes(filterText);
        });

        chatCountSpan.textContent = filteredChatIds.length;

        filteredChatIds.forEach(chatId => {
            if (skypeData.chats[chatId].length === 0) return;

            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            if (chatId === activeChatId) chatItem.classList.add('active');
            chatItem.dataset.chatId = chatId;

            // --- Делаем элемент перетаскиваемым ---
            chatItem.draggable = true;

            // Используем новое имя, если оно есть
            const chatName = chatNameOverrides[chatId] || skypeData.contacts[chatId] || chatId;

            // Создаем структуру с именем и иконкой
            chatItem.innerHTML = `
                <span class="chat-item-name">${escapeHTML(chatName)}</span>
                <i class="fa-solid fa-pencil edit-chat-icon" title="Переименовать чат"></i>
            `;
            
            // Обработчик клика на весь элемент (для открытия чата)
            chatItem.querySelector('.chat-item-name').addEventListener('click', () => {
                if (activeChatId) {
                   const oldActive = document.querySelector(`[data-chat-id="${activeChatId}"]`);
                   if(oldActive) oldActive.classList.remove('active');
                }
                activeChatId = chatId;
                chatItem.classList.add('active');
                loadMessages(chatId);
            });

            // Обработчик клика на иконку редактирования
            chatItem.querySelector('.edit-chat-icon').addEventListener('click', (e) => {
                e.stopPropagation(); // Не даем сработать клику на весь элемент
                const nameSpan = chatItem.querySelector('.chat-item-name');
                const currentName = nameSpan.textContent;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'chat-item-edit-input';
                input.value = currentName;

                nameSpan.replaceWith(input);
                input.focus();
                input.select();

                const saveNewName = () => {
                    const newName = input.value.trim();
                    if (newName && newName !== currentName) {
                        chatNameOverrides[chatId] = newName; // Сохраняем новое имя
                        isDataModified = true;
                        input.replaceWith(nameSpan);
                        nameSpan.textContent = newName;
                        if(chatId === activeChatId) loadMessages(chatId); // Обновляем заголовок, если чат активен
                    } else {
                        input.replaceWith(nameSpan); // Возвращаем старое, если ничего не изменилось
                    }
                };

                input.addEventListener('blur', saveNewName);
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') input.blur();
                    if (event.key === 'Escape') {
                        input.replaceWith(nameSpan); // Отмена
                    }
                });
            });

            // --- Добавляем обработчики событий Drag and Drop ---
            chatItem.addEventListener('dragstart', handleDragStart);
            chatItem.addEventListener('dragend', handleDragEnd);
            chatItem.addEventListener('dragover', handleDragOver);
            chatItem.addEventListener('dragleave', handleDragLeave);
            chatItem.addEventListener('drop', handleDrop);

            chatListContainer.appendChild(chatItem);
        });
    }

    // --- Функции для Drag and Drop ---
    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.chatId);
        // Добавляем класс для визуального эффекта через небольшой таймаут
        setTimeout(() => this.classList.add('dragging'), 0);
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        draggedItem = null;
        // Убираем подсветку со всех элементов на всякий случай
        document.querySelectorAll('.chat-item.drag-over').forEach(item => item.classList.remove('drag-over'));
    }

    function handleDragOver(e) {
        e.preventDefault(); // Это обязательно, чтобы событие drop сработало
        if (this !== draggedItem) {
            this.classList.add('drag-over');
        }
        return false;
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.stopPropagation(); // Предотвращаем всплытие события
        this.classList.remove('drag-over');

        if (this === draggedItem) {
            return; // Нельзя сбросить элемент на самого себя
        }

        const sourceChatId = e.dataTransfer.getData('text/plain');
        const targetChatId = this.dataset.chatId;

        const sourceChatName = skypeData.contacts[sourceChatId] || sourceChatId;
        const targetChatName = skypeData.contacts[targetChatId] || targetChatId;

        if (confirm(`Вы уверены, что хотите объединить чат "${sourceChatName}" с чатом "${targetChatName}"? \n\nЧат "${sourceChatName}" будет удален.`)) {
            // 1. Объединяем сообщения
            const sourceMessages = skypeData.chats[sourceChatId];
            const targetMessages = skypeData.chats[targetChatId];
            const mergedMessages = sourceMessages.concat(targetMessages);

            // 2. Сортируем объединенный массив по дате
            mergedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // 3. Обновляем данные целевого чата
            skypeData.chats[targetChatId] = mergedMessages;
            
            // 4. Удаляем исходный чат
            delete skypeData.chats[sourceChatId];
            delete skypeData.contacts[sourceChatId]; // Также удаляем его из справочника контактов
            if(chatNameOverrides[sourceChatId]) delete chatNameOverrides[sourceChatId];

            // 5. Устанавливаем флаг, что данные изменены
            isDataModified = true;

            // 6. Перерисовываем список чатов
            loadChatList();
        }
    }

    function loadMessages(chatId) {
        messagesContainer.innerHTML = '';

        // Используем новое имя в заголовке
        const displayName = chatNameOverrides[chatId] || skypeData.contacts[chatId] || chatId;

        // --- Заголовок ---
        let titleHTML = escapeHTML(displayName);
        // Проверяем, что это личный чат (они обычно начинаются с '8:')
        if (chatId.startsWith('8:')) {
            const userId = chatId.substring(2); // Убираем префикс '8:'
            // Добавляем user_id в отдельном span для стилизации
            titleHTML += `<span class="header-user-id">(${escapeHTML(userId)})</span>`;
        }
        chatHeaderTitle.innerHTML = titleHTML;

        const messages = skypeData.chats[chatId];
        
        if (messages && messages.length > 0) {
            const firstMessageTimestamp = messages[0].timestamp;
            const firstMsgDate = new Date(firstMessageTimestamp).toLocaleDateString('ru-RU', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            chatStartDateSpan.textContent = `Первое сообщение: ${firstMsgDate}`;
        } else {
            chatStartDateSpan.textContent = '';
        }
        
        messages.forEach(msg => {
            const messageBubble = document.createElement('div');
            messageBubble.className = 'message-bubble';
            
            const isSent = msg.from === skypeData.ownerId;
            messageBubble.classList.add(isSent ? 'sent' : 'received');

            // --- Сообщения ---
            // Ищем имя по ID отправителя (msg.from). Если имя не найдено, используем ID.
            // Эта логика уже была, но теперь мы уверены в её работе.
            const senderName = isSent ? 'Вы' : (skypeData.contacts[msg.from] || msg.from);

            const formattedTime = new Date(msg.timestamp).toLocaleString('ru-RU');

            let contentHTML = '';
            if (msg.content) {
                // --- Исправление кавычек ---
                // 1. Декодируем сущности ( &quot; -> " )
                let decodedContent = decodeHTMLEntities(msg.content);
                // 2. Экранируем результат, чтобы обезопасить от вредоносных тегов
                let safeContent = escapeHTML(decodedContent);
                // 3. Превращаем URL в ссылки
                let processedContent = linkify(safeContent);
                // 4. Обрабатываем переносы строк
                processedContent = processedContent.replace(/\n/g, '<br>');
                contentHTML += `<div>${processedContent}</div>`;
            }

            if (msg.media_path) {
                contentHTML += `<img src="${msg.media_path}" alt="Вложение">`;
            }

            messageBubble.innerHTML = `
                ${!isSent ? `<div class="sender">${escapeHTML(senderName)}</div>` : ''}
                <div class="content">${contentHTML}</div>
                <div class="timestamp">${formattedTime}</div>
            `;
            
            messagesContainer.appendChild(messageBubble);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});