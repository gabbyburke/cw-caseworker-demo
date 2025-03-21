// DOM Elements
const chatWindow = document.querySelector('.js-chat-window');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#ai-input');
const submitButton = document.querySelector('#chat-submit');

// Debug initial state
console.log('Initial DOM elements:');
console.log('Chat window:', chatWindow);
console.log('Chat form:', chatForm);
console.log('Chat input:', chatInput);
console.log('Submit button:', submitButton);

// API Endpoints - ensure they don't end with a slash
const CASENOTES_URL = 'https://casenotes-api-807576987550.us-central1.run.app';
const CHATBOT_URL = 'https://cw-chatbot-function-807576987550.us-central1.run.app';
const AUTO_SUMMARIZE_URL = 'https://cw-summarize-function-807576987550.us-central1.run.app';
const MASSAGE_TRANSCRIPT_URL = 'https://cw-massage-transcript-807576987550.us-central1.run.app';

let currentCaseId = 24601;
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
            await handleSaveNotes(event);
        }
    });

    $('#case-notes-input').on('keyup', async function (event) {
        $('#char-count').text($('#case-notes-input').val().length);
    });

    $('#mic-button').on('click', () => {
        micOn = !micOn;
        if (micOn) {
            $('#mic-button').addClass('button--primary');
            $('#textarea-region').css('display', 'none');
            $('#transcription-region').css('display', 'block');
            recog.start();
        } else {
            $('#mic-button').removeClass('button--primary');
            $('#textarea-region').css('display', 'block');
            $('#transcription-region').css('display', 'none');
            $('#case-notes-input').scrollTop($('#case-notes-input').prop('scrollHeight'));
            recog.stop();
        }
    });

    $('body').on('keydown', async function (event) {
        if (event.key == ' ' && event.ctrlKey) {
            $('#mic-button').trigger('click');
        }
    });

    $('#risk-level').on('click', () => {
        $('#risk-level').text('Low').removeClass('risk-level--medium').addClass('risk-level--low').addClass('size-pulse');;
    });
})();

// load case notes
async function handleLoadCaseNotes(case_id) {
    const new_node = $('#reload-case-notes').clone(true, true);
    $('#reload-case-notes').replaceWith(new_node);

    try {
        console.log('Fetching case notes from:', `${CASENOTES_URL}/${case_id}`);
        const response = await fetch(`${CASENOTES_URL}/${case_id}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
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
        }
    } catch (error) {
        console.error('Error:', error);
        $('#previous-notes-list').empty();
    }
}

// Handle form submission
async function handleChatBotQuery(event) {
    if (event) {
        event.preventDefault();
    }
    
    if (!CHATBOT_URL) {
        displayMessage('bot', 'The AI chat functionality is currently unavailable.');
        return;
    }

    console.log('Submit button clicked');
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

        // Get case notes and history
        const history = gatherNotes();

        // Show loading state
        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('chat-message', 'chat-message--loading');
        loadingMessage.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
        chatWindow.appendChild(loadingMessage);

        try {
            console.log('Calling cloud function at:', CHATBOT_URL);
            console.log('History:', history);
            console.log('Message:', trimmedMessage);
            
            // Call cloud function
            const response = await fetch(CHATBOT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    message: trimmedMessage,
                    history: history
                })
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
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - Setting up event listeners');
    debugElements();

    if (!chatWindow || !chatForm || !chatInput || !submitButton) {
        console.error('Required elements not found');
        return;
    }

    // Make AI Assistant visible
    $('.ai-assistant').addClass('is-visible');

    // Display welcome message
    displayMessage('bot', "Hello! I'm your AI assistant for case management. How can I help you today?", 'first-time');

    // Form submit event using jQuery
    $('#chat-form').on('submit', function(event) {
        event.preventDefault();
        console.log('Form submitted');
        const message = $('#ai-input').val();
        console.log('Message:', message);
        if (message && message.trim()) {
            handleChatBotQuery();
        } else {
            console.log('Empty message, not submitting');
        }
    });

    $('#new-notes').on('click', (event) => {
        event.preventDefault();
        newNote();
        reset_recog();
    });

    $('#new-transcription').on('click', (event) => {
        event.preventDefault();
        newNote("Phone call transcription:\n\n");
    });

    $('#save-case-notes').on('click', async (event) => await handleSaveNotes(event));

    // Enter key event using jQuery
    $(chatInput).on('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            console.log('Enter key pressed');
            const message = $(this).val();
            console.log('Message:', message);
            handleChatBotQuery();
        }
    });

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

    const case_notes = $('.previous-notes__item').map(function () { return $(this).data('note') }).get();
    currentVisitId = case_notes.length > 0 ? Math.max(...case_notes.map(n => n.visit_id)) + 1 : 1;
    currentNoteType = 'note';
}

function gatherNotes() {
    const notes = [];
    
    // Add case information first
    notes.push({
        sender: 'user',
        message: `Case Information: Family with primary caregivers Sofia Smith and Louis Smith. Children: Isabella Smith (8) and Michael Smith (6). Case type: Neglect. Current risk level: Medium. Last assessment conducted on 2024-10-03.`
    });
    
    // Add case notes
    $('.previous-notes__item').each((idx, el) => {
        const data = $(el).data('note');
        notes.push({
            sender: 'user',
            message: `Case Note (${data.visit_date}): ${data.note}`
        });
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
    if (!AUTO_SUMMARIZE_URL) {
        console.log('Auto-summarize functionality is currently unavailable');
        return;
    }

    $('#save-gemini-logo-holder').empty();
    $('#save-gemini-logo-holder').append($(`<img id="save-gemini-logo" class="gemini-logo pulse" src="gemini.png" />`));

    try {
        const url = `${AUTO_SUMMARIZE_URL}/${case_id}/${visit_id}`;
        console.log('Calling cloud function at:', url);
        // Call cloud function
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
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

    try {
        const response = await fetch(`${CASENOTES_URL}/${currentCaseId}/${currentVisitId || -1}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ case_id: currentCaseId, visit_id: currentVisitId, note: text, note_type: currentNoteType, visit_date: visit_date, genai_summary: null })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const last_case_id = currentCaseId;
        const last_visit_id = currentVisitId;
        newNote();
        await handleLoadCaseNotes(currentCaseId);
        setTimeout(() => { summarizeCaseNotes(last_case_id, last_visit_id); }, 1500);
    } catch (error) {
        console.error('Error saving notes:', error);
    }
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

