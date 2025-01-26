// DOM Elements
const chatWindow = document.querySelector('.js-chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('ai-input');
const submitButton = document.getElementById('chat-submit');

const CHATBOT_URL = '/gemini';
const CASENOTES_URL = '/casenotes/';
const AUTO_SUMMARIZE_URL = '/genai_auto_summarize';
const MASSAGE_TRANSCRIPT_URL = '/massage_transcript';

// let currentCaseId = 67196;
let currentCaseId = 12345;
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

    $('#mic-button').on('click', () => {
        micOn = !micOn;
        if (micOn) {
            $('#mic-button').addClass('button--icon');
            recog.start();
        } else {
            $('#mic-button').removeClass('button--icon');
            recog.stop();
        }
    })
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
        reset_recog();
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
        previousValue = $('#case-notes-input').val();
        return;
    }

    if (timeout) {
        console.log('Clearing timeout due to change');
        clearTimeout(timeout);
    }

    previousValue = $('#case-notes-input').val();

    console.log('Creating new timeout');
    timeout = setTimeout(() => {
        if ($('#case-notes-input').val() !== previousValue) {
            console.log("Textarea has changed.");
            console.log(`previous: "${previousValue}"`);
            console.log(`current:  "${$('#case-notes-input').val()}"`);
            previousValue = $('#case-notes-input').val();
        } else {
            console.log("Textarea has not changed in 2 seconds.");
        }
    }, 2000);
});

const recog = new webkitSpeechRecognition();
recog.continuous = true;
recog.interimResults = true;

let chunks, max_len, raw_buffer, massaged_buffer, prev;
reset_recog();

function reset_recog() {
    chunks = [];
    max_len = 0;
    raw_buffer = "";
    massaged_buffer = "";
    prev = "";
}

recog.onresult = function (event) {
    const ta = document.querySelector('#case-notes-input');

    if (event.results.length > 0) {
        // console.log(`received ${event.results.length} blocks`);
    }

    console.log(`ta.value is "${ta.value}"`);
    console.log(`Resetting to raw buffer "${raw_buffer}"`);
    ta.value = raw_buffer;

    if (ta.value.length < max_len) {
        console.log(`*** TA.VALUE ${ta.value.length} < MAX_LEN ${max_len}`)
    } else {
        max_len = ta.value;
    }
    if (ta.value != prev) {
        // console.log(`onresult: Resetting ta to "${ta.value}"`);
        // prev = ta.value;
    }

    ta.scrollTop = ta.scrollHeight;

    for (var i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            chunks.push(event.results[i][0].transcript);
            raw_buffer += event.results[i][0].transcript;
            // massage_transcript(raw_buffer, ta.value.length);
            massage_transcript(ta.value);
        } else {
            ta.value += event.results[i][0].transcript;
            ta.scrollTop = ta.scrollHeight;
        }
    }
}

recog.onerror = function (event) {
    if (event.error == 'no-speech') {
        console.log('info_no_speech');
    }
    if (event.error == 'audio-capture') {
        console.log('info_no_microphone');
    }
    if (event.error == 'not-allowed') {
        if (event.timeStamp - start_timestamp < 100) {
            console.log('info_blocked');
        } else {
            console.log('info_denied');
        }
    }
};

recog.onend = function (event) {
    let msg = '********* Ended!';
    const ta = document.querySelector('#case-notes-input')
    // ta.value = chunks.join(' ') + ' ';
    if (ta.value < max_len) {
        debugger;
    } else {
        max_len = ta.value;
    }
    console.log(`* ta.value=${ta.value}`);
    ta.scrollTop = ta.scrollHeight;

    if (micOn) {
        msg += ' restarting...';
        recog.start();
    } else {
        ta.value = massaged_buffer;
    }
    console.log(msg);
}

async function massage_transcript(text) {
    try {
        const response = await fetch(MASSAGE_TRANSCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(text)
        });

        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const ta = document.querySelector('#case-notes-input')

        if (data.fixed != null) {
            massaged_buffer = data.fixed;
            console.log(`massaged text: "${data.fixed}"`);
            if (massaged_buffer.substring(-1) != ' ') {
                massaged_buffer += ' ';
            }
            const current_text = raw_buffer;
            const new_text = massaged_buffer + current_text.substring(text.length + 1);
            console.log(`Replacing ta[0..${text.length + 1}]: "${massaged_buffer}" + "${current_text.substring(text.length + 1)}"`);
            ta.value = new_text;
            raw_buffer = new_text;
        } else {
            throw new Error('No response in data');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {

    }
}