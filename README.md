# Local Skype Chat Viewer

A simple, local, browser-based viewer for your exported Skype chat history. This tool allows you to read your Skype backups in a familiar and convenient chat interface, running entirely on your own machine. No data is ever uploaded to any server, ensuring your privacy.

![local-skype-chat-viewer](https://github.com/user-attachments/assets/99260acd-c3d6-4f54-812a-e16f0234b05e)

## Key Features

- **Familiar Chat Interface**: View your conversations in a classic two-panel layout.
- **Fully Local & Private**: Everything runs in your browser. Your personal messages never leave your computer.
- **Supports Two Formats**:
    1.  **Modern Microsoft Export**: Works directly with the `.tar` archive you can download from your Microsoft account.
    2.  **Legacy Text Export**: Can import and display logs from older, local Skype databases exported as `.txt` files by tools like [SkypeLogView](https://www.nirsoft.net/utils/skype_log_view.html).
- **Chat Management**:
    - **Merge Chats**: Simply drag and drop one chat onto another to merge them.
    - **Rename Chats**: Edit chat names directly in the interface.
    - **Save Changes**: Download an updated data file with all your modifications.
- **User-Friendly**:
    - **Chat Search**: Quickly find conversations.
    - **Media Attachments**: View images from modern exports directly in the chat.
    - **Alphabetical Sorting**: Chats are sorted alphabetically for easy navigation.

## How to Use

### Prerequisites

You need **Python 3** installed on your computer to process the initial data files and run the local web server.

---

### Option A: For Modern Microsoft Exports (`.tar` file)

This is the standard backup you can download from Microsoft's "Export my data" page.

1.  **Download Your Data**: Get your Skype data export from Microsoft. You will receive a file like `skype_username.export.tar`.

2.  **Unpack the Archive**: Extract the `.tar` file. You will get a folder structure like this:
    ```
    /your_skype_export/
    ├── messages.json
    ├── endpoints.json
    └── media/
        └── ... (image and video files)
    ```

3.  **Download This Project**: Clone this repository or download the ZIP file and extract it.

4.  **Combine Files**: Copy all the files from this project (`index.html`, `style.css`, `app.js`, `prepare_data.py`, etc.) into the unpacked export folder from Step 2. Your folder should now look like this:
    ```
    /your_skype_export/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── prepare_data.py
    ├── import_legacy_skype.py  (and other project files)
    ├── messages.json
    ├── endpoints.json
    └── media/
    ```

5.  **Process the Data**: Open a terminal or command prompt in this folder and run the Python script:
    ```bash
    python3 prepare_data.py
    ```
    This script will read `messages.json`, group all messages into conversations, and create a single `processed_data.json` file for the web interface.

6.  **Start the Local Server**: In the same terminal, run the following command to start a local web server. This is required because modern browsers block local file access for security reasons.
    ```bash
    python3 -m http.server --cgi 8080 --bind 0.0.0.0
    ```

7.  **View Your Chats**: Open your web browser and go to the address: **`http://localhost:8080`**. You should now see all your chats.

---

### Option B: For Legacy Text Exports (`.txt` file)

If you have an old Skype history exported into a text file from a tool like [SkypeLogView](https://www.nirsoft.net/utils/skype_log_view.html).

1.  **Get Your Text File**: Make sure you have your chat history in a single `.txt` file. The file structure should look like this:
    ```
    ==================================================
    Record Number     : 1693
    Action Type       : Chat Message
    Action Time       : 17.08.2016 18:39:22
    End Time          : 
    User Name         : Pavel
    Display Name      : Pavel Nedurov
    Duration          : 
    Chat Message      : Hello, are you there?
    ChatID            : nedurov.p
    Filename          : 
    ==================================================
    ```

2.  **Download This Project**: Clone this repository or download the ZIP file and extract it into a new folder.

3.  **Add Your Log File**: Copy your exported text file into the project folder and **rename it to `skype_messages.txt`**.

4.  **Process the Data**: Open a terminal or command prompt in the project folder and run the legacy import script:
    ```bash
    python3 import_legacy_skype.py
    ```
    This will parse the text file, group messages, merge duplicate chats, and create the `processed_data.json` file.

5.  **Start the Local Server**: In the same terminal, run:
    ```bash
    python3 -m http.server --cgi 8080 --bind 0.0.0.0
    ```

6.  **View Your Chats**: Open your web browser and go to: **`http://localhost:8080`**.

## Editing and Saving Your Changes

You can rename and merge chats directly in the web interface. These changes are stored temporarily in your browser session. To save them permanently:

1.  Click the **"Save"** button in the top-left corner.
2.  Your browser will download a new, updated `processed_data.json` file.
3.  **Replace the old `processed_data.json` file** in your project folder with the one you just downloaded.
4.  The next time you open the viewer, it will load with your saved changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
