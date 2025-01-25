// DOM Elements
const chatWindow = document.querySelector('.js-chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('ai-input');
const submitButton = document.getElementById('chat-submit');

const CHATBOT_URL = '/gemini';;
const CASENOTES_URL = '/casenotes/';
const AUTO_SUMMARIZE_URL = '/genai_auto_summarize';

let currentCaseId = 67196;
let currentNoteType = 'note';
let currentVisitId = -1;
let micOn = false;

// Debug function to check elements
function debugElements() {
    console.log('Debugging elements:');
    console.log('chatWindow:', chatWindow);
    console.log('chatForm:', chatForm);
    console.log('chatInput:', chatInput);
    console.log('submitButton:', submitButton);
}

(async () => {
    await handleLoadCaseNotes(currentCaseId);
    newNote();
    $('#reload-case-notes').on('click', async function () {
        await handleLoadCaseNotes(currentCaseId);
    });
    $('#case-notes-input').on('keydown', async function (event) {
        if (event.key == 'Enter' && event.metaKey) {
            event.preventDefault();
            await handleSaveNotes();
        }
    });
    $('#case-notes-input').on('keyup', async function (event) {
        $('#char-count').text($('#case-notes-input').val().length);
    });
})();

// load case notes
async function handleLoadCaseNotes(case_id) {
    const new_node = $('#reload-case-notes').clone(true, true);
    $('#reload-case-notes').replaceWith(new_node);

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
                const type_header = row.note_type == 'genai'
                    ? ': AI Assistant Note'
                    : row.note.startsWith('Phone call transcription:')
                        ? "Phone Call"
                        : "Visit";
                const element = $(`
                    <li id="${element_id}" class="previous-notes__item">
                        <a href="#" class="previous-notes__link">
                            <span class="previous-notes__date">${row.visit_date} - ${type_header}</span>
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

    $('.ai-mentor').animate({
        scrollTop: $('.ai-mentor').prop('scrollHeight'),
    }, 500);

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
            $('.ai-mentor').animate({
                scrollTop: $('.ai-mentor').prop('scrollHeight'),
            }, 500);
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

    $('#new-notes').on('click', (event) => {
        event.preventDefault();
        newNote();
    });

    $('#new-transcription').on('click', (event) => {
        event.preventDefault();
        newNote("Phone call transcription:\n\n");
    });

    $('#save-case-notes').on('click', async () => await handleSaveNotes());

    // Enter key event
    chatInput.onkeydown = function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
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

function newNote(header) {
    $('#case-notes-input').val(header || '').trigger('focus');

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
    $('#save-gemini-logo').replaceWith($('#save-gemini-logo').clone());
    $('#save-gemini-logo').addClass('rotating');

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

async function handleSaveNotes(event) {
    if (event) {
        event.preventDefault();
    }

    const text = $('#case-notes-input').val();
    if (text == '') {
        return;
    }

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
}

let timeout;
let previousValue = "";

$('#case-notes-input').on("input", () => {
    if (!micOn) {
        return;
    }

    if (timeout) {
        clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
        if (textarea.value !== previousValue) {
            console.log("Textarea has changed.");
            previousValue = textarea.value;
        } else {
            console.log("Textarea has not changed in 1 second.");
        }
    }, 1000);
});
