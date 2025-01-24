// DOM Elements
const chatWindow = document.querySelector('.js-chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('ai-input');
const submitButton = document.getElementById('chat-submit');

const CHATBOT_URL = '/gemini';;
const CASENOTES_URL = '/casenotes/';
const AUTO_SUMMARIZE_URL = '/genai_auto_summarize';

let currentCaseId = 12345;
let currentNoteType = 'note';
let currentVisitId = -1;

// Debug function to check elements
function debugElements() {
    console.log('Debugging elements:');
    console.log('chatWindow:', chatWindow);
    console.log('chatForm:', chatForm);
    console.log('chatInput:', chatInput);
    console.log('submitButton:', submitButton);
}

(async () => {
    await handleLoadCaseNotes(12345);
    $('#reload-case-notes').on('click', async () => await handleLoadCaseNotes(12345));
})();

// load case notes
async function handleLoadCaseNotes(case_id) {
    try {
        const response = await fetch(CASENOTES_URL + case_id, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        if (data) {
            $('#previous-notes-list').empty();

            for (let row of data) {
                if (row.genai_summary == 'null') {
                    row.genai_summary = null;
                }
                let summary = '<b>AI Summary:</b> ' + row.genai_summary;
                if (!row.genai_summary) {
                    summary = row.note ? row.note : '';
                }

                summary = summary.replace('(AI Assistant generated)', '<b>(AI Assistant generated)</b>');

                const element_id = `previous-notes-item-${row.visit_id}`;
                const type_header = row.note_type == 'genai' ? ': AI Assistant Note' : ''; // `Visit ${row.visit_id}`;
                const element = $(`
                    <li id="${element_id}" class="previous-notes__item">
                        <a href="#" class="previous-notes__link">
                            <span class="previous-notes__date">${row.visit_date}${type_header}</span>
                            <span class="previous-notes__preview">${summary}</span>
                        </a>
                    </li>
                `);

                $(element).data('note', row);
                $(element).on('click', function () {
                    const data = $(this).data('note');
                    currentVisitId = data.visit_id;
                    currentNoteType = data.note_type;
                    $('#case-notes-input').val(data.note).trigger('focus');
                });
                $('#previous-notes-list').append(element);
            }
        } else {
            throw new Error('No response in data');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Handle form submission
async function handleChatBotQuery(event) {
    console.log('Submit button clicked');
    console.log('Form submitted');
    console.log('Form:', chatForm);
    console.log('Chat input element:', chatInput);

    console.log('Chat input element value at submit:', chatInput.value);
    const message = chatInput.value;
    console.log('Raw message:', message);

    const trimmedMessage = message.trim();
    console.log('Trimmed message:', trimmedMessage);

    if (trimmedMessage) {
        // Display user message
        displayMessage('user', trimmedMessage);
        chatInput.value = '';

        let full_prompt = gatherNotes().join("\n") + `\nUSER: ${trimmedMessage}`;

        // Show loading state
        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('chat-message', 'chat-message--loading');
        loadingMessage.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        chatWindow.appendChild(loadingMessage);

        try {
            console.log('Calling cloud function at:', CHATBOT_URL);
            // Call cloud function
            const response = await fetch(CHATBOT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ message: full_prompt })
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                console.error('Response not OK:', response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response data:', data);

            if (data.response) {
                displayMessage('bot', data.response);
            } else {
                throw new Error('No response in data');
            }
        } catch (error) {
            console.error('Error:', error);
            displayMessage('bot', 'I apologize, but I encountered an error. Please try again.');
        } finally {
            loadingMessage.remove();
        }
    } else {
        console.log('Empty message, not sending');
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - Setting up event listeners');
    debugElements();

    if (!chatWindow || !chatForm || !chatInput || !submitButton) {
        console.error('Required elements not found');
        return;
    }

    // Display welcome message
    displayMessage('bot', "Hello! I'm your AI assistant for case management. How can I help you today?", 'first-time');

    // Form submit event
    chatForm.onsubmit = function (event) {
        console.log('Form submit triggered');
        handleChatBotQuery(event);
    };

    $('#new-notes').on('click', () => {
        event.preventDefault();
        newNote()
    });

    $('#save-case-notes').on('click', async function (event) {
        event.preventDefault();
        const text = $('#case-notes-input').val();
        const visit_date = new Date().toISOString().substring(0, 10);

        const response = await fetch(`${CASENOTES_URL}${currentCaseId}/${currentVisitId || -1}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ case_id: currentCaseId, visit_id: currentVisitId, note: text, note_type: currentNoteType, visit_date: visit_date, genai_summary: null })
        });

        const last_case_id = currentCaseId;
        const last_visit_id = currentVisitId;
        newNote();
        handleLoadCaseNotes(currentCaseId);
        setTimeout(() => { summarizeCaseNotes(last_case_id, last_visit_id); }, 1500);
    });

    // Enter key event
    chatInput.onkeydown = function (event) {
        if (event.key === 'Enter') {
            console.log('Enter key pressed');
            handleChatBotQuery(event);
        }
    };

    console.log('Event listeners set up complete');
});

let messageCounter = 1;

function displayMessage(sender, text, first) {
    console.log('Displaying message:', { sender, text });
    const icon = sender == 'bot' && first == undefined ? `<br/><i id='copy-over-${messageCounter}' class='material-icons copy-over virtual-button'>swap_horiz</i>` : '';
    const messageElement = $(`
        <div class="chat-message chat-message--${sender}">
            <span>${text}</span>${icon}
        </div>
    `);
    $('.js-chat-window').append(messageElement);
    $(`#copy-over-${messageCounter}`).on('click', function (el) {
        newNote();
        const content = trimPoliteTrailingQuestion($(this).parent().children('span').text());
        $('#case-notes-input').val('(AI Assistant generated) ' + content);
        currentNoteType = 'genai';
    });
    messageCounter++;
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function newNote() {
    $('#case-notes-input').val('').trigger('focus');

    const case_notes = $('.previous-notes__item').map(function () { return $(this).data('note') });
    currentVisitId = Math.max(...case_notes.map((_, n) => n.visit_id)) + 1;
    currentNoteType = 'note';
}

function gatherNotes() {
    const notes = [];
    $('.previous-notes__item').each((idx, el) => {
        const data = $(el).data('note');
        notes.push(`NOTE: ${data.note} (recorded ${data.visit_date})`);
    });
    return notes;
}

function trimPoliteTrailingQuestion(s) {
    if (s.slice(-1) != '?') {
        return s;
    }

    const period_position = s.lastIndexOf('.');
    const trimmed = s.substring(0, period_position + 1);
    return trimmed;
}

async function summarizeCaseNotes(case_id, visit_id) {
    try {
        const url = `${AUTO_SUMMARIZE_URL}/${case_id}/${visit_id}`;
        console.log('Calling cloud function at:', url);
        // Call cloud function
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        if (!data) {
            throw new Error('No response in data');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}
