// DOM Elements
const chatWindow = document.querySelector('.js-chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('ai-input');
const submitButton = document.getElementById('chat-submit');

const CHATBOT_URL = '/gemini';
const CASENOTES_URL = '/casenotes/'

// Debug function to check elements
function debugElements() {
    console.log('Debugging elements:');
    console.log('chatWindow:', chatWindow);
    console.log('chatForm:', chatForm);
    console.log('chatInput:', chatInput);
    console.log('submitButton:', submitButton);
}

(async () => {
    handleLoadCaseNotes(12345);
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
            for (let row of data) {
                let summary = row.summary;
                if (!summary) {
                    summary = row.note.substring(0, 120) + (row.note.length > 120 ? '...' : '');
                }

                const element = `
                    <li id="previous-notes-item-${row.visit_id}" class="previous-notes__item">
                        <a href="#" class="previous-notes__link">
                            <span class="previous-notes__date">${row.visit_date}</span>
                            <span class="previous-notes__preview">${summary}</span>
                        </a>
                    </li>
                `;

                $('#previous-notes-list').append($(element));
            }
        } else {
            throw new Error('No response in data');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();
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
                body: JSON.stringify({ message: trimmedMessage })
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
    displayMessage('bot', "Hello! I'm your AI assistant for case management. How can I help you today?");

    // Form submit event
    chatForm.onsubmit = function (event) {
        console.log('Form submit triggered');
        handleSubmit(event);
    };

    // Button click event
    submitButton.onclick = function (event) {
        console.log('Submit button clicked');
        handleSubmit(event);
    };

    // Enter key event
    chatInput.onkeydown = function (event) {
        if (event.key === 'Enter') {
            console.log('Enter key pressed');
            handleSubmit(event);
        }
    };

    console.log('Event listeners set up complete');
});

function displayMessage(sender, text) {
    console.log('Displaying message:', { sender, text });
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `chat-message--${sender}`);
    messageElement.textContent = text;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}