function new_segment() { return { raw: '', pending: '', processed: null } };

function reset_recog() {
    processed_segment = new_segment();
    current_segment = new_segment();
}

let processed_segment, current_segment;

reset_recog();

let prev = '';
let render_interval = setInterval(() => {
    if (micOn) {
        let processed_text = (processed_segment.processed != null ? processed_segment.processed : '');
        let contents = processed_text
            + processed_segment.pending
            + current_segment.raw;
        if (contents == prev) { return; }
        // console.log(`rendering "${contents}"`);
        $('#case-notes-input').val(contents).scrollTop($('#case-notes-input').prop('scrollHeight'));
        prev = contents;
        $('#processed-text').text(processed_text);
        $('#pending-text').text(processed_segment.pending);
        $('#raw-text').text(current_segment.raw);
        $('#transcription-holder').scrollTop($('#transcription-holder').prop('scrollHeight'));
    }
}, 300);

recog.onresult = function (event) {
    current_segment.raw = '';
    for (var i = event.resultIndex; i < event.results.length; ++i) {
        current_segment.raw += event.results[i][0].transcript;

        if (event.results[i].isFinal) {
            // console.log('** got final');
            processed_segment.pending += current_segment.raw;
            current_segment.raw = '';
            massage_transcript();
        }
    }
}

async function massage_transcript() {
    if (!MASSAGE_TRANSCRIPT_URL) {
        console.log('Transcript processing is currently unavailable');
        return;
    }

    try {
        $('#transcribe-gemini-logo-holder').empty();
        $('#transcribe-gemini-logo-holder').append($(`<img id="transcribe-gemini-logo" class="gemini-logo pulse" src="gemini.png" />`));
        const response = await fetch(MASSAGE_TRANSCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(processed_segment.raw + processed_segment.pending)
        });

        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.fixed != null) {
            processed_segment.processed = data.fixed;
            processed_segment.raw += processed_segment.pending;
            processed_segment.pending = '';
        } else {
            throw new Error('No response in data');
        }
    } catch (error) {
        console.error('Error:', error);
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
    if (micOn) {
        recog.start();
    }
}
